/**
 * Event Bus Implementation
 * 
 * Generic event system for decoupled communication between components.
 * Supports pattern matching, middleware, and priority-based handler execution.
 */

import { randomUUID } from 'crypto';

export class EventBus {
  constructor(options = {}) {
    this.handlers = new Map(); // event pattern -> Set of handlers
    this.middleware = [];
    this.errorIsolation = options.errorIsolation !== false; // Default to true
    this.maxListeners = options.maxListeners || 100;
  }

  /**
   * Subscribe to events with pattern matching
   * @param {string|RegExp} pattern - Event pattern to match
   * @param {Function} handler - Event handler function
   * @param {Object} options - Subscription options
   * @returns {string} Subscription ID for unsubscribing
   */
  on(pattern, handler, options = {}) {
    const subscription = {
      id: randomUUID(),
      pattern,
      handler,
      priority: options.priority || 0,
      once: options.once || false,
      metadata: options.metadata || {}
    };

    const patternKey = this._getPatternKey(pattern);
    
    if (!this.handlers.has(patternKey)) {
      this.handlers.set(patternKey, new Set());
    }

    const handlers = this.handlers.get(patternKey);
    
    // Check max listeners limit
    if (handlers.size >= this.maxListeners) {
      throw new Error(`Maximum number of listeners (${this.maxListeners}) exceeded for pattern: ${patternKey}`);
    }

    handlers.add(subscription);
    return subscription.id;
  }

  /**
   * Subscribe to events (alias for on)
   * @param {string|RegExp} pattern - Event pattern to match
   * @param {Function} handler - Event handler function
   * @param {Object} options - Subscription options
   * @returns {string} Subscription ID
   */
  subscribe(pattern, handler, options = {}) {
    return this.on(pattern, handler, options);
  }

  /**
   * Subscribe to events once (auto-unsubscribe after first match)
   * @param {string|RegExp} pattern - Event pattern to match
   * @param {Function} handler - Event handler function
   * @param {Object} options - Subscription options
   * @returns {string} Subscription ID
   */
  once(pattern, handler, options = {}) {
    return this.on(pattern, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from events
   * @param {string} subscriptionId - Subscription ID returned by on/subscribe
   * @returns {boolean} Whether the subscription was found and removed
   */
  off(subscriptionId) {
    for (const [patternKey, handlers] of this.handlers) {
      for (const subscription of handlers) {
        if (subscription.id === subscriptionId) {
          handlers.delete(subscription);
          if (handlers.size === 0) {
            this.handlers.delete(patternKey);
          }
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Unsubscribe from events (alias for off)
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} Whether the subscription was removed
   */
  unsubscribe(subscriptionId) {
    return this.off(subscriptionId);
  }

  /**
   * Emit an event to all matching handlers
   * @param {string} eventType - Event type/name
   * @param {any} data - Event data
   * @param {Object} metadata - Additional event metadata
   * @returns {Promise<Object>} Event emission result
   */
  async emit(eventType, data = null, metadata = {}) {
    const event = this._createEvent(eventType, data, metadata);
    
    // Apply middleware pipeline
    const processedEvent = await this._applyMiddleware(event);
    
    // Find matching handlers
    const matchingHandlers = this._findMatchingHandlers(eventType);
    
    // Sort handlers by priority (descending)
    matchingHandlers.sort((a, b) => b.priority - a.priority);
    
    // Execute handlers
    const results = await this._executeHandlers(matchingHandlers, processedEvent);
    
    // Remove one-time handlers
    this._removeOneTimeHandlers(matchingHandlers);
    
    return {
      eventType,
      handlersExecuted: results.length,
      results,
      event: processedEvent
    };
  }

  /**
   * Add middleware to the event processing pipeline
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware from the pipeline
   * @param {Function} middleware - Middleware function to remove
   */
  removeMiddleware(middleware) {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
    }
  }

  /**
   * Get all event patterns that have handlers
   * @returns {string[]} Array of event patterns
   */
  getEventPatterns() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for a specific pattern
   * @param {string|RegExp} pattern - Event pattern
   * @returns {number} Number of handlers
   */
  getHandlerCount(pattern) {
    const patternKey = this._getPatternKey(pattern);
    const handlers = this.handlers.get(patternKey);
    return handlers ? handlers.size : 0;
  }

  /**
   * Get total handler count across all patterns
   * @returns {number} Total number of handlers
   */
  getTotalHandlerCount() {
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear() {
    this.handlers.clear();
    this.middleware = [];
  }

  /**
   * Get event bus statistics
   * @returns {Object} Statistics about the event bus
   */
  getStats() {
    const patternCounts = {};
    for (const [pattern, handlers] of this.handlers) {
      patternCounts[pattern] = handlers.size;
    }

    return {
      totalPatterns: this.handlers.size,
      totalHandlers: this.getTotalHandlerCount(),
      patternCounts,
      middlewareCount: this.middleware.length,
      maxListeners: this.maxListeners
    };
  }

  /**
   * Create an event object
   * @private
   */
  _createEvent(eventType, data, metadata) {
    return {
      type: eventType,
      timestamp: Date.now(),
      data,
      metadata: {
        source: 'EventBus',
        ...metadata
      },
      id: randomUUID()
    };
  }

  /**
   * Apply middleware pipeline to event
   * @private
   */
  async _applyMiddleware(event) {
    let processedEvent = event;
    
    for (const middleware of this.middleware) {
      try {
        const result = await middleware(processedEvent);
        if (result) {
          processedEvent = result;
        }
      } catch (error) {
        console.error('[EventBus] Middleware error:', error);
        // Continue with original event if middleware fails
      }
    }
    
    return processedEvent;
  }

  /**
   * Find handlers that match the event type
   * @private
   */
  _findMatchingHandlers(eventType) {
    const matchingHandlers = [];
    
    for (const [patternKey, handlers] of this.handlers) {
      if (this._matchesPattern(eventType, patternKey)) {
        matchingHandlers.push(...handlers);
      }
    }
    
    return matchingHandlers;
  }

  /**
   * Check if event type matches pattern
   * @private
   */
  _matchesPattern(eventType, patternKey) {
    // Handle RegExp patterns
    if (patternKey.startsWith('regexp:')) {
      const regexpStr = patternKey.substring(7);
      const regexp = new RegExp(regexpStr);
      return regexp.test(eventType);
    }
    
    // Handle wildcard patterns
    if (patternKey.includes('*')) {
      const regexpStr = patternKey
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regexp = new RegExp(`^${regexpStr}$`);
      return regexp.test(eventType);
    }
    
    // Exact match
    return eventType === patternKey;
  }

  /**
   * Execute handlers with error isolation
   * @private
   */
  async _executeHandlers(handlers, event) {
    const results = [];
    
    for (const subscription of handlers) {
      try {
        const result = await subscription.handler(event);
        results.push({
          subscriptionId: subscription.id,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          subscriptionId: subscription.id,
          success: false,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
        
        if (this.errorIsolation) {
          console.error(`[EventBus] Handler error in ${subscription.id}:`, error);
        } else {
          throw error;
        }
      }
    }
    
    return results;
  }

  /**
   * Remove one-time handlers after execution
   * @private
   */
  _removeOneTimeHandlers(handlers) {
    for (const subscription of handlers) {
      if (subscription.once) {
        this.off(subscription.id);
      }
    }
  }

  /**
   * Get pattern key for storage
   * @private
   */
  _getPatternKey(pattern) {
    if (pattern instanceof RegExp) {
      return `regexp:${pattern.source}`;
    }
    return pattern.toString();
  }
}