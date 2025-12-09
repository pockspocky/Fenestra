/**
 * Callback Registry System
 * 
 * Centralized system for managing and executing callbacks for various events
 * throughout the application. Supports entity-specific and global callbacks,
 * priority-based execution, and preventDefault mechanism.
 * 
 * @module callbackRegistry
 */

import '../../logger.js';

/**
 * Custom error for validation failures
 */
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Central callback registry for managing event callbacks
 */
class CallbackRegistry {
  constructor() {
    // Map of registration ID to callback registration
    this.registrations = new Map();
    
    // Map of event type to Set of registration IDs
    this.eventTypeIndex = new Map();
    
    // Map of entity ID to Set of registration IDs
    this.entityIndex = new Map();
    
    // Counter for generating unique registration IDs
    this.registrationCounter = 0;
  }

  /**
   * Register a callback for an event
   * 
   * @param {string} eventType - Event type identifier
   * @param {Function} callback - Callback function to execute
   * @param {Object} options - Registration options
   * @param {string} [options.entityId] - Entity ID for entity-specific callback
   * @param {number} [options.priority=0] - Execution priority (higher executes first)
   * @param {boolean} [options.once=false] - Execute only once then auto-unregister
   * @returns {string} Registration ID for unregistering
   * @throws {ValidationError} When parameters are invalid
   * 
   * @example
   * // Register global callback
   * const regId = registry.register('window-created', (eventType, eventData) => {
   *   console.log('Window created:', eventData.entityId);
   * });
   * 
   * @example
   * // Register entity-specific callback with priority
   * const regId = registry.register('door-opened', callback, {
   *   entityId: 'door-1',
   *   priority: 10
   * });
   */
  register(eventType, callback, options = {}) {
    // Validate parameters
    if (!eventType || typeof eventType !== 'string' || eventType.trim() === '') {
      throw new ValidationError('Event type must be a non-empty string', {
        provided: eventType
      });
    }

    if (typeof callback !== 'function') {
      throw new ValidationError('Callback must be a function', {
        provided: typeof callback
      });
    }

    if (options.priority !== undefined && typeof options.priority !== 'number') {
      throw new ValidationError('Priority must be a number', {
        provided: options.priority
      });
    }

    // Generate unique registration ID
    const registrationId = `reg_${++this.registrationCounter}_${Date.now()}`;

    // Create registration object
    const registration = {
      id: registrationId,
      eventType,
      callback,
      entityId: options.entityId || null,
      priority: options.priority !== undefined ? options.priority : 0,
      once: options.once || false,
      createdAt: Date.now()
    };

    // Store registration
    this.registrations.set(registrationId, registration);

    // Index by event type
    if (!this.eventTypeIndex.has(eventType)) {
      this.eventTypeIndex.set(eventType, new Set());
    }
    this.eventTypeIndex.get(eventType).add(registrationId);

    // Index by entity ID if provided
    if (registration.entityId) {
      if (!this.entityIndex.has(registration.entityId)) {
        this.entityIndex.set(registration.entityId, new Set());
      }
      this.entityIndex.get(registration.entityId).add(registrationId);
    }

    console.debug('[CALLBACK] Callback registered', {
      registrationId,
      eventType,
      entityId: registration.entityId,
      priority: registration.priority,
      once: registration.once
    });

    return registrationId;
  }

  /**
   * Unregister a callback
   * 
   * @param {string} registrationId - Registration ID returned from register()
   * @returns {boolean} True if callback was found and removed, false otherwise
   * 
   * @example
   * const regId = registry.register('window-closed', callback);
   * registry.unregister(regId);
   */
  unregister(registrationId) {
    const registration = this.registrations.get(registrationId);
    
    if (!registration) {
      console.warn('[CALLBACK] Attempted to unregister non-existent callback', {
        registrationId
      });
      return false;
    }

    // Remove from main registry
    this.registrations.delete(registrationId);

    // Remove from event type index
    const eventTypeSet = this.eventTypeIndex.get(registration.eventType);
    if (eventTypeSet) {
      eventTypeSet.delete(registrationId);
      if (eventTypeSet.size === 0) {
        this.eventTypeIndex.delete(registration.eventType);
      }
    }

    // Remove from entity index
    if (registration.entityId) {
      const entitySet = this.entityIndex.get(registration.entityId);
      if (entitySet) {
        entitySet.delete(registrationId);
        if (entitySet.size === 0) {
          this.entityIndex.delete(registration.entityId);
        }
      }
    }

    console.debug('[CALLBACK] Callback unregistered', {
      registrationId,
      eventType: registration.eventType,
      entityId: registration.entityId
    });

    return true;
  }

  /**
   * Execute callbacks for an event
   * 
   * @param {string} eventType - Event type identifier
   * @param {Object} eventData - Event data
   * @param {string} [eventData.entityId] - Entity ID
   * @param {number} [eventData.timestamp] - Event timestamp
   * @param {string} [eventData.source] - Source identifier
   * @param {*} [eventData.data] - Event-specific data
   * @param {*} [eventData.previousState] - Previous state for state-change events
   * @returns {Object} Execution result with preventDefault flag and errors
   * 
   * @example
   * const result = registry.execute('window-created', {
   *   entityId: 'window-1',
   *   timestamp: Date.now(),
   *   source: 'windowManager',
   *   data: { width: 800, height: 600 }
   * });
   */
  execute(eventType, eventData = {}) {
    // Ensure required context fields
    const context = {
      eventType,
      entityId: eventData.entityId || null,
      timestamp: eventData.timestamp || Date.now(),
      source: eventData.source || 'unknown',
      data: eventData.data || {},
      previousState: eventData.previousState
    };

    // Get all relevant callbacks
    const callbacks = this._getCallbacksForEvent(eventType, context.entityId);

    const result = {
      executed: 0,
      prevented: false,
      errors: []
    };

    console.debug('[CALLBACK] Executing callbacks', {
      eventType,
      entityId: context.entityId,
      callbackCount: callbacks.length
    });

    // Execute callbacks in priority order
    for (const registration of callbacks) {
      try {
        const callbackResult = registration.callback(eventType, context);

        result.executed++;

        // Check for preventDefault
        if (callbackResult === false || 
            (callbackResult && callbackResult.preventDefault === true)) {
          result.prevented = true;
          console.debug('[CALLBACK] Default behavior prevented', {
            registrationId: registration.id,
            eventType,
            entityId: context.entityId
          });
        }

        // Handle once-only callbacks
        if (registration.once) {
          this.unregister(registration.id);
        }

      } catch (error) {
        result.errors.push(error);
        console.error('[CALLBACK] Error in callback execution', {
          registrationId: registration.id,
          eventType,
          entityId: context.entityId,
          error: error.message,
          stack: error.stack
        });
        // Continue executing remaining callbacks despite error
      }
    }

    console.debug('[CALLBACK] Execution complete', {
      eventType,
      entityId: context.entityId,
      executed: result.executed,
      prevented: result.prevented,
      errors: result.errors.length
    });

    return result;
  }

  /**
   * Get callbacks for an event, sorted by priority
   * Entity-specific callbacks execute before global callbacks
   * 
   * @private
   * @param {string} eventType - Event type
   * @param {string|null} entityId - Entity ID
   * @returns {Array} Sorted array of callback registrations
   */
  _getCallbacksForEvent(eventType, entityId) {
    const registrationIds = this.eventTypeIndex.get(eventType);
    
    if (!registrationIds || registrationIds.size === 0) {
      return [];
    }

    const callbacks = [];

    for (const regId of registrationIds) {
      const registration = this.registrations.get(regId);
      
      if (!registration) {
        continue;
      }

      // Include if it's a global callback or matches the entity
      if (registration.entityId === null || registration.entityId === entityId) {
        callbacks.push(registration);
      }
    }

    // Sort by: entity-specific first, then by priority (descending), then by creation time
    callbacks.sort((a, b) => {
      // Entity-specific callbacks execute before global callbacks
      if (a.entityId !== null && b.entityId === null) {
        return -1;
      }
      if (a.entityId === null && b.entityId !== null) {
        return 1;
      }

      // Higher priority executes first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Earlier registration executes first (for equal priority)
      return a.createdAt - b.createdAt;
    });

    return callbacks;
  }

  /**
   * Clear all callbacks for a specific entity
   * 
   * @param {string} entityId - Entity ID
   * @returns {number} Number of callbacks removed
   * 
   * @example
   * registry.clearEntity('window-1');
   */
  clearEntity(entityId) {
    const entitySet = this.entityIndex.get(entityId);
    
    if (!entitySet) {
      return 0;
    }

    const registrationIds = Array.from(entitySet);
    let removed = 0;

    for (const regId of registrationIds) {
      if (this.unregister(regId)) {
        removed++;
      }
    }

    console.debug('[CALLBACK] Cleared entity callbacks', {
      entityId,
      removed
    });

    return removed;
  }

  /**
   * Clear all callbacks for a specific event type
   * 
   * @param {string} eventType - Event type
   * @returns {number} Number of callbacks removed
   * 
   * @example
   * registry.clearEventType('window-created');
   */
  clearEventType(eventType) {
    const eventTypeSet = this.eventTypeIndex.get(eventType);
    
    if (!eventTypeSet) {
      return 0;
    }

    const registrationIds = Array.from(eventTypeSet);
    let removed = 0;

    for (const regId of registrationIds) {
      if (this.unregister(regId)) {
        removed++;
      }
    }

    console.debug('[CALLBACK] Cleared event type callbacks', {
      eventType,
      removed
    });

    return removed;
  }

  /**
   * Get count of registered callbacks
   * 
   * @returns {number} Total number of registered callbacks
   */
  getCallbackCount() {
    return this.registrations.size;
  }

  /**
   * Get count of callbacks for a specific event type
   * 
   * @param {string} eventType - Event type
   * @returns {number} Number of callbacks for event type
   */
  getEventTypeCallbackCount(eventType) {
    const eventTypeSet = this.eventTypeIndex.get(eventType);
    return eventTypeSet ? eventTypeSet.size : 0;
  }

  /**
   * Get count of callbacks for a specific entity
   * 
   * @param {string} entityId - Entity ID
   * @returns {number} Number of callbacks for entity
   */
  getEntityCallbackCount(entityId) {
    const entitySet = this.entityIndex.get(entityId);
    return entitySet ? entitySet.size : 0;
  }
}

// Export singleton instance
export const callbackRegistry = new CallbackRegistry();

// Export class for testing
export { CallbackRegistry };
