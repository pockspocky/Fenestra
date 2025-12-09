/**
 * Core Module Exports
 * 
 * Centralized export module for all core functionality including:
 * - Window management
 * - Door-key system
 * - Game logic and state management
 * - Email system
 * - Lens system
 * - IPC handlers
 * - Callback system (comprehensive event-driven architecture)
 * - Utility functions
 * 
 * @module core
 */

// Core system modules
export * from './systems/windowManager.js';
export * from './systems/doorKeySystem.js';
export * from './systems/gameLogic.js';
export * from './workerManager.js';
export * from './handlers/ipcHandlers.js';
export * from './loggerConfig.js';
export * from './config.js';
export * from './systems/emailSystem.js';
export * from './emailActions.js';

// Utility modules
export * from './utils/pathUtils.js';
export * from './utils/windowsFileSystem.js';

// ============================================================================
// Callback System Exports
// ============================================================================

/**
 * Callback Registry
 * 
 * Core callback management system providing:
 * - CallbackRegistry class for creating custom registries
 * - callbackRegistry singleton for global callback management
 * - Entity-specific and global callback support
 * - Priority-based execution ordering
 * - PreventDefault mechanism
 * - Error isolation and logging
 * 
 * @example
 * import { callbackRegistry } from './core/index.js';
 * 
 * // Register a callback
 * const regId = callbackRegistry.register('custom-event', (eventType, eventData) => {
 *   console.log('Event triggered:', eventType);
 * }, { priority: 10 });
 * 
 * // Execute callbacks
 * callbackRegistry.execute('custom-event', {
 *   entityId: 'entity-1',
 *   data: { message: 'Hello' }
 * });
 * 
 * // Unregister callback
 * callbackRegistry.unregister(regId);
 */
export * from './callbackRegistry.js';

/**
 * Window Callbacks
 * 
 * Callback integration for window lifecycle events:
 * - window-created: Window creation
 * - window-closed: Window closure
 * - window-moved: Window position changes
 * - window-resized: Window size changes
 * - window-ready: Window ready-to-show
 * 
 * Exports:
 * - WINDOW_EVENTS: Event type constants
 * - registerWindowCreatedCallback()
 * - registerWindowClosedCallback()
 * - registerWindowMovedCallback()
 * - registerWindowResizedCallback()
 * - registerWindowReadyCallback()
 * - unregisterWindowCallback()
 * - clearWindowCallbacks()
 * - triggerWindow* functions for event emission
 * 
 * @example
 * import { registerWindowCreatedCallback } from './core/index.js';
 * 
 * registerWindowCreatedCallback((eventType, eventData) => {
 *   console.log('Window created:', eventData.entityId);
 * }, { priority: 10 });
 */
export * from './callbacks/windowCallbacks.js';

/**
 * Door-Key Callbacks
 * 
 * Callback integration for door-key system events:
 * - door-opened: Door opened with key
 * - door-closed: Door closed
 * - key-used: Key used on door
 * - access-denied: Access denied
 * - door-state-changed: Door state transition
 * 
 * Exports:
 * - DOOR_KEY_EVENTS: Event type constants
 * - registerDoorOpenedCallback()
 * - registerDoorClosedCallback()
 * - registerKeyUsedCallback()
 * - registerAccessDeniedCallback()
 * - registerDoorStateChangedCallback()
 * - unregisterDoorKeyCallback()
 * - clearDoorCallbacks()
 * - clearKeyCallbacks()
 * - triggerDoor* functions for event emission
 * 
 * @example
 * import { registerDoorOpenedCallback } from './core/index.js';
 * 
 * registerDoorOpenedCallback((eventType, eventData) => {
 *   console.log('Door opened:', eventData.entityId, 'with key:', eventData.data.keyId);
 * }, { entityId: 'door-1' });
 */
export * from './callbacks/doorKeyCallbacks.js';

/**
 * IPC Callbacks
 * 
 * Callback integration for IPC handler events:
 * - ipc-before-{channel}: Before IPC handler execution
 * - ipc-after-{channel}: After IPC handler execution
 * - ipc-error-{channel}: IPC handler error
 * 
 * Exports:
 * - wrapIpcHandler(): Wrap IPC handlers with callbacks
 * - registerIpcBeforeCallback()
 * - registerIpcAfterCallback()
 * - registerIpcErrorCallback()
 * - registerIpcLifecycleCallbacks()
 * - registerIpcPatternCallback()
 * - clearIpcCallbacks()
 * - matchesChannelPattern()
 * 
 * @example
 * import { wrapIpcHandler, registerIpcBeforeCallback } from './core/index.js';
 * 
 * // Wrap an IPC handler
 * const wrappedHandler = wrapIpcHandler('game/window/create', originalHandler);
 * ipcMain.handle('game/window/create', wrappedHandler);
 * 
 * // Register before callback
 * registerIpcBeforeCallback('game/window/create', (eventType, eventData) => {
 *   console.log('Before window creation');
 *   // Return false to prevent execution
 * });
 */
export * from './callbacks/ipcCallbacks.js';

/**
 * File System Callbacks
 * 
 * Callback integration for file system events:
 * - file-saved: File saved to disk
 * - file-loaded: File loaded from disk
 * - file-deleted: File deleted
 * - directory-changed: Directory navigation
 * - validation-failed: File validation failure
 * 
 * All paths are normalized using path.join/resolve for cross-platform compatibility.
 * 
 * Exports:
 * - FILE_SYSTEM_EVENTS: Event type constants
 * - registerFileSavedCallback()
 * - registerFileLoadedCallback()
 * - registerFileDeletedCallback()
 * - registerDirectoryChangedCallback()
 * - registerValidationFailedCallback()
 * - unregisterFileSystemCallback()
 * - clearFileSystemCallbacks()
 * - triggerFile* functions for event emission
 * 
 * @example
 * import { registerFileSavedCallback } from './core/index.js';
 * 
 * registerFileSavedCallback((eventType, eventData) => {
 *   console.log('File saved:', eventData.data.filePath);
 * });
 */
export * from './callbacks/fileSystemCallbacks.js';

/**
 * Game State Callbacks
 * 
 * Callback integration for game state management events:
 * - state-saved: Game state saved
 * - state-loaded: Game state loaded
 * - state-reset: Game state reset
 * - level-completed: Level completed
 * - state-exported: Game state exported
 * 
 * Exports:
 * - GAME_STATE_EVENTS: Event type constants
 * - registerStateSavedCallback()
 * - registerStateLoadedCallback()
 * - registerStateResetCallback()
 * - registerLevelCompletedCallback()
 * - registerStateExportedCallback()
 * - unregisterGameStateCallback()
 * - clearGameStateCallbacks()
 * - triggerState* functions for event emission
 * 
 * @example
 * import { registerStateSavedCallback } from './core/index.js';
 * 
 * registerStateSavedCallback((eventType, eventData) => {
 *   console.log('Game state saved:', eventData.data.filePath);
 * });
 */
export * from './callbacks/gameStateCallbacks.js';

/**
 * Email Callbacks
 * 
 * Callback integration for email system events:
 * - email-received: Email received in inbox
 * - email-read: Email marked as read
 * - email-action-executed: Email action executed
 * - inbox-changed: Inbox directory changed
 * - email-validation-failed: Email validation failure
 * 
 * Exports:
 * - EMAIL_EVENTS: Event type constants
 * - registerEmailReceivedCallback()
 * - registerEmailReadCallback()
 * - registerEmailActionExecutedCallback()
 * - registerInboxChangedCallback()
 * - registerEmailValidationFailedCallback()
 * - unregisterEmailCallback()
 * - clearEmailCallbacks()
 * - triggerEmail* functions for event emission
 * 
 * @example
 * import { registerEmailReceivedCallback } from './core/index.js';
 * 
 * registerEmailReceivedCallback((eventType, eventData) => {
 *   console.log('New email:', eventData.data.subject);
 * });
 */
export * from './callbacks/emailCallbacks.js';

/**
 * Lens Callbacks
 * 
 * Callback integration for lens system events:
 * - lens-created: Lens created
 * - lens-moved: Lens position changed
 * - lens-destroyed: Lens destroyed
 * - lens-tracking-started: Lens tracking started
 * - lens-tracking-stopped: Lens tracking stopped
 * 
 * Exports:
 * - LENS_EVENTS: Event type constants
 * - registerLensCreatedCallback()
 * - registerLensMovedCallback()
 * - registerLensDestroyedCallback()
 * - registerLensTrackingStartedCallback()
 * - registerLensTrackingStoppedCallback()
 * - unregisterLensCallback()
 * - clearLensCallbacks()
 * - triggerLens* functions for event emission
 * 
 * @example
 * import { registerLensCreatedCallback } from './core/index.js';
 * 
 * registerLensCreatedCallback((eventType, eventData) => {
 *   console.log('Lens created:', eventData.entityId);
 * }, { entityId: 'lens-1' });
 */
export * from './callbacks/lensCallbacks.js';

// ============================================================================
// Convenience Functions for Common Callback Patterns
// ============================================================================

// Import callbackRegistry for convenience functions
import { callbackRegistry } from './callbackRegistry.js';

/**
 * Register a one-time callback that executes only once
 * 
 * @param {string} eventType - Event type to listen for
 * @param {Function} callback - Callback function
 * @param {Object} options - Additional options (merged with once: true)
 * @returns {string} Registration ID
 * 
 * @example
 * import { registerOnceCallback } from './core/index.js';
 * 
 * registerOnceCallback('window-created', (eventType, eventData) => {
 *   console.log('First window created');
 * });
 */
export function registerOnceCallback(eventType, callback, options = {}) {
  return callbackRegistry.register(eventType, callback, {
    ...options,
    once: true
  });
}

/**
 * Register a high-priority callback that executes before others
 * 
 * @param {string} eventType - Event type to listen for
 * @param {Function} callback - Callback function
 * @param {Object} options - Additional options (merged with priority: 100)
 * @returns {string} Registration ID
 * 
 * @example
 * import { registerHighPriorityCallback } from './core/index.js';
 * 
 * registerHighPriorityCallback('door-opened', (eventType, eventData) => {
 *   console.log('High priority door opened handler');
 * });
 */
export function registerHighPriorityCallback(eventType, callback, options = {}) {
  return callbackRegistry.register(eventType, callback, {
    ...options,
    priority: options.priority !== undefined ? options.priority : 100
  });
}

/**
 * Register a low-priority callback that executes after others
 * 
 * @param {string} eventType - Event type to listen for
 * @param {Function} callback - Callback function
 * @param {Object} options - Additional options (merged with priority: -100)
 * @returns {string} Registration ID
 * 
 * @example
 * import { registerLowPriorityCallback } from './core/index.js';
 * 
 * registerLowPriorityCallback('file-saved', (eventType, eventData) => {
 *   console.log('Low priority cleanup after file save');
 * });
 */
export function registerLowPriorityCallback(eventType, callback, options = {}) {
  return callbackRegistry.register(eventType, callback, {
    ...options,
    priority: options.priority !== undefined ? options.priority : -100
  });
}

/**
 * Register multiple callbacks for the same event at once
 * 
 * @param {string} eventType - Event type to listen for
 * @param {Array<Function>} callbacks - Array of callback functions
 * @param {Object} options - Options applied to all callbacks
 * @returns {Array<string>} Array of registration IDs
 * 
 * @example
 * import { registerMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = registerMultipleCallbacks('email-received', [
 *   (eventType, eventData) => console.log('Handler 1'),
 *   (eventType, eventData) => console.log('Handler 2'),
 *   (eventType, eventData) => console.log('Handler 3')
 * ]);
 */
export function registerMultipleCallbacks(eventType, callbacks, options = {}) {
  return callbacks.map(callback => 
    callbackRegistry.register(eventType, callback, options)
  );
}

/**
 * Unregister multiple callbacks at once
 * 
 * @param {Array<string>} registrationIds - Array of registration IDs
 * @returns {number} Number of callbacks successfully unregistered
 * 
 * @example
 * import { unregisterMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = [regId1, regId2, regId3];
 * const removed = unregisterMultipleCallbacks(regIds);
 * console.log(`Removed ${removed} callbacks`);
 */
export function unregisterMultipleCallbacks(registrationIds) {
  let removed = 0;
  for (const regId of registrationIds) {
    if (callbackRegistry.unregister(regId)) {
      removed++;
    }
  }
  return removed;
}

