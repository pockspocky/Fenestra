/**
 * Game State Callbacks Integration Module
 * 
 * Provides callback integration for game state management events including
 * save, load, reset, level completion, and export operations.
 * 
 * @module callbacks/gameStateCallbacks
 */

import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

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

/**
 * Register a callback for game state saved events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Entity ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global state saved callback
 * const regId = registerStateSavedCallback((eventType, eventData) => {
 *   console.log('Game state saved:', eventData.data.filePath);
 * });
 * 
 * @example
 * // Register callback with priority
 * const regId = registerStateSavedCallback(
 *   (eventType, eventData) => {
 *     console.log('State saved with', eventData.data.windowCount, 'windows');
 *   },
 *   { priority: 10 }
 * );
 */
export function registerStateSavedCallback(callback, options = {}) {
  return callbackRegistry.register(GAME_STATE_EVENTS.SAVED, callback, options);
}

/**
 * Register a callback for game state loaded events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Entity ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerStateLoadedCallback((eventType, eventData) => {
 *   console.log('Game state loaded:', eventData.data.windowCount);
 * });
 */
export function registerStateLoadedCallback(callback, options = {}) {
  return callbackRegistry.register(GAME_STATE_EVENTS.LOADED, callback, options);
}

/**
 * Register a callback for game state reset events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Entity ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerStateResetCallback((eventType, eventData) => {
 *   console.log('Game state reset');
 * });
 */
export function registerStateResetCallback(callback, options = {}) {
  return callbackRegistry.register(GAME_STATE_EVENTS.RESET, callback, options);
}

/**
 * Register a callback for level completed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Level ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerLevelCompletedCallback((eventType, eventData) => {
 *   console.log('Level completed:', eventData.data.levelId);
 * });
 */
export function registerLevelCompletedCallback(callback, options = {}) {
  return callbackRegistry.register(GAME_STATE_EVENTS.LEVEL_COMPLETED, callback, options);
}

/**
 * Register a callback for game state exported events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Entity ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerStateExportedCallback((eventType, eventData) => {
 *   console.log('State exported:', eventData.data.exportPath);
 * });
 */
export function registerStateExportedCallback(callback, options = {}) {
  return callbackRegistry.register(GAME_STATE_EVENTS.EXPORTED, callback, options);
}

/**
 * Unregister a game state callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerStateSavedCallback(callback);
 * unregisterGameStateCallback(regId);
 */
export function unregisterGameStateCallback(registrationId) {
  return callbackRegistry.unregister(registrationId);
}

/**
 * Clear all callbacks for a specific entity
 * 
 * @param {string} entityId - Entity ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearGameStateCallbacks('level-1');
 */
export function clearGameStateCallbacks(entityId) {
  return callbackRegistry.clearEntity(entityId);
}

/**
 * Trigger state saved event
 * 
 * @param {Object} stateData - State data including file path, window count, etc.
 * @returns {Object} Execution result
 */
export function triggerStateSaved(stateData = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-saved event', { 
    filePath: stateData.filePath,
    windowCount: stateData.windowCount 
  });
  
  return callbackRegistry.execute(GAME_STATE_EVENTS.SAVED, {
    entityId: 'game-state',
    timestamp: Date.now(),
    source: 'gameStateManager',
    data: stateData
  });
}

/**
 * Trigger state loaded event
 * 
 * @param {Object} stateData - Loaded state data
 * @returns {Object} Execution result
 */
export function triggerStateLoaded(stateData = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-loaded event', { 
    filePath: stateData.filePath,
    windowCount: stateData.windowCount 
  });
  
  return callbackRegistry.execute(GAME_STATE_EVENTS.LOADED, {
    entityId: 'game-state',
    timestamp: Date.now(),
    source: 'gameStateManager',
    data: stateData
  });
}

/**
 * Trigger state reset event
 * 
 * @returns {Object} Execution result
 */
export function triggerStateReset() {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-reset event');
  
  return callbackRegistry.execute(GAME_STATE_EVENTS.RESET, {
    entityId: 'game-state',
    timestamp: Date.now(),
    source: 'gameStateManager',
    data: {}
  });
}

/**
 * Trigger level completed event
 * 
 * @param {string} levelId - Level identifier
 * @param {Object} levelData - Additional level data
 * @returns {Object} Execution result
 */
export function triggerLevelCompleted(levelId, levelData = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering level-completed event', { levelId });
  
  return callbackRegistry.execute(GAME_STATE_EVENTS.LEVEL_COMPLETED, {
    entityId: levelId,
    timestamp: Date.now(),
    source: 'gameStateManager',
    data: {
      levelId,
      ...levelData
    }
  });
}

/**
 * Trigger state exported event
 * 
 * @param {Object} exportData - Export data including path and serialized data
 * @returns {Object} Execution result
 */
export function triggerStateExported(exportData = {}) {
  console.debug('[GAME_STATE_CALLBACK] Triggering state-exported event', { 
    exportPath: exportData.exportPath 
  });
  
  return callbackRegistry.execute(GAME_STATE_EVENTS.EXPORTED, {
    entityId: 'game-state',
    timestamp: Date.now(),
    source: 'gameStateManager',
    data: exportData
  });
}
