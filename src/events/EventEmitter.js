/**
 * Core Event Emitter
 * 
 * Simple event emitter implementation for the callback system refactor.
 * Provides basic event registration, emission, and cleanup functionality
 * with error isolation and entity-based cleanup support.
 * 
 * @module events/EventEmitter
 */

import '../../logger.js';

/**
 * Simple event emitter with listener tracking and cleanup
 */
export class EventEmitter {
  constructor() {
    // Map of event name to Map of listener ID to callback
    this.listeners = new Map();
    
    // Map of listener ID to metadata (for cleanup by entity)
    this.listenerMetadata = new Map();
    
    // Counter for generating unique listener IDs
    this.listenerCounter = 0;
  }

  /**
   * Register an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} options - Registration options
   * @param {string} [options.entityId] - Entity ID for cleanup
   * @returns {string} Listener ID for removal
   * 
   * @example
   * const listenerId = emitter.on('window:created', (data) => {
   *   console.log('Window created:', data);
   * });
   */
  on(event, callback, options = {}) {
    if (typeof event !== 'string' || event.trim() === '') {
      throw new Error('Event name must be a non-empty string');
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Generate unique listener ID
    const listenerId = `listener_${++this.listenerCounter}_${Date.now()}`;

    // Initialize event listeners map if needed
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Map());
    }

    // Store the callback
    this.listeners.get(event).set(listenerId, callback);

    // Store metadata for cleanup
    this.listenerMetadata.set(listenerId, {
      event,
      entityId: options.entityId || null,
      createdAt: Date.now()
    });

    console.debug('[EVENT] Listener registered', {
      listenerId,
      event,
      entityId: options.entityId || 'global'
    });

    return listenerId;
  }

  /**
   * Emit an event to all registered listeners
   * 
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @returns {Object} Emission result with error count
   * 
   * @example
   * emitter.emit('window:created', { windowId: 'win-1', width: 800 });
   */
  emit(event, data) {
    const eventListeners = this.listeners.get(event);

    if (!eventListeners || eventListeners.size === 0) {
      console.debug('[EVENT] No listeners for event', { event });
      return { executed: 0, errors: 0 };
    }

    let executed = 0;
    let errors = 0;

    console.debug('[EVENT] Emitting event', {
      event,
      listenerCount: eventListeners.size
    });

    // Execute all listeners with error isolation
    for (const [listenerId, callback] of eventListeners) {
      try {
        callback(data);
        executed++;
      } catch (error) {
        errors++;
        console.error('[EVENT] Error in event listener', {
          listenerId,
          event,
          error: error.message,
          stack: error.stack
        });
        // Continue executing remaining listeners despite error
      }
    }

    console.debug('[EVENT] Event emission complete', {
      event,
      executed,
      errors
    });

    return { executed, errors };
  }

  /**
   * Remove a specific event listener
   * 
   * @param {string} listenerId - Listener ID returned from on()
   * @returns {boolean} True if listener was found and removed
   * 
   * @example
   * const listenerId = emitter.on('window:closed', callback);
   * emitter.off(listenerId);
   */
  off(listenerId) {
    const metadata = this.listenerMetadata.get(listenerId);

    if (!metadata) {
      console.warn('[EVENT] Attempted to remove non-existent listener', {
        listenerId
      });
      return false;
    }

    // Remove from listeners map
    const eventListeners = this.listeners.get(metadata.event);
    if (eventListeners) {
      eventListeners.delete(listenerId);

      // Clean up empty event listener maps
      if (eventListeners.size === 0) {
        this.listeners.delete(metadata.event);
      }
    }

    // Remove metadata
    this.listenerMetadata.delete(listenerId);

    console.debug('[EVENT] Listener removed', {
      listenerId,
      event: metadata.event
    });

    return true;
  }

  /**
   * Remove all listeners for a specific entity
   * 
   * @param {string} entityId - Entity ID
   * @returns {number} Number of listeners removed
   * 
   * @example
   * emitter.cleanup('window-1');
   */
  cleanup(entityId) {
    if (!entityId) {
      console.warn('[EVENT] Cleanup called with empty entityId');
      return 0;
    }

    let removed = 0;

    // Find all listeners for this entity
    const listenersToRemove = [];
    for (const [listenerId, metadata] of this.listenerMetadata) {
      if (metadata.entityId === entityId) {
        listenersToRemove.push(listenerId);
      }
    }

    // Remove each listener
    for (const listenerId of listenersToRemove) {
      if (this.off(listenerId)) {
        removed++;
      }
    }

    console.debug('[EVENT] Entity cleanup complete', {
      entityId,
      removed
    });

    return removed;
  }

  /**
   * Remove all listeners for a specific event
   * 
   * @param {string} event - Event name
   * @returns {number} Number of listeners removed
   * 
   * @example
   * emitter.removeAllListeners('window:created');
   */
  removeAllListeners(event) {
    const eventListeners = this.listeners.get(event);

    if (!eventListeners) {
      return 0;
    }

    const listenerIds = Array.from(eventListeners.keys());
    let removed = 0;

    for (const listenerId of listenerIds) {
      if (this.off(listenerId)) {
        removed++;
      }
    }

    console.debug('[EVENT] All listeners removed for event', {
      event,
      removed
    });

    return removed;
  }

  /**
   * Get count of listeners for an event
   * 
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get total count of all listeners
   * 
   * @returns {number} Total number of listeners
   */
  totalListenerCount() {
    return this.listenerMetadata.size;
  }
}
