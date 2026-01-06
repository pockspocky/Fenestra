/**
 * Plugin Manager for Dynamic Loading and Management
 * 
 * Manages the complete plugin lifecycle including discovery, loading,
 * initialization, communication, and cleanup. Provides dependency
 * resolution and error handling for plugin operations.
 */

import { PluginRegistry } from './PluginRegistry.js';
import { HookSystem } from './HookSystem.js';
import { Plugin } from './Plugin.js';

export class PluginManager {
  constructor(options = {}) {
    this.registry = new PluginRegistry({ logger: options.logger });
    this.hookSystem = new HookSystem({ logger: options.logger });
    this.loadedPlugins = new Map(); // pluginId -> Plugin instance
    this.context = options.context || {};
    this.logger = options.logger;
    this.config = {
      autoLoad: options.autoLoad !== false,
      errorIsolation: options.errorIsolation !== false,
      maxLoadTime: options.maxLoadTime || 30000, // 30 seconds
      ...options.config
    };
    
    // Plugin loading state
    this.loading = new Set();
    this.loadOrder = [];
  }

  /**
   * Initialize the plugin manager
   * @param {Object} context - Plugin context with services
   * @returns {Promise<void>}
   */
  async initialize(context = {}) {
    this.context = {
      ...this.context,
      ...context,
      pluginManager: this,
      hookSystem: this.hookSystem,
      logger: this.logger
    };

    if (this.logger) {
      this.logger.info('Plugin manager initialized', {
        operation: 'initializePluginManager',
        contextServices: Object.keys(this.context)
      });
    }

    // Execute initialization hooks
    await this.hookSystem.execute('plugin-manager:initialized', {
      pluginManager: this,
      context: this.context
    });
  }

  /**
   * Register a plugin in the registry
   * @param {string} pluginId - Plugin ID
   * @param {Object} manifest - Plugin manifest
   * @param {Object} metadata - Additional metadata
   */
  registerPlugin(pluginId, manifest, metadata = {}) {
    this.registry.register(pluginId, manifest, metadata);
    
    if (this.logger) {
      this.logger.debug('Plugin registered', {
        operation: 'registerPlugin',
        pluginId,
        name: manifest.name,
        version: manifest.version
      });
    }
  }

  /**
   * Load a plugin by ID
   * @param {string} pluginId - Plugin ID
   * @param {Object} options - Loading options
   * @returns {Promise<Plugin>} Loaded plugin instance
   */
  async loadPlugin(pluginId, options = {}) {
    const startTime = Date.now();
    
    if (this.logger) {
      this.logger.info('Loading plugin', {
        operation: 'loadPlugin',
        pluginId
      });
    }

    // Check if already loaded
    if (this.loadedPlugins.has(pluginId)) {
      if (this.logger) {
        this.logger.debug('Plugin already loaded', {
          operation: 'loadPlugin',
          pluginId
        });
      }
      return this.loadedPlugins.get(pluginId);
    }

    // Check if currently loading
    if (this.loading.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already being loaded`);
    }

    // Get plugin metadata
    const pluginMetadata = this.registry.getPlugin(pluginId);
    if (!pluginMetadata) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    this.loading.add(pluginId);

    try {
      // Validate dependencies
      const depValidation = this.registry.validateDependencies(pluginId);
      if (!depValidation.isValid) {
        throw new Error(`Plugin dependencies validation failed: ${depValidation.errors.join(', ')}`);
      }

      // Load dependencies first
      await this._loadDependencies(pluginId);

      // Execute before-load hooks
      await this.hookSystem.execute('plugin:before-load', {
        pluginId,
        manifest: pluginMetadata.manifest
      });

      // Create plugin instance
      const pluginInstance = await this._createPluginInstance(pluginId, pluginMetadata, options);

      // Initialize plugin
      await this._initializePlugin(pluginInstance);

      // Store loaded plugin
      this.loadedPlugins.set(pluginId, pluginInstance);
      this.loadOrder.push(pluginId);

      // Update registry status
      this.registry.updateStatus(pluginId, 'loaded', {
        loadedAt: Date.now(),
        loadTime: Date.now() - startTime
      });

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.info('Plugin loaded successfully', {
          operation: 'loadPlugin',
          pluginId,
          duration: `${duration}ms`,
          totalPlugins: this.loadedPlugins.size
        });
      }

      // Execute after-load hooks
      await this.hookSystem.execute('plugin:after-load', {
        pluginId,
        plugin: pluginInstance,
        duration
      });

      return pluginInstance;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update registry status
      this.registry.updateStatus(pluginId, 'error', {
        error: error.message,
        errorAt: Date.now()
      });

      if (this.logger) {
        this.logger.error('Plugin loading failed', {
          operation: 'loadPlugin',
          pluginId,
          duration: `${duration}ms`,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }

      // Execute error hooks
      await this.hookSystem.execute('plugin:load-error', {
        pluginId,
        error: error.message,
        duration
      });

      throw error;
    } finally {
      this.loading.delete(pluginId);
    }
  }

  /**
   * Unload a plugin by ID
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Whether plugin was unloaded
   */
  async unloadPlugin(pluginId) {
    const startTime = Date.now();
    
    if (this.logger) {
      this.logger.info('Unloading plugin', {
        operation: 'unloadPlugin',
        pluginId
      });
    }

    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      if (this.logger) {
        this.logger.warn('Plugin not loaded for unloading', {
          operation: 'unloadPlugin',
          pluginId
        });
      }
      return false;
    }

    try {
      // Check for dependents
      const dependents = this.registry.getDependents(pluginId);
      const loadedDependents = dependents.filter(id => this.loadedPlugins.has(id));
      
      if (loadedDependents.length > 0) {
        throw new Error(`Cannot unload plugin ${pluginId}: it has loaded dependents: ${loadedDependents.join(', ')}`);
      }

      // Execute before-unload hooks
      await this.hookSystem.execute('plugin:before-unload', {
        pluginId,
        plugin
      });

      // Destroy plugin
      await plugin.destroy();

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginId);
      
      // Remove from load order
      const orderIndex = this.loadOrder.indexOf(pluginId);
      if (orderIndex !== -1) {
        this.loadOrder.splice(orderIndex, 1);
      }

      // Unregister plugin hooks
      this.hookSystem.unregisterPlugin(pluginId);

      // Update registry status
      this.registry.updateStatus(pluginId, 'registered', {
        unloadedAt: Date.now()
      });

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.info('Plugin unloaded successfully', {
          operation: 'unloadPlugin',
          pluginId,
          duration: `${duration}ms`,
          remainingPlugins: this.loadedPlugins.size
        });
      }

      // Execute after-unload hooks
      await this.hookSystem.execute('plugin:after-unload', {
        pluginId,
        duration
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.logger) {
        this.logger.error('Plugin unloading failed', {
          operation: 'unloadPlugin',
          pluginId,
          duration: `${duration}ms`,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }

      // Execute error hooks
      await this.hookSystem.execute('plugin:unload-error', {
        pluginId,
        error: error.message,
        duration
      });

      throw error;
    }
  }

  /**
   * Get a loaded plugin by ID
   * @param {string} pluginId - Plugin ID
   * @returns {Plugin|null} Plugin instance or null if not loaded
   */
  getPlugin(pluginId) {
    return this.loadedPlugins.get(pluginId) || null;
  }

  /**
   * Check if a plugin is loaded
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} Whether plugin is loaded
   */
  isLoaded(pluginId) {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Get all loaded plugins
   * @returns {Plugin[]} Array of loaded plugin instances
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get plugin API
   * @param {string} pluginId - Plugin ID
   * @returns {Object|null} Plugin API or null if not loaded
   */
  getPluginAPI(pluginId) {
    const plugin = this.getPlugin(pluginId);
    return plugin ? plugin.getAPI() : null;
  }

  /**
   * Send message to a plugin
   * @param {string} senderPluginId - Sender plugin ID
   * @param {string} targetPluginId - Target plugin ID
   * @param {string} messageType - Message type
   * @param {any} payload - Message payload
   * @returns {Promise<any>} Message response
   */
  async sendMessage(senderPluginId, targetPluginId, messageType, payload) {
    const targetPlugin = this.getPlugin(targetPluginId);
    if (!targetPlugin) {
      throw new Error(`Target plugin ${targetPluginId} is not loaded`);
    }

    if (this.logger) {
      this.logger.debug('Sending plugin message', {
        operation: 'sendMessage',
        senderPluginId,
        targetPluginId,
        messageType
      });
    }

    try {
      return await targetPlugin.handleMessage(messageType, payload, senderPluginId);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Plugin message failed', {
          operation: 'sendMessage',
          senderPluginId,
          targetPluginId,
          messageType,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Broadcast message to all loaded plugins
   * @param {string} senderPluginId - Sender plugin ID
   * @param {string} messageType - Message type
   * @param {any} payload - Message payload
   * @param {string[]} excludePlugins - Plugin IDs to exclude
   * @returns {Promise<Object>} Broadcast results
   */
  async broadcastMessage(senderPluginId, messageType, payload, excludePlugins = []) {
    const results = {};
    const errors = {};
    
    const targetPlugins = Array.from(this.loadedPlugins.keys())
      .filter(id => id !== senderPluginId && !excludePlugins.includes(id));

    if (this.logger) {
      this.logger.debug('Broadcasting plugin message', {
        operation: 'broadcastMessage',
        senderPluginId,
        messageType,
        targetCount: targetPlugins.length
      });
    }

    for (const targetPluginId of targetPlugins) {
      try {
        results[targetPluginId] = await this.sendMessage(senderPluginId, targetPluginId, messageType, payload);
      } catch (error) {
        errors[targetPluginId] = error.message;
      }
    }

    return { results, errors };
  }

  /**
   * Load multiple plugins with dependency resolution
   * @param {string[]} pluginIds - Plugin IDs to load
   * @param {Object} options - Loading options
   * @returns {Promise<Plugin[]>} Loaded plugin instances
   */
  async loadPlugins(pluginIds, options = {}) {
    if (this.logger) {
      this.logger.info('Loading multiple plugins', {
        operation: 'loadPlugins',
        pluginIds,
        count: pluginIds.length
      });
    }

    // Resolve dependency order
    const loadOrder = this.registry.resolveDependencyOrder(pluginIds);
    const loadedPlugins = [];

    for (const pluginId of loadOrder) {
      try {
        const plugin = await this.loadPlugin(pluginId, options);
        loadedPlugins.push(plugin);
      } catch (error) {
        if (this.config.errorIsolation) {
          if (this.logger) {
            this.logger.error('Plugin loading failed (isolated)', {
              operation: 'loadPlugins',
              pluginId,
              error: error.message
            });
          }
        } else {
          throw error;
        }
      }
    }

    return loadedPlugins;
  }

  /**
   * Unload all plugins in reverse dependency order
   * @returns {Promise<number>} Number of plugins unloaded
   */
  async unloadAllPlugins() {
    if (this.logger) {
      this.logger.info('Unloading all plugins', {
        operation: 'unloadAllPlugins',
        pluginCount: this.loadedPlugins.size
      });
    }

    let unloadedCount = 0;
    
    // Unload in reverse order
    const unloadOrder = [...this.loadOrder].reverse();
    
    for (const pluginId of unloadOrder) {
      try {
        if (await this.unloadPlugin(pluginId)) {
          unloadedCount++;
        }
      } catch (error) {
        if (this.logger) {
          this.logger.error('Plugin unloading failed during shutdown', {
            operation: 'unloadAllPlugins',
            pluginId,
            error: error.message
          });
        }
      }
    }

    return unloadedCount;
  }

  /**
   * Get plugin manager statistics
   * @returns {Object} Plugin manager statistics
   */
  getStats() {
    const registryStats = this.registry.getStats();
    const hookStats = this.hookSystem.getStats();
    
    return {
      ...registryStats,
      loadedPlugins: this.loadedPlugins.size,
      loadOrder: [...this.loadOrder],
      currentlyLoading: Array.from(this.loading),
      hookSystem: hookStats,
      config: { ...this.config }
    };
  }

  /**
   * Load plugin dependencies
   * @private
   */
  async _loadDependencies(pluginId) {
    const dependencies = this.registry.getDependencies(pluginId);
    
    for (const depId of dependencies) {
      if (!this.isLoaded(depId)) {
        await this.loadPlugin(depId);
      }
    }
  }

  /**
   * Create plugin instance
   * @private
   */
  async _createPluginInstance(pluginId, pluginMetadata, options) {
    const { manifest, metadata } = pluginMetadata;
    
    // Create plugin instance
    let pluginInstance;
    
    if (metadata.path && metadata.source === 'file') {
      // Load from file
      const pluginModule = await import(metadata.path);
      const PluginClass = pluginModule.default || pluginModule[manifest.main] || Plugin;
      pluginInstance = new PluginClass(pluginId, manifest);
    } else if (metadata.constructor) {
      // Use provided constructor
      pluginInstance = new metadata.constructor(pluginId, manifest);
    } else {
      // Use base Plugin class
      pluginInstance = new Plugin(pluginId, manifest);
    }

    return pluginInstance;
  }

  /**
   * Initialize plugin with context
   * @private
   */
  async _initializePlugin(pluginInstance) {
    const timeout = this.config.maxLoadTime;
    
    const initPromise = pluginInstance.initialize(this.context);
    
    if (timeout > 0) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Plugin initialization timeout after ${timeout}ms`)), timeout);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
    } else {
      await initPromise;
    }
  }
}