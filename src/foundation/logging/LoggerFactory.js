/**
 * Logger Factory Implementation
 * 
 * Central factory for creating and managing logger instances with consistent
 * configuration. Provides module-specific loggers while maintaining global
 * configuration consistency.
 */

import { Logger } from './Logger.js';
import { ConsoleTransport } from './transports/ConsoleTransport.js';
import { TransportFactory } from './TransportFactory.js';

export class LoggerFactory {
  constructor(globalConfig = {}) {
    this.globalConfig = {
      level: 'info',
      transports: [new ConsoleTransport()],
      middleware: [],
      metadata: {},
      ...globalConfig
    };
    
    this.loggers = new Map();
    this.moduleConfigs = new Map();
  }

  /**
   * Create or retrieve a logger for a specific module
   * @param {string} moduleName - Name of the module requesting the logger
   * @param {Object} moduleConfig - Module-specific configuration overrides
   * @returns {Logger} Logger instance for the module
   */
  getLogger(moduleName, moduleConfig = {}) {
    if (this.loggers.has(moduleName)) {
      return this.loggers.get(moduleName);
    }

    const logger = this._createLogger(moduleName, moduleConfig);
    this.loggers.set(moduleName, logger);
    
    return logger;
  }

  /**
   * Update global configuration for all loggers
   * @param {Object} config - New global configuration
   */
  updateGlobalConfig(config) {
    this.globalConfig = { ...this.globalConfig, ...config };
    
    // Update all existing loggers with new global config
    for (const [moduleName, logger] of this.loggers) {
      const moduleConfig = this.moduleConfigs.get(moduleName) || {};
      const mergedConfig = this._mergeConfigs(this.globalConfig, moduleConfig);
      logger.configure(mergedConfig);
    }
  }

  /**
   * Configure the logger factory with new settings
   * @param {Object} config - Configuration object
   */
  configure(config) {
    // Convert transport configurations to transport instances
    if (config.transports && Array.isArray(config.transports)) {
      const transportInstances = TransportFactory.createTransports(config.transports);
      config = {
        ...config,
        transports: transportInstances
      };
    }
    
    this.updateGlobalConfig(config);
  }

  /**
   * Update configuration for a specific module
   * @param {string} moduleName - Name of the module
   * @param {Object} moduleConfig - Module-specific configuration
   */
  updateModuleConfig(moduleName, moduleConfig) {
    this.moduleConfigs.set(moduleName, moduleConfig);
    
    if (this.loggers.has(moduleName)) {
      const logger = this.loggers.get(moduleName);
      const mergedConfig = this._mergeConfigs(this.globalConfig, moduleConfig);
      logger.configure(mergedConfig);
    }
  }

  /**
   * Add a transport to all loggers
   * @param {Transport} transport - Transport instance to add
   */
  addGlobalTransport(transport) {
    this.globalConfig.transports.push(transport);
    
    // Add to all existing loggers
    for (const logger of this.loggers.values()) {
      logger.addTransport(transport);
    }
  }

  /**
   * Add middleware to all loggers
   * @param {Function} middleware - Middleware function to add
   */
  addGlobalMiddleware(middleware) {
    this.globalConfig.middleware.push(middleware);
    
    // Add to all existing loggers
    for (const logger of this.loggers.values()) {
      logger.addMiddleware(middleware);
    }
  }

  /**
   * Get all registered logger names
   * @returns {string[]} Array of logger names
   */
  getLoggerNames() {
    return Array.from(this.loggers.keys());
  }

  /**
   * Get logger statistics
   * @returns {Object} Statistics about registered loggers
   */
  getStats() {
    return {
      totalLoggers: this.loggers.size,
      loggerNames: this.getLoggerNames(),
      globalConfig: { ...this.globalConfig },
      moduleConfigs: Object.fromEntries(this.moduleConfigs)
    };
  }

  /**
   * Clear all loggers (useful for testing)
   */
  clear() {
    this.loggers.clear();
    this.moduleConfigs.clear();
  }

  /**
   * Create a new logger instance with merged configuration
   * @private
   */
  _createLogger(moduleName, moduleConfig) {
    this.moduleConfigs.set(moduleName, moduleConfig);
    const mergedConfig = this._mergeConfigs(this.globalConfig, moduleConfig);
    
    return new Logger(moduleName, mergedConfig);
  }

  /**
   * Merge global and module-specific configurations
   * @private
   */
  _mergeConfigs(globalConfig, moduleConfig) {
    // Handle transport configurations
    let transports = [...globalConfig.transports];
    
    if (moduleConfig.transports) {
      if (Array.isArray(moduleConfig.transports)) {
        // Check if these are configuration objects or transport instances
        const moduleTransports = moduleConfig.transports.every(t => typeof t === 'object' && t.type)
          ? TransportFactory.createTransports(moduleConfig.transports)
          : moduleConfig.transports;
        
        transports = [...transports, ...moduleTransports];
      }
    }
    
    return {
      level: moduleConfig.level || globalConfig.level,
      transports,
      middleware: [...globalConfig.middleware, ...(moduleConfig.middleware || [])],
      metadata: { ...globalConfig.metadata, ...moduleConfig.metadata }
    };
  }
}

// Create and export a default factory instance
export const defaultLoggerFactory = new LoggerFactory();

/**
 * Convenience function to get a logger for a module
 * @param {string} moduleName - Name of the module
 * @param {Object} config - Optional module-specific configuration
 * @returns {Logger} Logger instance
 */
export function getLogger(moduleName, config = {}) {
  return defaultLoggerFactory.getLogger(moduleName, config);
}