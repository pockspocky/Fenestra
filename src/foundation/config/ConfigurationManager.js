/**
 * Configuration Management System
 * 
 * Provides hierarchical configuration loading with environment-specific settings,
 * schema validation, runtime updates, and override precedence.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { watch } from 'chokidar';

export class ConfigurationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.baseDir = options.baseDir || process.cwd();
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.configFiles = options.configFiles || [
      'config/default.json',
      `config/${this.environment}.json`,
      'config/local.json'
    ];
    
    this.config = new Map();
    this.schemas = new Map();
    this.watchers = new Map();
    this.overrides = new Map();
    
    this.logger = options.logger;
    this.actionCallbacks = options.actionCallbacks;
    
    // Configuration change debouncing
    this.changeTimeout = null;
    this.changeDebounceMs = options.changeDebounceMs || 100;
    
    this.logger?.debug('[ConfigurationManager] Initialized', {
      baseDir: this.baseDir,
      environment: this.environment,
      configFiles: this.configFiles
    });
  }

  /**
   * Load configuration from all configured sources
   * @returns {Promise<Object>} Merged configuration object
   */
  async load() {
    const context = {
      action: 'config-load',
      source: 'ConfigurationManager',
      environment: this.environment,
      configFiles: this.configFiles
    };

    try {
      const result = await this.actionCallbacks?.execute('config-load', async (actionContext) => {
        // Load base configuration files
        const configs = [];
        
        for (const configFile of this.configFiles) {
          const configPath = path.resolve(this.baseDir, configFile);
          
          try {
            const configData = await this._loadConfigFile(configPath);
            if (configData) {
              configs.push({
                source: configFile,
                data: configData
              });
              
              this.logger?.debug('[ConfigurationManager] Loaded config file', {
                configFile,
                configPath,
                keys: Object.keys(configData)
              });
            }
          } catch (error) {
            // Config files are optional except for default
            if (configFile.includes('default')) {
              throw error;
            }
            
            this.logger?.debug('[ConfigurationManager] Optional config file not found', {
              configFile,
              configPath
            });
          }
        }
        
        // Merge configurations with precedence (later files override earlier ones)
        const mergedConfig = this._mergeConfigurations(configs);
        
        // Apply runtime overrides
        const finalConfig = this._applyOverrides(mergedConfig);
        
        // Validate against schemas
        await this._validateConfiguration(finalConfig);
        
        // Store the configuration
        this.config.clear();
        for (const [key, value] of Object.entries(finalConfig)) {
          this.config.set(key, value);
        }
        
        this.logger?.info('[ConfigurationManager] Configuration loaded successfully', {
          environment: this.environment,
          configSources: configs.length,
          configKeys: Object.keys(finalConfig).length,
          overrides: this.overrides.size
        });
        
        return finalConfig;
      }, context) || await this._loadConfigurationDirect();
      
      // Emit configuration loaded event
      this.emit('loaded', this.getAll());
      
      return this.getAll();
    } catch (error) {
      this.logger?.error('[ConfigurationManager] Failed to load configuration', {
        error: error.message,
        stack: error.stack,
        environment: this.environment
      });
      
      throw new Error(`Configuration load failed: ${error.message}`);
    }
  }

  /**
   * Load configuration directly (fallback when no action callbacks)
   * @private
   */
  async _loadConfigurationDirect() {
    // Load base configuration files
    const configs = [];
    
    for (const configFile of this.configFiles) {
      const configPath = path.resolve(this.baseDir, configFile);
      
      try {
        const configData = await this._loadConfigFile(configPath);
        if (configData) {
          configs.push({
            source: configFile,
            data: configData
          });
          
          this.logger?.debug('[ConfigurationManager] Loaded config file', {
            configFile,
            configPath,
            keys: Object.keys(configData)
          });
        }
      } catch (error) {
        // Config files are optional except for default
        if (configFile.includes('default')) {
          throw error;
        }
        
        this.logger?.debug('[ConfigurationManager] Optional config file not found', {
          configFile,
          configPath
        });
      }
    }
    
    // Merge configurations with precedence (later files override earlier ones)
    const mergedConfig = this._mergeConfigurations(configs);
    
    // Apply runtime overrides
    const finalConfig = this._applyOverrides(mergedConfig);
    
    // Validate against schemas
    await this._validateConfiguration(finalConfig);
    
    // Store the configuration
    this.config.clear();
    for (const [key, value] of Object.entries(finalConfig)) {
      this.config.set(key, value);
    }
    
    this.logger?.info('[ConfigurationManager] Configuration loaded successfully', {
      environment: this.environment,
      configSources: configs.length,
      configKeys: Object.keys(finalConfig).length,
      overrides: this.overrides.size
    });
    
    return finalConfig;
  }

  /**
   * Get configuration value by path
   * @param {string} path - Configuration path (dot notation)
   * @param {any} defaultValue - Default value if path not found
   * @returns {any} Configuration value
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.getAll();
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  /**
   * Set configuration value at runtime
   * @param {string} path - Configuration path (dot notation)
   * @param {any} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let current = this._ensureConfigStructure();
    
    // Navigate to parent object
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    this.logger?.debug('[ConfigurationManager] Configuration value updated', {
      path,
      oldValue,
      newValue: value
    });
    
    // Emit change event
    this.emit('changed', {
      path,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    });
  }

  /**
   * Set runtime override for configuration value
   * @param {string} path - Configuration path
   * @param {any} value - Override value
   */
  setOverride(path, value) {
    this.overrides.set(path, value);
    
    this.logger?.debug('[ConfigurationManager] Runtime override set', {
      path,
      value,
      totalOverrides: this.overrides.size
    });
    
    // Apply override to current configuration
    this.set(path, value);
  }

  /**
   * Remove runtime override
   * @param {string} path - Configuration path
   */
  removeOverride(path) {
    const hadOverride = this.overrides.delete(path);
    
    if (hadOverride) {
      this.logger?.debug('[ConfigurationManager] Runtime override removed', {
        path,
        remainingOverrides: this.overrides.size
      });
      
      // Reload configuration to restore original value
      this.reload();
    }
  }

  /**
   * Get all configuration as a plain object
   * @returns {Object} Complete configuration object
   */
  getAll() {
    const result = {};
    
    for (const [key, value] of this.config) {
      result[key] = value;
    }
    
    return result;
  }

  /**
   * Register configuration schema for validation
   * @param {string} section - Configuration section name
   * @param {Object} schema - JSON schema for validation
   */
  registerSchema(section, schema) {
    this.schemas.set(section, schema);
    
    this.logger?.debug('[ConfigurationManager] Schema registered', {
      section,
      schemaKeys: Object.keys(schema.properties || {})
    });
  }

  /**
   * Start watching configuration files for changes
   */
  startWatching() {
    if (this.watchers.size > 0) {
      this.logger?.debug('[ConfigurationManager] Already watching configuration files');
      return;
    }
    
    for (const configFile of this.configFiles) {
      const configPath = path.resolve(this.baseDir, configFile);
      
      try {
        const watcher = watch(configPath, {
          persistent: true,
          ignoreInitial: true
        });
        
        watcher.on('change', () => {
          this._handleConfigFileChange(configFile);
        });
        
        watcher.on('error', (error) => {
          this.logger?.error('[ConfigurationManager] File watcher error', {
            configFile,
            error: error.message
          });
        });
        
        this.watchers.set(configFile, watcher);
        
        this.logger?.debug('[ConfigurationManager] Started watching config file', {
          configFile,
          configPath
        });
      } catch (error) {
        this.logger?.warn('[ConfigurationManager] Failed to watch config file', {
          configFile,
          error: error.message
        });
      }
    }
  }

  /**
   * Stop watching configuration files
   */
  stopWatching() {
    for (const [configFile, watcher] of this.watchers) {
      try {
        watcher.close();
        this.logger?.debug('[ConfigurationManager] Stopped watching config file', {
          configFile
        });
      } catch (error) {
        this.logger?.error('[ConfigurationManager] Error stopping file watcher', {
          configFile,
          error: error.message
        });
      }
    }
    
    this.watchers.clear();
  }

  /**
   * Reload configuration from files
   */
  async reload() {
    this.logger?.info('[ConfigurationManager] Reloading configuration');
    
    try {
      await this.load();
      this.emit('reloaded', this.getAll());
    } catch (error) {
      this.logger?.error('[ConfigurationManager] Configuration reload failed', {
        error: error.message
      });
      
      this.emit('error', error);
    }
  }

  /**
   * Get configuration statistics
   * @returns {Object} Configuration statistics
   */
  getStats() {
    return {
      environment: this.environment,
      configFiles: this.configFiles.length,
      loadedKeys: this.config.size,
      schemas: this.schemas.size,
      overrides: this.overrides.size,
      watchers: this.watchers.size,
      isWatching: this.watchers.size > 0
    };
  }

  /**
   * Load configuration file
   * @private
   */
  async _loadConfigFile(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      
      throw new Error(`Failed to load config file ${configPath}: ${error.message}`);
    }
  }

  /**
   * Merge multiple configuration objects with precedence
   * @private
   */
  _mergeConfigurations(configs) {
    let merged = {};
    
    for (const config of configs) {
      merged = this._deepMerge(merged, config.data);
    }
    
    return merged;
  }

  /**
   * Deep merge two objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this._deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Apply runtime overrides to configuration
   * @private
   */
  _applyOverrides(config) {
    const result = { ...config };
    
    for (const [path, value] of this.overrides) {
      this._setNestedValue(result, path, value);
    }
    
    return result;
  }

  /**
   * Set nested value using dot notation path
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  /**
   * Validate configuration against registered schemas
   * @private
   */
  async _validateConfiguration(config) {
    const validationErrors = [];
    
    for (const [section, schema] of this.schemas) {
      if (section in config) {
        try {
          // Simple validation - in a real implementation, use a proper JSON schema validator
          this._validateSection(config[section], schema, section);
        } catch (error) {
          validationErrors.push({
            section,
            error: error.message
          });
        }
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Configuration validation failed: ${JSON.stringify(validationErrors)}`);
    }
  }

  /**
   * Validate configuration section
   * @private
   */
  _validateSection(data, schema, section) {
    // Basic validation - check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          throw new Error(`Missing required property '${requiredProp}' in section '${section}'`);
        }
      }
    }
    
    // Type validation for properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in data) {
          const value = data[prop];
          const expectedType = propSchema.type;
          
          if (expectedType) {
            // Special handling for arrays
            if (expectedType === 'array') {
              if (!Array.isArray(value)) {
                throw new Error(`Property '${prop}' in section '${section}' should be an array, got '${typeof value}'`);
              }
            } else if (typeof value !== expectedType) {
              throw new Error(`Property '${prop}' in section '${section}' should be of type '${expectedType}', got '${typeof value}'`);
            }
          }
          
          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(value)) {
            throw new Error(`Property '${prop}' in section '${section}' should be one of [${propSchema.enum.join(', ')}], got '${value}'`);
          }
        }
      }
    }
  }

  /**
   * Handle configuration file change
   * @private
   */
  _handleConfigFileChange(configFile) {
    // Debounce rapid changes
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    
    this.changeTimeout = setTimeout(() => {
      this.logger?.info('[ConfigurationManager] Configuration file changed, reloading', {
        configFile
      });
      
      this.reload();
    }, this.changeDebounceMs);
  }

  /**
   * Ensure configuration structure exists
   * @private
   */
  _ensureConfigStructure() {
    const config = this.getAll();
    
    // Update the internal map
    this.config.clear();
    for (const [key, value] of Object.entries(config)) {
      this.config.set(key, value);
    }
    
    return config;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopWatching();
    
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    
    this.removeAllListeners();
    
    this.logger?.debug('[ConfigurationManager] Destroyed');
  }
}