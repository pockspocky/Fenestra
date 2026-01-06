/**
 * Hook System for Plugin Extension Points
 * 
 * Provides a mechanism for plugins to register handlers for specific
 * extension points throughout the application. Supports priority-based
 * execution, filtering, and result aggregation.
 */

import { randomUUID } from 'crypto';

export class HookSystem {
  constructor(options = {}) {
    this.hooks = new Map(); // hookName -> Set of registrations
    this.middleware = [];
    this.logger = options.logger;
    this.errorIsolation = options.errorIsolation !== false;
  }

  /**
   * Register a hook handler
   * @param {string} hookName - Hook name
   * @param {Function} handler - Hook handler function
   * @param {Object} options - Registration options
   * @returns {string} Registration ID
   */
  register(hookName, handler, options = {}) {
    const registration = {
      id: randomUUID(),
      hookName,
      handler,
      priority: options.priority || 0,
      pluginId: options.pluginId || 'unknown',
      filter: options.filter || null,
      once: options.once || false,
      metadata: options.metadata || {}
    };

    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }

    this.hooks.get(hookName).add(registration);

    if (this.logger) {
      this.logger.debug('Hook registered', {
        operation: 'registerHook',
        hookName,
        registrationId: registration.id,
        pluginId: registration.pluginId,
        priority: registration.priority
      });
    }

    return registration.id;
  }

  /**
   * Unregister a hook handler
   * @param {string} registrationId - Registration ID
   * @returns {boolean} Whether hook was unregistered
   */
  unregister(registrationId) {
    for (const [hookName, registrations] of this.hooks) {
      for (const registration of registrations) {
        if (registration.id === registrationId) {
          registrations.delete(registration);
          
          if (registrations.size === 0) {
            this.hooks.delete(hookName);
          }

          if (this.logger) {
            this.logger.debug('Hook unregistered', {
              operation: 'unregisterHook',
              hookName,
              registrationId,
              pluginId: registration.pluginId
            });
          }

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Execute all handlers for a hook
   * @param {string} hookName - Hook name
   * @param {any} payload - Hook payload
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Hook execution result
   */
  async execute(hookName, payload, options = {}) {
    const startTime = Date.now();
    
    if (this.logger) {
      this.logger.debug('Executing hook', {
        operation: 'executeHook',
        hookName,
        payload: typeof payload === 'object' ? Object.keys(payload) : typeof payload
      });
    }

    try {
      // Get and sort registrations
      const registrations = this._getApplicableRegistrations(hookName, payload);
      
      if (registrations.length === 0) {
        if (this.logger) {
          this.logger.debug('No handlers for hook', {
            operation: 'executeHook',
            hookName
          });
        }
        return payload;
      }

      // Apply middleware
      const processedPayload = this._applyMiddleware(hookName, payload);

      // Execute handlers based on execution mode
      const executionMode = options.mode || 'sequential';
      let result;

      switch (executionMode) {
        case 'parallel':
          result = await this._executeParallel(registrations, processedPayload);
          break;
        case 'waterfall':
          result = await this._executeWaterfall(registrations, processedPayload);
          break;
        case 'filter':
          result = await this._executeFilter(registrations, processedPayload);
          break;
        case 'reduce':
          result = await this._executeReduce(registrations, processedPayload, options.initialValue);
          break;
        default:
          result = await this._executeSequential(registrations, processedPayload);
      }

      // Remove one-time handlers
      this._removeOneTimeHandlers(registrations);

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.debug('Hook execution completed', {
          operation: 'executeHook',
          hookName,
          handlerCount: registrations.length,
          executionMode,
          duration: `${duration}ms`
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.error('Hook execution failed', {
          operation: 'executeHook',
          hookName,
          duration: `${duration}ms`,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }

      throw error;
    }
  }

  /**
   * Check if a hook has any handlers
   * @param {string} hookName - Hook name
   * @returns {boolean} Whether hook has handlers
   */
  hasHandlers(hookName) {
    const registrations = this.hooks.get(hookName);
    return registrations && registrations.size > 0;
  }

  /**
   * Get handler count for a hook
   * @param {string} hookName - Hook name
   * @returns {number} Number of handlers
   */
  getHandlerCount(hookName) {
    const registrations = this.hooks.get(hookName);
    return registrations ? registrations.size : 0;
  }

  /**
   * Get all registered hook names
   * @returns {string[]} Array of hook names
   */
  getHookNames() {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get handlers for a specific plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Object[]} Array of handler registrations
   */
  getPluginHandlers(pluginId) {
    const handlers = [];
    
    for (const [hookName, registrations] of this.hooks) {
      for (const registration of registrations) {
        if (registration.pluginId === pluginId) {
          handlers.push({
            hookName,
            registrationId: registration.id,
            priority: registration.priority,
            metadata: registration.metadata
          });
        }
      }
    }

    return handlers;
  }

  /**
   * Unregister all handlers for a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {number} Number of handlers unregistered
   */
  unregisterPlugin(pluginId) {
    let count = 0;
    
    for (const [hookName, registrations] of this.hooks) {
      const toRemove = [];
      
      for (const registration of registrations) {
        if (registration.pluginId === pluginId) {
          toRemove.push(registration);
        }
      }
      
      for (const registration of toRemove) {
        registrations.delete(registration);
        count++;
      }
      
      if (registrations.size === 0) {
        this.hooks.delete(hookName);
      }
    }

    if (this.logger && count > 0) {
      this.logger.debug('Plugin handlers unregistered', {
        operation: 'unregisterPlugin',
        pluginId,
        handlerCount: count
      });
    }

    return count;
  }

  /**
   * Add middleware to the hook system
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Get hook system statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const hookStats = {};
    const pluginStats = {};
    
    for (const [hookName, registrations] of this.hooks) {
      hookStats[hookName] = registrations.size;
      
      for (const registration of registrations) {
        const pluginId = registration.pluginId;
        pluginStats[pluginId] = (pluginStats[pluginId] || 0) + 1;
      }
    }

    return {
      totalHooks: this.hooks.size,
      totalHandlers: Array.from(this.hooks.values()).reduce((sum, regs) => sum + regs.size, 0),
      hookStats,
      pluginStats,
      middlewareCount: this.middleware.length
    };
  }

  /**
   * Clear all hooks (useful for testing)
   */
  clear() {
    this.hooks.clear();
    this.middleware = [];
  }

  /**
   * Get applicable registrations for a hook
   * @private
   */
  _getApplicableRegistrations(hookName, payload) {
    const registrations = this.hooks.get(hookName);
    if (!registrations) {
      return [];
    }

    const applicable = [];
    
    for (const registration of registrations) {
      // Apply filter if present
      if (registration.filter && !registration.filter(payload)) {
        continue;
      }
      
      applicable.push(registration);
    }

    // Sort by priority (descending)
    applicable.sort((a, b) => b.priority - a.priority);
    
    return applicable;
  }

  /**
   * Apply middleware to hook payload
   * @private
   */
  _applyMiddleware(hookName, payload) {
    return this.middleware.reduce((processedPayload, middleware) => {
      try {
        return middleware(hookName, processedPayload) || processedPayload;
      } catch (error) {
        if (this.logger) {
          this.logger.error('Hook middleware error', {
            hookName,
            error: error.message
          });
        }
        return processedPayload;
      }
    }, payload);
  }

  /**
   * Execute handlers sequentially
   * @private
   */
  async _executeSequential(registrations, payload) {
    let result = payload;
    
    for (const registration of registrations) {
      try {
        const handlerResult = await registration.handler(result);
        if (handlerResult !== undefined) {
          result = handlerResult;
        }
      } catch (error) {
        if (this.errorIsolation) {
          if (this.logger) {
            this.logger.error('Hook handler error (isolated)', {
              hookName: registration.hookName,
              pluginId: registration.pluginId,
              error: error.message
            });
          }
        } else {
          throw error;
        }
      }
    }
    
    return result;
  }

  /**
   * Execute handlers in parallel
   * @private
   */
  async _executeParallel(registrations, payload) {
    const promises = registrations.map(async (registration) => {
      try {
        return await registration.handler(payload);
      } catch (error) {
        if (this.errorIsolation) {
          if (this.logger) {
            this.logger.error('Hook handler error (isolated)', {
              hookName: registration.hookName,
              pluginId: registration.pluginId,
              error: error.message
            });
          }
          return undefined;
        } else {
          throw error;
        }
      }
    });

    const results = await Promise.all(promises);
    return results.filter(result => result !== undefined);
  }

  /**
   * Execute handlers as waterfall (each result feeds into next)
   * @private
   */
  async _executeWaterfall(registrations, payload) {
    return this._executeSequential(registrations, payload);
  }

  /**
   * Execute handlers as filter (boolean results)
   * @private
   */
  async _executeFilter(registrations, payload) {
    for (const registration of registrations) {
      try {
        const result = await registration.handler(payload);
        if (!result) {
          return false;
        }
      } catch (error) {
        if (this.errorIsolation) {
          if (this.logger) {
            this.logger.error('Hook handler error (isolated)', {
              hookName: registration.hookName,
              pluginId: registration.pluginId,
              error: error.message
            });
          }
          return false;
        } else {
          throw error;
        }
      }
    }
    
    return true;
  }

  /**
   * Execute handlers as reduce operation
   * @private
   */
  async _executeReduce(registrations, payload, initialValue) {
    let accumulator = initialValue !== undefined ? initialValue : payload;
    
    for (const registration of registrations) {
      try {
        accumulator = await registration.handler(accumulator, payload);
      } catch (error) {
        if (this.errorIsolation) {
          if (this.logger) {
            this.logger.error('Hook handler error (isolated)', {
              hookName: registration.hookName,
              pluginId: registration.pluginId,
              error: error.message
            });
          }
        } else {
          throw error;
        }
      }
    }
    
    return accumulator;
  }

  /**
   * Remove one-time handlers after execution
   * @private
   */
  _removeOneTimeHandlers(registrations) {
    for (const registration of registrations) {
      if (registration.once) {
        this.unregister(registration.id);
      }
    }
  }
}