/**
 * Door-Key Callbacks Integration Module
 * 
 * Provides callback integration for door-key system events including
 * door opening, closing, key usage, access denial, and state changes.
 * 
 * @module callbacks/doorKeyCallbacks
 */

import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

/**
 * Door-key event types
 */
export const DOOR_KEY_EVENTS = {
  DOOR_OPENED: 'door-opened',
  DOOR_CLOSED: 'door-closed',
  KEY_USED: 'key-used',
  ACCESS_DENIED: 'access-denied',
  DOOR_STATE_CHANGED: 'door-state-changed'
};

/**
 * Register a callback for door opened events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Door ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global door opened callback
 * const regId = registerDoorOpenedCallback((eventType, eventData) => {
 *   console.log('Door opened:', eventData.entityId);
 * });
 * 
 * @example
 * // Register entity-specific callback with priority
 * const regId = registerDoorOpenedCallback(
 *   (eventType, eventData) => {
 *     console.log('Specific door opened with key:', eventData.data.keyId);
 *   },
 *   { entityId: 'door-1', priority: 10 }
 * );
 */
export function registerDoorOpenedCallback(callback, options = {}) {
  return callbackRegistry.register(DOOR_KEY_EVENTS.DOOR_OPENED, callback, options);
}

/**
 * Register a callback for door closed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Door ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerDoorClosedCallback((eventType, eventData) => {
 *   console.log('Door closed:', eventData.entityId);
 * });
 */
export function registerDoorClosedCallback(callback, options = {}) {
  return callbackRegistry.register(DOOR_KEY_EVENTS.DOOR_CLOSED, callback, options);
}

/**
 * Register a callback for key used events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Key ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerKeyUsedCallback((eventType, eventData) => {
 *   console.log('Key used:', eventData.entityId, 'on door:', eventData.data.doorId);
 * });
 */
export function registerKeyUsedCallback(callback, options = {}) {
  return callbackRegistry.register(DOOR_KEY_EVENTS.KEY_USED, callback, options);
}

/**
 * Register a callback for access denied events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Door ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerAccessDeniedCallback((eventType, eventData) => {
 *   console.log('Access denied:', eventData.data.reason);
 * });
 */
export function registerAccessDeniedCallback(callback, options = {}) {
  return callbackRegistry.register(DOOR_KEY_EVENTS.ACCESS_DENIED, callback, options);
}

/**
 * Register a callback for door state changed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Door ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerDoorStateChangedCallback((eventType, eventData) => {
 *   console.log('Door state changed from', eventData.previousState, 'to', eventData.data.newState);
 * });
 */
export function registerDoorStateChangedCallback(callback, options = {}) {
  return callbackRegistry.register(DOOR_KEY_EVENTS.DOOR_STATE_CHANGED, callback, options);
}

/**
 * Unregister a door-key callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerDoorOpenedCallback(callback);
 * unregisterDoorKeyCallback(regId);
 */
export function unregisterDoorKeyCallback(registrationId) {
  return callbackRegistry.unregister(registrationId);
}

/**
 * Clear all callbacks for a specific door
 * 
 * @param {string} doorId - Door ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearDoorCallbacks('door-1');
 */
export function clearDoorCallbacks(doorId) {
  return callbackRegistry.clearEntity(doorId);
}

/**
 * Clear all callbacks for a specific key
 * 
 * @param {string} keyId - Key ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearKeyCallbacks('key-1');
 */
export function clearKeyCallbacks(keyId) {
  return callbackRegistry.clearEntity(keyId);
}

/**
 * Trigger door opened event
 * 
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID that opened the door
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerDoorOpened(doorId, keyId, additionalData = {}) {
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-opened event', { doorId, keyId });
  
  return callbackRegistry.execute(DOOR_KEY_EVENTS.DOOR_OPENED, {
    entityId: doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    data: {
      keyId,
      doorId,
      ...additionalData
    }
  });
}

/**
 * Trigger door closed event
 * 
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID that closed the door (if applicable)
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerDoorClosed(doorId, keyId = null, additionalData = {}) {
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-closed event', { doorId, keyId });
  
  return callbackRegistry.execute(DOOR_KEY_EVENTS.DOOR_CLOSED, {
    entityId: doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    data: {
      keyId,
      doorId,
      ...additionalData
    }
  });
}

/**
 * Trigger key used event
 * 
 * @param {string} keyId - Key ID
 * @param {string} doorId - Door ID the key was used on
 * @param {boolean} success - Whether the key successfully opened the door
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerKeyUsed(keyId, doorId, success, additionalData = {}) {
  console.debug('[DOOR_KEY_CALLBACK] Triggering key-used event', { keyId, doorId, success });
  
  return callbackRegistry.execute(DOOR_KEY_EVENTS.KEY_USED, {
    entityId: keyId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    data: {
      keyId,
      doorId,
      success,
      ...additionalData
    }
  });
}

/**
 * Trigger access denied event
 * 
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID that was denied
 * @param {string} reason - Reason for denial
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerAccessDenied(doorId, keyId, reason, additionalData = {}) {
  console.debug('[DOOR_KEY_CALLBACK] Triggering access-denied event', { doorId, keyId, reason });
  
  return callbackRegistry.execute(DOOR_KEY_EVENTS.ACCESS_DENIED, {
    entityId: doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    data: {
      doorId,
      keyId,
      reason,
      ...additionalData
    }
  });
}

/**
 * Trigger door state changed event
 * 
 * @param {string} doorId - Door ID
 * @param {string} oldState - Previous state
 * @param {string} newState - New state
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerDoorStateChanged(doorId, oldState, newState, additionalData = {}) {
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-state-changed event', { doorId, oldState, newState });
  
  return callbackRegistry.execute(DOOR_KEY_EVENTS.DOOR_STATE_CHANGED, {
    entityId: doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    previousState: oldState,
    data: {
      doorId,
      oldState,
      newState,
      ...additionalData
    }
  });
}
