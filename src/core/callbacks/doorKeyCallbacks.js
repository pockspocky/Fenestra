/**
 * Door-Key Callbacks Integration Module
 * 
 * Provides callback integration for door-key system events including
 * door opening, closing, key usage, access denial, and state changes.
 * 
 * @module callbacks/doorKeyCallbacks
 */

import '../../../logger.js';
import { createCallbackModule } from './callbackFactory.js';

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

// Create the callback module using the factory
const doorKeyCallbacks = createCallbackModule({
  eventTypes: DOOR_KEY_EVENTS,
  moduleName: 'doorKeySystem',
  debugPrefix: '[DOOR_KEY_CALLBACK]'
});

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
export const registerDoorOpenedCallback = doorKeyCallbacks.registerDOOR_OPENEDCallback;

/**
 * Register a callback for door closed events
 */
export const registerDoorClosedCallback = doorKeyCallbacks.registerDOOR_CLOSEDCallback;

/**
 * Register a callback for key used events
 */
export const registerKeyUsedCallback = doorKeyCallbacks.registerKEY_USEDCallback;

/**
 * Register a callback for access denied events
 */
export const registerAccessDeniedCallback = doorKeyCallbacks.registerACCESS_DENIEDCallback;

/**
 * Register a callback for door state changed events
 */
export const registerDoorStateChangedCallback = doorKeyCallbacks.registerDOOR_STATE_CHANGEDCallback;

/**
 * Unregister a door-key callback
 */
export const unregisterDoorKeyCallback = doorKeyCallbacks.unregister;

/**
 * Clear all callbacks for a specific door
 */
export const clearDoorCallbacks = doorKeyCallbacks.clear;

/**
 * Clear all callbacks for a specific key
 */
export const clearKeyCallbacks = doorKeyCallbacks.clear;

/**
 * Trigger door opened event
 * 
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID that opened the door
 * @param {Object} additionalData - Additional event data
 * @returns {Object} Execution result
 */
export function triggerDoorOpened(doorId, keyId, additionalData = {}) {
  return doorKeyCallbacks.triggerDOOR_OPENED(doorId, { keyId, doorId, ...additionalData });
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
  return doorKeyCallbacks.triggerDOOR_CLOSED(doorId, { keyId, doorId, ...additionalData });
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
  return doorKeyCallbacks.triggerKEY_USED(keyId, { keyId, doorId, success, ...additionalData });
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
  return doorKeyCallbacks.triggerACCESS_DENIED(doorId, { keyId, doorId, reason, ...additionalData });
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
  return doorKeyCallbacks.triggerDOOR_STATE_CHANGED(doorId, { doorId, oldState, newState, ...additionalData });
}