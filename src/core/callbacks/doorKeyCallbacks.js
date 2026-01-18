/**
 * Door-Key Callbacks Integration Module
 * 
 * Provides callback integration for door-key system events including
 * door opening, closing, key usage, access denial, and state changes.
 * 
 * @module callbacks/doorKeyCallbacks
 */

import '../../../logger.js';
import { systemEvents, DOOR_KEY_EVENTS } from '../../events/systemEvents.js';

// Re-export event constants for backward compatibility
export { DOOR_KEY_EVENTS };

/**
 * Register a callback for door opened events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Door ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global door opened callback
 * const regId = registerDoorOpenedCallback((data) => {
 *   console.log('Door opened:', data.entityId);
 * });
 * 
 * @example
 * // Register entity-specific callback
 * const regId = registerDoorOpenedCallback(
 *   (data) => {
 *     console.log('Specific door opened with key:', data.keyId);
 *   },
 *   { entityId: 'door-1' }
 * );
 */
export function registerDoorOpenedCallback(callback, options = {}) {
  return systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, callback, options);
}

/**
 * Register a callback for door closed events
 */
export function registerDoorClosedCallback(callback, options = {}) {
  return systemEvents.on(DOOR_KEY_EVENTS.DOOR_CLOSED, callback, options);
}

/**
 * Register a callback for key used events
 */
export function registerKeyUsedCallback(callback, options = {}) {
  return systemEvents.on(DOOR_KEY_EVENTS.KEY_USED, callback, options);
}

/**
 * Register a callback for access denied events
 */
export function registerAccessDeniedCallback(callback, options = {}) {
  return systemEvents.on(DOOR_KEY_EVENTS.ACCESS_DENIED, callback, options);
}

/**
 * Register a callback for door state changed events
 */
export function registerDoorStateChangedCallback(callback, options = {}) {
  return systemEvents.on(DOOR_KEY_EVENTS.DOOR_STATE_CHANGED, callback, options);
}

/**
 * Unregister a door-key callback
 */
export function unregisterDoorKeyCallback(registrationId) {
  return systemEvents.off(registrationId);
}

/**
 * Clear all callbacks for a specific door
 */
export function clearDoorCallbacks(entityId) {
  return systemEvents.cleanup(entityId);
}

/**
 * Clear all callbacks for a specific key
 */
export function clearKeyCallbacks(entityId) {
  return systemEvents.cleanup(entityId);
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
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-opened', { doorId });
  return systemEvents.emit(DOOR_KEY_EVENTS.DOOR_OPENED, {
    entityId: doorId,
    keyId,
    doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    ...additionalData
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
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-closed', { doorId });
  return systemEvents.emit(DOOR_KEY_EVENTS.DOOR_CLOSED, {
    entityId: doorId,
    keyId,
    doorId,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    ...additionalData
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
  console.debug('[DOOR_KEY_CALLBACK] Triggering key-used', { keyId });
  return systemEvents.emit(DOOR_KEY_EVENTS.KEY_USED, {
    entityId: keyId,
    keyId,
    doorId,
    success,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    ...additionalData
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
  console.debug('[DOOR_KEY_CALLBACK] Triggering access-denied', { doorId });
  return systemEvents.emit(DOOR_KEY_EVENTS.ACCESS_DENIED, {
    entityId: doorId,
    keyId,
    doorId,
    reason,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    ...additionalData
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
  console.debug('[DOOR_KEY_CALLBACK] Triggering door-state-changed', { doorId });
  return systemEvents.emit(DOOR_KEY_EVENTS.DOOR_STATE_CHANGED, {
    entityId: doorId,
    doorId,
    oldState,
    newState,
    timestamp: Date.now(),
    source: 'doorKeySystem',
    ...additionalData
  });
}