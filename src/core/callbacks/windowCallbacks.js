/**
 * Window Callbacks Integration Module
 * 
 * Provides callback integration for window lifecycle events including
 * creation, closure, movement, resizing, and ready-to-show events.
 * 
 * @module callbacks/windowCallbacks
 */

import '../../../logger.js';
import { systemEvents, WINDOW_EVENTS } from '../../events/systemEvents.js';

// Re-export event constants for backward compatibility
export { WINDOW_EVENTS };

/**
 * Register a callback for window creation events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global window creation callback
 * const regId = registerWindowCreatedCallback((data) => {
 *   console.log('Window created:', data.entityId);
 * });
 * 
 * @example
 * // Register entity-specific callback
 * const regId = registerWindowCreatedCallback(
 *   (data) => {
 *     console.log('Specific window created');
 *   },
 *   { entityId: 'window-1' }
 * );
 */
export function registerWindowCreatedCallback(callback, options = {}) {
  return systemEvents.on(WINDOW_EVENTS.CREATED, callback, options);
}

/**
 * Register a callback for window closed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowClosedCallback((data) => {
 *   console.log('Window closed:', data.entityId);
 * });
 */
export function registerWindowClosedCallback(callback, options = {}) {
  return systemEvents.on(WINDOW_EVENTS.CLOSED, callback, options);
}

/**
 * Register a callback for window moved events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowMovedCallback((data) => {
 *   console.log('Window moved:', data.position);
 * });
 */
export function registerWindowMovedCallback(callback, options = {}) {
  return systemEvents.on(WINDOW_EVENTS.MOVED, callback, options);
}

/**
 * Register a callback for window resized events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowResizedCallback((data) => {
 *   console.log('Window resized:', data.size);
 * });
 */
export function registerWindowResizedCallback(callback, options = {}) {
  return systemEvents.on(WINDOW_EVENTS.RESIZED, callback, options);
}

/**
 * Register a callback for window ready-to-show events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Window ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerWindowReadyCallback((data) => {
 *   console.log('Window ready:', data.entityId);
 * });
 */
export function registerWindowReadyCallback(callback, options = {}) {
  return systemEvents.on(WINDOW_EVENTS.READY, callback, options);
}

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
export function unregisterWindowCallback(registrationId) {
  return systemEvents.off(registrationId);
}

/**
 * Clear all callbacks for a specific window
 * 
 * @param {string} windowId - Window ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearWindowCallbacks('window-1');
 */
export function clearWindowCallbacks(windowId) {
  return systemEvents.cleanup(windowId);
}

/**
 * Trigger window created event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} windowDetails - Window details
 * @returns {Object} Execution result
 */
export function triggerWindowCreated(windowId, windowDetails = {}) {
  console.debug('[WINDOW_CALLBACK] Triggering window-created', { windowId });
  return systemEvents.emit(WINDOW_EVENTS.CREATED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    ...windowDetails
  });
}

/**
 * Trigger window closed event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowClosed(windowId) {
  console.debug('[WINDOW_CALLBACK] Triggering window-closed', { windowId });
  return systemEvents.emit(WINDOW_EVENTS.CLOSED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager'
  });
}

/**
 * Trigger window moved event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} position - New position {x, y}
 * @returns {Object} Execution result
 */
export function triggerWindowMoved(windowId, position) {
  console.debug('[WINDOW_CALLBACK] Triggering window-moved', { windowId });
  return systemEvents.emit(WINDOW_EVENTS.MOVED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    position
  });
}

/**
 * Trigger window resized event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} size - New size {width, height}
 * @returns {Object} Execution result
 */
export function triggerWindowResized(windowId, size) {
  console.debug('[WINDOW_CALLBACK] Triggering window-resized', { windowId });
  return systemEvents.emit(WINDOW_EVENTS.RESIZED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    size
  });
}

/**
 * Trigger window ready-to-show event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowReady(windowId) {
  console.debug('[WINDOW_CALLBACK] Triggering window-ready', { windowId });
  return systemEvents.emit(WINDOW_EVENTS.READY, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager'
  });
}
