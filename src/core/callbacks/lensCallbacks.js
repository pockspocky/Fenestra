/**
 * Lens Callbacks Integration Module
 * 
 * Provides callback integration for lens system events including
 * creation, movement, destruction, and tracking lifecycle events.
 * 
 * @module callbacks/lensCallbacks
 */

import '../../../logger.js';
import { domainEvents, LENS_EVENTS } from '../../events/domainEvents.js';

// Re-export event constants for backward compatibility
export { LENS_EVENTS };

// Export all functions
export function registerLensCreatedCallback(callback, options = {}) {
  return domainEvents.on(LENS_EVENTS.CREATED, callback, options);
}

export function registerLensMovedCallback(callback, options = {}) {
  return domainEvents.on(LENS_EVENTS.MOVED, callback, options);
}

export function registerLensDestroyedCallback(callback, options = {}) {
  return domainEvents.on(LENS_EVENTS.DESTROYED, callback, options);
}

export function registerLensTrackingStartedCallback(callback, options = {}) {
  return domainEvents.on(LENS_EVENTS.TRACKING_STARTED, callback, options);
}

export function registerLensTrackingStoppedCallback(callback, options = {}) {
  return domainEvents.on(LENS_EVENTS.TRACKING_STOPPED, callback, options);
}

export function unregisterLensCallback(registrationId) {
  return domainEvents.off(registrationId);
}

export function clearLensCallbacks(entityId) {
  return domainEvents.cleanup(entityId);
}

export function triggerLensCreated(lensId, data = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-created', { lensId });
  return domainEvents.emit(LENS_EVENTS.CREATED, {
    entityId: lensId,
    lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    ...data
  });
}

export function triggerLensMoved(lensId, data = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-moved', { lensId });
  return domainEvents.emit(LENS_EVENTS.MOVED, {
    entityId: lensId,
    lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    ...data
  });
}

export function triggerLensDestroyed(lensId, data = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-destroyed', { lensId });
  return domainEvents.emit(LENS_EVENTS.DESTROYED, {
    entityId: lensId,
    lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    ...data
  });
}

export function triggerLensTrackingStarted(lensId, data = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-tracking-started', { lensId });
  return domainEvents.emit(LENS_EVENTS.TRACKING_STARTED, {
    entityId: lensId,
    lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    ...data
  });
}

export function triggerLensTrackingStopped(lensId, data = {}) {
  console.debug('[LENS_CALLBACK] Triggering lens-tracking-stopped', { lensId });
  return domainEvents.emit(LENS_EVENTS.TRACKING_STOPPED, {
    entityId: lensId,
    lensId,
    timestamp: Date.now(),
    source: 'lensSystem',
    ...data
  });
}