/**
 * Lens Callbacks Integration Module
 * 
 * Provides callback integration for lens system events including
 * creation, movement, destruction, and tracking lifecycle events.
 * 
 * @module callbacks/lensCallbacks
 */

import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

/**
 * Lens event types
 */
export const LENS_EVENTS = {
  CREATED: 'lens-created',
  MOVED: 'lens-moved',
  DESTROYED: 'lens-destroyed',
  TRACKING_STARTED: 'lens-tracking-started',
  TRACKING_STOPPED: 'lens-tracking-stopped'
};

/**
 * Register a callback for lens creation events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Lens ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global lens creation callback
 * const regId = registerLensCreatedCallback((eventType, eventData) => {
 *   console.log('Lens created:', eventData.entityId);
 * });
 * 
 * @example
 * // Register entity-specific callback with priority
 * const regId = registerLensCreatedCallback(
 *   (eventType, eventData) => {
 *     console.log('Specific lens created');
 *   },
 *   { entityId: 'lens-1', priority: 10 }
 * );
 */
export function registerLensCreatedCallback(callback, options = {}) {
  return callbackRegistry.register(LENS_EVENTS.CREATED, callback, options);
}

/**
 * Register a callback for lens moved events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Lens ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerLensMovedCallback((eventType, eventData) => {
 *   console.log('Lens moved:', eventData.data.position);
 * });
 */
export function registerLensMovedCallback(callback, options = {}) {
  return callbackRegistry.register(LENS_EVENTS.MOVED, callback, options);
}

/**
 * Register a callback for lens destroyed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Lens ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerLensDestroyedCallback((eventType, eventData) => {
 *   console.log('Lens destroyed:', eventData.entityId);
 * });
 */
export function registerLensDestroyedCallback(callback, options = {}) {
  return callbackRegistry.register(LENS_EVENTS.DESTROYED, callback, options);
}

/**
 * Register a callback for lens tracking started events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Lens ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerLensTrackingStartedCallback((eventType, eventData) => {
 *   console.log('Lens tracking started:', eventData.entityId);
 * });
 */
export function registerLensTrackingStartedCallback(callback, options = {}) {
  return callbackRegistry.register(LENS_EVENTS.TRACKING_STARTED, callback, options);
}

/**
 * Register a callback for lens tracking stopped events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Lens ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerLensTrackingStoppedCallback((eventType, eventData) => {
 *   console.log('Lens tracking stopped:', eventData.entityId);
 * });
 */
export function registerLensTrackingStoppedCallback(callback, options = {}) {
  return callbackRegistry.register(LENS_EVENTS.TRACKING_STOPPED, callback, options);
}

/**
 * Unregister a lens callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerLensCreatedCallback(callback);
 * unregisterLensCallback(regId);
 */
export function unregisterLensCallback(registrationId) {
  return callbackRegistry.unregister(registrationId);
}

/**
 * Clear all callbacks for a specific lens
 * 
 * @param {string} lensId - Lens ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearLensCallbacks('lens-1');
 */
export function clearLensCallbacks(lensId) {
  return callbackRegistry.clearEntity(lensId);
}

/**
 * Trigger lens created event
 * 
 * @param {string} lensId - Lens ID
 * @param {Object} lensDetails - Lens details including targetWindowId
 * @returns {Object} Execution result
 */
export function triggerLensCreated(lensId, lensDetails = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-created event', { lensId });
  
  return callbackRegistry.execute(LENS_EVENTS.CREATED, {
    entityId: lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    data: lensDetails
  });
}

/**
 * Trigger lens moved event
 * 
 * @param {string} lensId - Lens ID
 * @param {Object} position - New position {x, y}
 * @returns {Object} Execution result
 */
export function triggerLensMoved(lensId, position) {
  console.debug('[LENS_CALLBACK] Triggering lens-moved event', { lensId, position });
  
  return callbackRegistry.execute(LENS_EVENTS.MOVED, {
    entityId: lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    data: { position }
  });
}

/**
 * Trigger lens destroyed event
 * 
 * @param {string} lensId - Lens ID
 * @returns {Object} Execution result
 */
export function triggerLensDestroyed(lensId) {
  console.debug('[LENS_CALLBACK] Triggering lens-destroyed event', { lensId });
  
  return callbackRegistry.execute(LENS_EVENTS.DESTROYED, {
    entityId: lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    data: {}
  });
}

/**
 * Trigger lens tracking started event
 * 
 * @param {string} lensId - Lens ID
 * @returns {Object} Execution result
 */
export function triggerLensTrackingStarted(lensId) {
  console.debug('[LENS_CALLBACK] Triggering lens-tracking-started event', { lensId });
  
  return callbackRegistry.execute(LENS_EVENTS.TRACKING_STARTED, {
    entityId: lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    data: {}
  });
}

/**
 * Trigger lens tracking stopped event
 * 
 * @param {string} lensId - Lens ID
 * @returns {Object} Execution result
 */
export function triggerLensTrackingStopped(lensId) {
  console.debug('[LENS_CALLBACK] Triggering lens-tracking-stopped event', { lensId });
  
  return callbackRegistry.execute(LENS_EVENTS.TRACKING_STOPPED, {
    entityId: lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    data: {}
  });
}
