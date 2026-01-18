/**
 * Callback Registry System
 * 
 * @deprecated This module is deprecated. Use the new event system instead:
 * - Import { systemEvents } from './events/systemEvents.js' for game/window/door events
 * - Import { domainEvents } from './events/domainEvents.js' for email/lens/fs events
 * 
 * This module now wraps the new event system for backward compatibility.
 * It will be removed in a future version.
 * 
 * @module callbackRegistry
 */

import '../../logger.js';
import * as compat from '../events/compatibilityLayer.js';

console.warn('[DEPRECATED] callbackRegistry is deprecated. Please migrate to the new event system.');

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
 * 
 * @deprecated Use systemEvents or domainEvents directly
 */
class CallbackRegistry {
  constructor() {
    console.warn('[DEPRECATED] CallbackRegistry is deprecated. Use systemEvents or domainEvents instead.');
  }

  /**
   * Register a callback for an event
   * 
   * @deprecated Use systemEvents.on() or domainEvents.on() instead
   */
  register(eventType, callback, options = {}) {
    console.warn('[DEPRECATED] callbackRegistry.register() is deprecated. Use systemEvents.on() or domainEvents.on()');
    return compat.register(eventType, callback, options);
  }

  /**
   * Unregister a callback
   * 
   * @deprecated Use emitter.off() instead
   */
  unregister(registrationId) {
    console.warn('[DEPRECATED] callbackRegistry.unregister() is deprecated. Use emitter.off()');
    return compat.unregister(registrationId);
  }

  /**
   * Execute callbacks for an event
   * 
   * @deprecated Use emitter.emit() instead
   */
  execute(eventType, eventData = {}) {
    console.warn('[DEPRECATED] callbackRegistry.execute() is deprecated. Use emitter.emit()');
    return compat.execute(eventType, eventData);
  }

  /**
   * Clear all callbacks for a specific entity
   * 
   * @deprecated Use emitter.cleanup() instead
   */
  clearEntity(entityId) {
    console.warn('[DEPRECATED] callbackRegistry.clearEntity() is deprecated. Use emitter.cleanup()');
    return compat.clearEntity(entityId);
  }

  /**
   * Clear all callbacks for a specific event type
   * 
   * @deprecated Use emitter.removeAllListeners() instead
   */
  clearEventType(eventType) {
    console.warn('[DEPRECATED] callbackRegistry.clearEventType() is deprecated. Use emitter.removeAllListeners()');
    return compat.clearEventType(eventType);
  }

  /**
   * Get count of registered callbacks
   * 
   * @deprecated Use emitter.totalListenerCount() instead
   */
  getCallbackCount() {
    return compat.getCallbackCount();
  }

  /**
   * Get count of callbacks for a specific event type
   * 
   * @deprecated Use emitter.listenerCount() instead
   */
  getEventTypeCallbackCount(eventType) {
    return compat.getEventTypeCallbackCount(eventType);
  }

  /**
   * Get count of callbacks for a specific entity
   * 
   * @deprecated Not supported in new event system
   */
  getEntityCallbackCount(entityId) {
    return compat.getEntityCallbackCount(entityId);
  }

  // Private methods removed - not needed in compatibility wrapper
  _getCallbacksForEvent() {
    throw new Error('Private method not available in compatibility mode');
  }
}

// Export singleton instance
export const callbackRegistry = new CallbackRegistry();

// Export class for testing
export { CallbackRegistry };
