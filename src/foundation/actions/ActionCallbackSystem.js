/**
 * Universal Action Callback System
 * 
 * Provides universal tracking and callback execution for all significant
 * operations in the system. Supports priority-based execution, error isolation,
 * and structured action context.
 */

import { randomUUID } from 'crypto';

export class ActionCallbackSystem {
  constructor(options = {}) {
    this.callbacks = new Map(); // action -> Set of callbacks
    this.globalCallbacks = new Set(); // Global callbacks for all actions
    this.middleware = [];
    this.currentAction = null;
    this.actionStack = []; // For nested actions
    this.errorIsolation = options.errorIsolation !== false; // Default to true
    this.defaultCallback = options.defaultCallback || this._defaultLoggingCallback;
  }

  /**
   * Register a callback for a specific action or globally
   * @param {string|null} action - Action name, or null for global callbacks
   * @param {Function} callback - Callback function
   * @param {Object} options - Registration options
   * @returns {string} Registration ID for unregistering
   */
  register(action, callback, options = {}) {
    const registration = {
      id: randomUUID(),
      callback,
      priority: options.priority || 0,
      phase: options.phase || 'all', // 'before', 'after', 'error', 'all'
      once: options.once || false,
      metadata: options.metadata || {}
    };

    if (action === null || action === undefined) {
      // Global callback
      this.globalCallbacks.add(registration);
    } else {
      // Action-specific callback
      if (!this.callbacks.has(action)) {
        this.callbacks.set(action, new Set());
      }
      this.callbacks.get(action).add(registration);
    }

    return registration.id;
  }

  /**
   * Unregister a callback by its registration ID
   * @param {string} registrationId - Registration ID returned by register()
   */
  unregister(registrationId) {
    // Check global callbacks
    for (const registration of this.globalCallbacks) {
      if (registration.id === registrationId) {
        this.globalCallbacks.delete(registration);
        return true;
      }
    }

    // Check action-specific callbacks
    for (const [action, callbacks] of this.callbacks) {
      for (const registration of callbacks) {
        if (registration.id === registrationId) {
          callbacks.delete(registration);
          if (callbacks.size === 0) {
            this.callbacks.delete(action);
          }
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Execute an action with callback support
   * @param {string} action - Action name
   * @param {Function} operation - Operation to execute
   * @param {Object} context - Additional context data
   * @returns {Promise<any>} Result of the operation
   */
  async execute(action, operation, context = {}) {
    const actionContext = this._createActionContext(action, context);
    
    try {
      // Execute before callbacks
      await this._executeCallbacks(action, 'before', actionContext);
      
      // Execute the operation
      const startTime = Date.now();
      const result = await operation(actionContext);
      const duration = Date.now() - startTime;
      
      // Update context with result and duration
      actionContext.success = true;
      actionContext.result = result;
      actionContext.duration = duration;
      actionContext.phase = 'after';
      
      // Execute after callbacks
      await this._executeCallbacks(action, 'after', actionContext);
      
      return result;
    } catch (error) {
      // Update context with error information
      actionContext.success = false;
      actionContext.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
      actionContext.phase = 'error';
      
      // Execute error callbacks
      await this._executeCallbacks(action, 'error', actionContext);
      
      throw error;
    } finally {
      this._popActionContext();
    }
  }

  /**
   * Trigger callbacks for an action without executing an operation
   * @param {string} action - Action name
   * @param {string} phase - Phase ('before', 'after', 'error')
   * @param {Object} context - Action context
   */
  async trigger(action, phase, context = {}) {
    const actionContext = this._createActionContext(action, { ...context, phase });
    
    try {
      await this._executeCallbacks(action, phase, actionContext);
    } finally {
      this._popActionContext();
    }
  }

  /**
   * Add middleware to the action callback system
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Get the current action context (if any)
   * @returns {Object|null} Current action context
   */
  getCurrentAction() {
    return this.currentAction;
  }

  /**
   * Get statistics about registered callbacks
   * @returns {Object} Statistics
   */
  getStats() {
    const actionCallbackCounts = {};
    for (const [action, callbacks] of this.callbacks) {
      actionCallbackCounts[action] = callbacks.size;
    }

    return {
      totalActions: this.callbacks.size,
      globalCallbacks: this.globalCallbacks.size,
      actionCallbackCounts,
      middlewareCount: this.middleware.length,
      currentAction: this.currentAction?.action || null
    };
  }

  /**
   * Clear all callbacks (useful for testing)
   */
  clear() {
    this.callbacks.clear();
    this.globalCallbacks.clear();
    this.middleware = [];
    this.currentAction = null;
    this.actionStack = [];
  }

  /**
   * Create action context for callback execution
   * @private
   */
  _createActionContext(action, context) {
    const actionContext = {
      action,
      timestamp: Date.now(),
      correlationId: randomUUID(),
      source: context.source || 'unknown',
      phase: context.phase || 'before',
      data: context.data || {},
      metadata: context.metadata || {},
      ...context
    };

    // Push to action stack for nested action support
    this.actionStack.push(this.currentAction);
    this.currentAction = actionContext;

    return actionContext;
  }

  /**
   * Pop action context from stack
   * @private
   */
  _popActionContext() {
    this.currentAction = this.actionStack.pop();
  }

  /**
   * Execute callbacks for a specific action and phase
   * @private
   */
  async _executeCallbacks(action, phase, actionContext) {
    // Apply middleware first
    const processedContext = this._applyMiddleware(actionContext);
    
    // Collect all applicable callbacks
    const callbacks = this._collectCallbacks(action, phase);
    
    // Sort by priority (descending)
    callbacks.sort((a, b) => b.priority - a.priority);
    
    // Execute callbacks with error isolation
    const callbackPromises = callbacks.map(registration => 
      this._executeCallback(registration, processedContext)
    );

    if (this.errorIsolation) {
      // Execute all callbacks, isolating errors
      await Promise.allSettled(callbackPromises);
    } else {
      // Execute all callbacks, failing fast on errors
      await Promise.all(callbackPromises);
    }

    // Remove one-time callbacks
    this._removeOneTimeCallbacks(callbacks);
  }

  /**
   * Collect all callbacks that should execute for an action and phase
   * @private
   */
  _collectCallbacks(action, phase) {
    const callbacks = [];

    // Add action-specific callbacks
    const actionCallbacks = this.callbacks.get(action);
    if (actionCallbacks) {
      for (const registration of actionCallbacks) {
        if (this._shouldExecuteCallback(registration, phase)) {
          callbacks.push(registration);
        }
      }
    }

    // Add global callbacks
    for (const registration of this.globalCallbacks) {
      if (this._shouldExecuteCallback(registration, phase)) {
        callbacks.push(registration);
      }
    }

    // Add default callback if no specific callbacks are registered
    if (callbacks.length === 0 && this.defaultCallback) {
      callbacks.push({
        id: 'default',
        callback: this.defaultCallback,
        priority: -1000,
        phase: 'all',
        once: false
      });
    }

    return callbacks;
  }

  /**
   * Check if a callback should execute for the given phase
   * @private
   */
  _shouldExecuteCallback(registration, phase) {
    return registration.phase === 'all' || registration.phase === phase;
  }

  /**
   * Execute a single callback with error handling
   * @private
   */
  async _executeCallback(registration, actionContext) {
    try {
      await registration.callback(actionContext);
    } catch (error) {
      // Log callback errors but don't let them break the system
      console.error(`[ActionCallbackSystem] Callback error in ${registration.id}:`, error);
      
      if (!this.errorIsolation) {
        throw error;
      }
    }
  }

  /**
   * Apply middleware to action context
   * @private
   */
  _applyMiddleware(actionContext) {
    return this.middleware.reduce((context, middleware) => {
      try {
        return middleware(context) || context;
      } catch (error) {
        console.error('[ActionCallbackSystem] Middleware error:', error);
        return context;
      }
    }, actionContext);
  }

  /**
   * Remove one-time callbacks after execution
   * @private
   */
  _removeOneTimeCallbacks(callbacks) {
    for (const registration of callbacks) {
      if (registration.once) {
        this.unregister(registration.id);
      }
    }
  }

  /**
   * Default logging callback for actions
   * @private
   */
  _defaultLoggingCallback(actionContext) {
    const { action, phase, source, duration, success, error } = actionContext;
    
    if (phase === 'before') {
      console.debug(`[ACTION] Starting ${action} from ${source}`);
    } else if (phase === 'after') {
      console.debug(`[ACTION] Completed ${action} from ${source} in ${duration}ms`);
    } else if (phase === 'error') {
      console.error(`[ACTION] Failed ${action} from ${source}:`, error?.message);
    }
  }
}