/**
 * Window Callbacks Integration Module
 * 
 * Provides callback integration for window lifecycle events including
 * creation, closure, movement, resizing, and ready-to-show events.
 * 
 * @module callbacks/windowCallbacks
 */

import '../../../logger.js';
import { createCallbackModule } from './callbackFactory.js';

/**
 * Window event types
 */
export const WINDOW_EVENTS = {
  CREATED: 'window-created',
  CLOSED: 'window-closed',
  MOVED: 'window-moved',
  RESIZED: 'window-resized',
  READY: 'window-ready'
};

// Create the callback module using the factory
const windowCallbacks = createCallbackModule({
  eventTypes: WINDOW_EVENTS,
  moduleName: 'windowManager',
  debugPrefix: '[WINDOW_CALLBACK]'
});

/**
 * Register a callback for window creation events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global window creation callback
 * const regId = registerWindowCreatedCallback((eventType, eventData) => {
 *   console.log('Window created:', eventData.entityId);
 * });
 * 
 * @example
 * // Register entity-specific callback with priority
 * const regId = registerWindowCreatedCallback(
 *   (eventType, eventData) => {
 *     console.log('Specific window created');
 *   },
 *   { entityId: 'window-1', priority: 10 }
 * );
 */
export const registerWindowCreatedCallback = windowCallbacks.registerCREATEDCallback;

/**
 * Register a callback for window closed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowClosedCallback((eventType, eventData) => {
 *   console.log('Window closed:', eventData.entityId);
 * });
 */
export const registerWindowClosedCallback = windowCallbacks.registerCLOSEDCallback;

/**
 * Register a callback for window moved events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowMovedCallback((eventType, eventData) => {
 *   console.log('Window moved:', eventData.data.position);
 * });
 */
export const registerWindowMovedCallback = windowCallbacks.registerMOVEDCallback;

/**
 * Register a callback for window resized events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowResizedCallback((eventType, eventData) => {
 *   console.log('Window resized:', eventData.data.size);
 * });
 */
export const registerWindowResizedCallback = windowCallbacks.registerRESIZEDCallback;

/**
 * Register a callback for window ready-to-show events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowReadyCallback((eventType, eventData) => {
 *   console.log('Window ready:', eventData.entityId);
 * });
 */
export const registerWindowReadyCallback = windowCallbacks.registerREADYCallback;

/**
 * Unregister a window callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerWindowCreatedCallback(callback);
 * unregisterWindowCallback(regId);
 */
export const unregisterWindowCallback = windowCallbacks.unregister;

/**
 * Clear all callbacks for a specific window
 * 
 * @param {string} windowId - Window ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearWindowCallbacks('window-1');
 */
export const clearWindowCallbacks = windowCallbacks.clear;

/**
 * Trigger window created event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} windowDetails - Window details
 * @returns {Object} Execution result
 */
export function triggerWindowCreated(windowId, windowDetails = {}) {
  return windowCallbacks.triggerCREATED(windowId, windowDetails);
}

/**
 * Trigger window closed event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowClosed(windowId) {
  return windowCallbacks.triggerCLOSED(windowId, {});
}

/**
 * Trigger window moved event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} position - New position {x, y}
 * @returns {Object} Execution result
 */
export function triggerWindowMoved(windowId, position) {
  return windowCallbacks.triggerMOVED(windowId, { position });
}

/**
 * Trigger window resized event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} size - New size {width, height}
 * @returns {Object} Execution result
 */
export function triggerWindowResized(windowId, size) {
  return windowCallbacks.triggerRESIZED(windowId, { size });
}

/**
 * Trigger window ready-to-show event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowReady(windowId) {
  return windowCallbacks.triggerREADY(windowId, {});
}
