/**
 * Game State Callbacks Integration Module
 * 
 * Provides callback integration for game state management events including
 * save, load, reset, level completion, and export operations.
 * 
 * @module callbacks/gameStateCallbacks
 */

import '../../../logger.js';
import { systemEvents, GAME_EVENTS } from '../../events/systemEvents.js';

// Re-export event constants for backward compatibility
export { GAME_EVENTS };

// Export all functions
export function registerStateSavedCallback(callback, options = {}) {
  return systemEvents.on(GAME_EVENTS.STATE_SAVED, callback, options);
}

export function registerStateLoadedCallback(callback, options = {}) {
  return systemEvents.on(GAME_EVENTS.STATE_LOADED, callback, options);
}

export function registerStateResetCallback(callback, options = {}) {
  return systemEvents.on(GAME_EVENTS.STATE_RESET, callback, options);
}

export function registerLevelCompletedCallback(callback, options = {}) {
  return systemEvents.on(GAME_EVENTS.LEVEL_COMPLETED, callback, options);
}

export function registerStateExportedCallback(callback, options = {}) {
  return systemEvents.on(GAME_EVENTS.STATE_EXPORTED, callback, options);
}

export function unregisterGameStateCallback(registrationId) {
  return systemEvents.off(registrationId);
}

export function clearGameStateCallbacks(entityId) {
  return systemEvents.cleanup(entityId);
}

export function triggerStateSaved(data = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-saved');
  return systemEvents.emit(GAME_EVENTS.STATE_SAVED, {
    timestamp: Date.now(),
    source: 'gameStateManager',
    ...data
  });
}

export function triggerStateLoaded(data = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-loaded');
  return systemEvents.emit(GAME_EVENTS.STATE_LOADED, {
    timestamp: Date.now(),
    source: 'gameStateManager',
    ...data
  });
}

export function triggerStateReset(data = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-reset');
  return systemEvents.emit(GAME_EVENTS.STATE_RESET, {
    timestamp: Date.now(),
    source: 'gameStateManager',
    ...data
  });
}

export function triggerLevelCompleted(data = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering level-completed');
  return systemEvents.emit(GAME_EVENTS.LEVEL_COMPLETED, {
    timestamp: Date.now(),
    source: 'gameStateManager',
    ...data
  });
}

export function triggerStateExported(data = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-exported');
  return systemEvents.emit(GAME_EVENTS.STATE_EXPORTED, {
    timestamp: Date.now(),
    source: 'gameStateManager',
    ...data
  });
}