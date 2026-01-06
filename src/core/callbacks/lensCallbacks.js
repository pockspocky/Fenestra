/**
 * Lens Callbacks Integration Module
 * 
 * Provides callback integration for lens system events including
 * creation, movement, destruction, and tracking lifecycle events.
 * 
 * @module callbacks/lensCallbacks
 */

import '../../../logger.js';
import { createCallbackModule } from './callbackFactory.js';

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

// Create the callback module using the factory
const lensCallbacks = createCallbackModule({
  eventTypes: LENS_EVENTS,
  moduleName: 'lensSystem',
  debugPrefix: '[LENS_CALLBACK]'
});

// Export all functions
export const registerLensCreatedCallback = lensCallbacks.registerCREATEDCallback;
export const registerLensMovedCallback = lensCallbacks.registerMOVEDCallback;
export const registerLensDestroyedCallback = lensCallbacks.registerDESTROYEDCallback;
export const registerLensTrackingStartedCallback = lensCallbacks.registerTRACKING_STARTEDCallback;
export const registerLensTrackingStoppedCallback = lensCallbacks.registerTRACKING_STOPPEDCallback;

export const unregisterLensCallback = lensCallbacks.unregister;
export const clearLensCallbacks = lensCallbacks.clear;

export function triggerLensCreated(lensId, data = {}) {
  return lensCallbacks.triggerCREATED(lensId, { lensId, ...data });
}

export function triggerLensMoved(lensId, data = {}) {
  return lensCallbacks.triggerMOVED(lensId, { lensId, ...data });
}

export function triggerLensDestroyed(lensId, data = {}) {
  return lensCallbacks.triggerDESTROYED(lensId, { lensId, ...data });
}

export function triggerLensTrackingStarted(lensId, data = {}) {
  return lensCallbacks.triggerTRACKING_STARTED(lensId, { lensId, ...data });
}

export function triggerLensTrackingStopped(lensId, data = {}) {
  return lensCallbacks.triggerTRACKING_STOPPED(lensId, { lensId, ...data });
}