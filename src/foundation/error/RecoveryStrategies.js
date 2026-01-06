/**
 * Built-in Recovery Strategies
 * 
 * Provides common recovery strategies for typical error scenarios
 * in the Fenestra application.
 */

import { getLogger } from '../logging/LoggerFactory.js';
import fs from 'fs/promises';
import path from 'path';

const logger = getLogger('recovery-strategies');

/**
 * File System Recovery Strategies
 */
export const fileSystemRecovery = {
  name: 'file-system-recovery',
  priority: 10,
  
  async recover(errorContext) {
    const { error, operation } = errorContext;
    
    // Handle missing file/directory
    if (error.code === 'ENOENT') {
      return await this._handleMissingPath(operation.parameters);
    }
    
    // Handle permission errors
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return await this._handlePermissionError(operation.parameters);
    }
    
    // Handle disk space errors
    if (error.code === 'ENOSPC') {
      return await this._handleDiskSpaceError(operation.parameters);
    }
    
    return { successful: false, reason: 'No applicable file system recovery' };
  },
  
  async _handleMissingPath(params) {
    try {
      if (params.filePath) {
        const dir = path.dirname(params.filePath);
        
        // Try to create missing directory
        await fs.mkdir(dir, { recursive: true });
        
        logger.info('Created missing directory', { directory: dir });
        return { successful: true, action: 'created_directory' };
      }
    } catch (recoveryError) {
      logger.warn('Failed to create missing directory', { 
        error: recoveryError.message 
      });
    }
    
    return { successful: false, reason: 'Could not create missing path' };
  },
  
  async _handlePermissionError(params) {
    // For permission errors, we can't automatically fix them,
    // but we can provide detailed guidance
    logger.warn('Permission error detected', {
      path: params.filePath,
      suggestion: 'Check file permissions and user access rights'
    });
    
    return { 
      successful: false, 
      reason: 'Permission error requires manual intervention',
      guidance: 'Check file permissions and ensure the application has appropriate access rights'
    };
  },
  
  async _handleDiskSpaceError(params) {
    // For disk space errors, we can try cleanup strategies
    logger.warn('Disk space error detected', {
      path: params.filePath,
      suggestion: 'Attempting cleanup of temporary files'
    });
    
    try {
      // Try to clean up temporary files (this would be implemented based on app needs)
      // For now, just return guidance
      return {
        successful: false,
        reason: 'Disk space error requires manual intervention',
        guidance: 'Free up disk space and try again'
      };
    } catch (cleanupError) {
      return { successful: false, reason: 'Cleanup failed' };
    }
  }
};

/**
 * Network Recovery Strategies
 */
export const networkRecovery = {
  name: 'network-recovery',
  priority: 8,
  
  async recover(errorContext) {
    const { error, operation } = errorContext;
    
    // Handle connection refused
    if (error.code === 'ECONNREFUSED') {
      return await this._handleConnectionRefused(operation.parameters);
    }
    
    // Handle timeout
    if (error.code === 'ETIMEDOUT') {
      return await this._handleTimeout(operation.parameters);
    }
    
    // Handle DNS errors
    if (error.code === 'ENOTFOUND') {
      return await this._handleDnsError(operation.parameters);
    }
    
    return { successful: false, reason: 'No applicable network recovery' };
  },
  
  async _handleConnectionRefused(params) {
    logger.info('Attempting network recovery for connection refused');
    
    // Implement retry with exponential backoff
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
        
        // This would attempt the original operation again
        // For now, we'll simulate success after retries
        if (attempt === maxRetries) {
          return { 
            successful: false, 
            reason: 'Connection still refused after retries',
            attempts: attempt
          };
        }
        
        logger.info('Network retry attempt', { attempt, maxRetries });
        
      } catch (retryError) {
        logger.warn('Network retry failed', { 
          attempt, 
          error: retryError.message 
        });
      }
    }
    
    return { successful: false, reason: 'All network retry attempts failed' };
  },
  
  async _handleTimeout(params) {
    logger.info('Handling network timeout');
    
    return {
      successful: false,
      reason: 'Network timeout requires retry with longer timeout',
      guidance: 'Increase timeout value and retry the operation'
    };
  },
  
  async _handleDnsError(params) {
    logger.info('Handling DNS resolution error');
    
    return {
      successful: false,
      reason: 'DNS resolution failed',
      guidance: 'Check network connectivity and DNS settings'
    };
  }
};

/**
 * Memory Recovery Strategies
 */
export const memoryRecovery = {
  name: 'memory-recovery',
  priority: 9,
  
  async recover(errorContext) {
    const { error, system } = errorContext;
    
    if (error.message.includes('memory') || error.code === 'ERR_OUT_OF_MEMORY') {
      return await this._handleMemoryPressure(system);
    }
    
    return { successful: false, reason: 'No applicable memory recovery' };
  },
  
  async _handleMemoryPressure(systemContext) {
    logger.warn('Memory pressure detected, attempting recovery');
    
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection');
      }
      
      // Get updated memory usage
      const memoryAfter = process.memoryUsage();
      const memoryBefore = systemContext.memory;
      
      const freed = memoryBefore.heapUsed - memoryAfter.heapUsed;
      
      if (freed > 0) {
        logger.info('Memory recovery successful', {
          freedBytes: freed,
          freedMB: Math.round(freed / 1024 / 1024)
        });
        
        return { 
          successful: true, 
          action: 'garbage_collection',
          freedMemory: freed
        };
      }
      
      return {
        successful: false,
        reason: 'Garbage collection did not free significant memory',
        guidance: 'Consider restarting the application or reducing memory usage'
      };
      
    } catch (recoveryError) {
      logger.error('Memory recovery failed', { error: recoveryError.message });
      
      return {
        successful: false,
        reason: 'Memory recovery operation failed',
        guidance: 'Restart the application to clear memory'
      };
    }
  }
};

/**
 * Dependency Injection Recovery Strategies
 */
export const dependencyRecovery = {
  name: 'dependency-recovery',
  priority: 10,
  
  async recover(errorContext) {
    const { error, operation } = errorContext;
    
    if (error.message.includes('dependency') || error.message.includes('service')) {
      return await this._handleDependencyError(operation.parameters);
    }
    
    return { successful: false, reason: 'No applicable dependency recovery' };
  },
  
  async _handleDependencyError(params) {
    logger.info('Attempting dependency recovery');
    
    // Check if this is a circular dependency
    if (params.serviceName && params.dependencies) {
      const circular = this._detectCircularDependency(params.serviceName, params.dependencies);
      
      if (circular) {
        return {
          successful: false,
          reason: 'Circular dependency detected',
          guidance: `Circular dependency: ${circular.join(' -> ')}`,
          circularPath: circular
        };
      }
    }
    
    // Check if service is registered
    if (params.serviceName) {
      return {
        successful: false,
        reason: 'Service not registered or misconfigured',
        guidance: `Ensure service '${params.serviceName}' is properly registered in the container`
      };
    }
    
    return { successful: false, reason: 'Unknown dependency error' };
  },
  
  _detectCircularDependency(serviceName, dependencies, visited = new Set(), path = []) {
    if (visited.has(serviceName)) {
      const circularStart = path.indexOf(serviceName);
      return path.slice(circularStart).concat(serviceName);
    }
    
    visited.add(serviceName);
    path.push(serviceName);
    
    for (const dep of dependencies) {
      const circular = this._detectCircularDependency(dep, dependencies, visited, [...path]);
      if (circular) {
        return circular;
      }
    }
    
    return null;
  }
};

/**
 * Configuration Recovery Strategies
 */
export const configurationRecovery = {
  name: 'configuration-recovery',
  priority: 7,
  
  async recover(errorContext) {
    const { error, operation } = errorContext;
    
    if (error.message.includes('configuration') || error.message.includes('config')) {
      return await this._handleConfigurationError(operation.parameters);
    }
    
    return { successful: false, reason: 'No applicable configuration recovery' };
  },
  
  async _handleConfigurationError(params) {
    logger.info('Attempting configuration recovery');
    
    try {
      // Try to load default configuration
      if (params.configPath) {
        const defaultConfigPath = params.configPath.replace(/\.json$/, '.default.json');
        
        try {
          await fs.access(defaultConfigPath);
          
          logger.info('Using default configuration', { 
            defaultPath: defaultConfigPath 
          });
          
          return {
            successful: true,
            action: 'loaded_default_config',
            configPath: defaultConfigPath
          };
          
        } catch (defaultError) {
          // No default config available
        }
      }
      
      // Generate minimal configuration
      const minimalConfig = this._generateMinimalConfig(params);
      
      return {
        successful: true,
        action: 'generated_minimal_config',
        config: minimalConfig
      };
      
    } catch (recoveryError) {
      return {
        successful: false,
        reason: 'Configuration recovery failed',
        guidance: 'Check configuration file syntax and structure'
      };
    }
  },
  
  _generateMinimalConfig(params) {
    // Generate a minimal working configuration
    return {
      logging: {
        level: 'info',
        transports: [{ type: 'console' }]
      },
      services: {},
      features: {
        enableAll: true
      }
    };
  }
};

/**
 * Get all built-in recovery strategies
 * @returns {Array} Array of recovery strategy objects
 */
export function getBuiltInRecoveryStrategies() {
  return [
    fileSystemRecovery,
    networkRecovery,
    memoryRecovery,
    dependencyRecovery,
    configurationRecovery
  ];
}

/**
 * Register all built-in recovery strategies with an error handler
 * @param {ErrorHandler} errorHandler - Error handler instance
 */
export function registerBuiltInStrategies(errorHandler) {
  const strategies = getBuiltInRecoveryStrategies();
  
  for (const strategy of strategies) {
    // Register strategy for errors that match its name pattern
    errorHandler.registerRecoveryStrategy(
      (errorContext) => {
        // Match based on error type, operation source, or error message
        return strategy.name.includes('file-system') && errorContext.error.code?.startsWith('E') ||
               strategy.name.includes('network') && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(errorContext.error.code) ||
               strategy.name.includes('memory') && errorContext.error.message?.includes('memory') ||
               strategy.name.includes('dependency') && errorContext.error.message?.includes('dependency') ||
               strategy.name.includes('configuration') && errorContext.error.message?.includes('config');
      },
      strategy
    );
  }
  
  logger.info('Registered built-in recovery strategies', {
    count: strategies.length,
    strategies: strategies.map(s => s.name)
  });
}