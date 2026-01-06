/**
 * Game State Callbacks Integration Module
 * 
 * Provides callback integration for game state management events including
 * save, load, reset, level completion, and export operations.
 * 
 * @module callbacks/gameStateCallbacks
 */

import '../../../logger.js';
import { createCallbackModule } from './callbackFactory.js';

/**
 * Game state event types
 */
export const GAME_STATE_EVENTS = {
  SAVED: 'state-saved',
  LOADED: 'state-loaded',
  RESET: 'state-reset',
  LEVEL_COMPLETED: 'level-completed',
  EXPORTED: 'state-exported'
};

// Create the callback module using the factory
const gameStateCallbacks = createCallbackModule({
  eventTypes: GAME_STATE_EVENTS,
  moduleName: 'gameStateManager',
  debugPrefix: '[GAME_STATE_CALLBACK]'
});

// Export all functions
export const registerStateSavedCallback = gameStateCallbacks.registerSAVEDCallback;
export const registerStateLoadedCallback = gameStateCallbacks.registerLOADEDCallback;
export const registerStateResetCallback = gameStateCallbacks.registerRESETCallback;
export const registerLevelCompletedCallback = gameStateCallbacks.registerLEVEL_COMPLETEDCallback;
export const registerStateExportedCallback = gameStateCallbacks.registerEXPORTEDCallback;

export const unregisterGameStateCallback = gameStateCallbacks.unregister;
export const clearGameStateCallbacks = gameStateCallbacks.clear;

export function triggerStateSaved(data = {}) {
  return gameStateCallbacks.triggerSAVED(null, data);
}

export function triggerStateLoaded(data = {}) {
  return gameStateCallbacks.triggerLOADED(null, data);
}

export function triggerStateReset(data = {}) {
  return gameStateCallbacks.triggerRESET(null, data);
}

export function triggerLevelCompleted(data = {}) {
  return gameStateCallbacks.triggerLEVEL_COMPLETED(null, data);
}

export function triggerStateExported(data = {}) {
  return gameStateCallbacks.triggerEXPORTED(null, data);
}