/**
 * Window Callbacks Integration Module
 * 
 * Provides callback integration for window lifecycle events including
 * creation, closure, movement, resizing, and ready-to-show events.
 * 
 * @module callbacks/windowCallbacks
 */

import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

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
export function registerWindowCreatedCallback(callback, options = {}) {
  return callbackRegistry.register(WINDOW_EVENTS.CREATED, callback, options);
}

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
export function registerWindowClosedCallback(callback, options = {}) {
  return callbackRegistry.register(WINDOW_EVENTS.CLOSED, callback, options);
}

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
export function registerWindowMovedCallback(callback, options = {}) {
  return callbackRegistry.register(WINDOW_EVENTS.MOVED, callback, options);
}

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
export function registerWindowResizedCallback(callback, options = {}) {
  return callbackRegistry.register(WINDOW_EVENTS.RESIZED, callback, options);
}

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
export function registerWindowReadyCallback(callback, options = {}) {
  return callbackRegistry.register(WINDOW_EVENTS.READY, callback, options);
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
  return callbackRegistry.unregister(registrationId);
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
  return callbackRegistry.clearEntity(windowId);
}

/**
 * Trigger window created event
 * 
 * @param {string} windowId - Window ID
 * @param {Object} windowDetails - Window details
 * @returns {Object} Execution result
 */
export function triggerWindowCreated(windowId, windowDetails = {}) {
  console.debug('[WINDOW_CALLBACK] Triggering window-created event', { windowId });
  
  return callbackRegistry.execute(WINDOW_EVENTS.CREATED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    data: windowDetails
  });
}

/**
 * Trigger window closed event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowClosed(windowId) {
  console.debug('[WINDOW_CALLBACK] Triggering window-closed event', { windowId });
  
  return callbackRegistry.execute(WINDOW_EVENTS.CLOSED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    data: {}
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
  console.debug('[WINDOW_CALLBACK] Triggering window-moved event', { windowId, position });
  
  return callbackRegistry.execute(WINDOW_EVENTS.MOVED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    data: { position }
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
  console.debug('[WINDOW_CALLBACK] Triggering window-resized event', { windowId, size });
  
  return callbackRegistry.execute(WINDOW_EVENTS.RESIZED, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    data: { size }
  });
}

/**
 * Trigger window ready-to-show event
 * 
 * @param {string} windowId - Window ID
 * @returns {Object} Execution result
 */
export function triggerWindowReady(windowId) {
  console.debug('[WINDOW_CALLBACK] Triggering window-ready event', { windowId });
  
  return callbackRegistry.execute(WINDOW_EVENTS.READY, {
    entityId: windowId,
    timestamp: Date.now(),
    source: 'windowManager',
    data: {}
  });
}
