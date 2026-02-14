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
 * - Modern event system integration
 * - Utility functions
 * 
 * ============================================================================
 * MODERN EVENT SYSTEM (PRIMARY APPROACH)
 * ============================================================================
 * 
 * This module has been migrated to use the modern event-driven architecture
 * based on systemEvents and domainEvents emitters. The deprecated callback
 * registry system has been removed from production code.
 * 
 * RECOMMENDED USAGE:
 * ------------------
 * Use the event system directly with event constants for best performance,
 * type safety, and clarity:
 * 
 * @example
 * // System events (windows, doors, game state)
 * import { systemEvents, WINDOW_EVENTS, DOOR_KEY_EVENTS, GAME_EVENTS } 
 *   from './events/systemEvents.js';
 * 
 * // Register listener
 * const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
 *   console.log('Window created:', eventData.entityId);
 * });
 * 
 * // Emit event
 * systemEvents.emit(WINDOW_EVENTS.CREATED, { 
 *   entityId: 'win-1', 
 *   data: { title: 'My Window' } 
 * });
 * 
 * // Remove listener
 * systemEvents.off(listenerId);
 * 
 * @example
 * // Domain events (email, lens, file system)
 * import { domainEvents, EMAIL_EVENTS, LENS_EVENTS, FS_EVENTS } 
 *   from './events/domainEvents.js';
 * 
 * // Register listener
 * const listenerId = domainEvents.on(EMAIL_EVENTS.RECEIVED, (eventData) => {
 *   console.log('Email received:', eventData.data.subject);
 * });
 * 
 * // Emit event
 * domainEvents.emit(EMAIL_EVENTS.RECEIVED, {
 *   entityId: 'email-1',
 *   data: { subject: 'Hello', from: 'user@example.com' }
 * });
 * 
 * SPECIALIZED CALLBACK MODULES:
 * -----------------------------
 * This module also exports specialized callback modules that provide
 * domain-specific wrappers around the event system:
 * 
 * - windowCallbacks: Window lifecycle events
 * - doorKeyCallbacks: Door-key system events
 * - emailCallbacks: Email system events
 * - lensCallbacks: Lens system events
 * - fileSystemCallbacks: File system events
 * - gameStateCallbacks: Game state management events
 * - ipcCallbacks: IPC handler lifecycle events
 * 
 * These modules provide convenient registration functions and event emission
 * helpers for their respective domains.
 * 
 * DEPRECATED FUNCTIONALITY:
 * -------------------------
 * The deprecated callbackRegistry is NO LONGER exported from this module.
 * Legacy convenience functions (registerOnceCallback, registerHighPriorityCallback,
 * etc.) are still available but deprecated. See their individual documentation
 * for migration guidance.
 * 
 * For backward compatibility testing, the deprecated callbackRegistry can be
 * imported directly from: './core/deprecated/callbackRegistry.js'
 * 
 * @module core
 */

// Core system modules
export * from '../systems/windowManager.js';
export * from '../systems/doorKeySystem.js';
export * from '../systems/gameLogic.js';
export * from '../workers/workerManager.js';
export * from '../handlers/ipcHandlers.js';
export * from './loggerConfig.js';
export * from './config.js';
export * from '../systems/emailSystem.js';
export * from '../storage/emailActions.js';

// Utility modules
export * from '../utils/pathUtils.js';
export * from '../utils/windowsFileSystem.js';
export * from '../utils/memoryManager.js';
export * from '../utils/memoryIntegration.js';

// ============================================================================
// Callback System Exports
// ============================================================================

/**
 * ============================================================================
 * DEPRECATED: callbackRegistry Export Removed
 * ============================================================================
 * 
 * The callbackRegistry export has been REMOVED from this module as part of the
 * migration to the modern event system. The deprecated callback system added
 * unnecessary overhead through compatibility layers and generated deprecation
 * warnings.
 * 
 * WHY WAS IT REMOVED?
 * -------------------
 * 1. Performance: Eliminated 3 layers of function calls and adapter overhead
 * 2. Clarity: Direct event system usage is clearer and more maintainable
 * 3. Warnings: Removed deprecation warnings from production code
 * 4. Modernization: Aligns with current event-driven architecture patterns
 * 
 * FOR TEST CODE (Backward Compatibility Testing):
 * -----------------------------------------------
 * If you need to test backward compatibility with the old API, you can still
 * import the deprecated callbackRegistry directly:
 * 
 * @example
 * // Import from deprecated directory for testing only
 * import { callbackRegistry } from './core/deprecated/callbackRegistry.js';
 * 
 * const regId = callbackRegistry.register('window-created', callback);
 * callbackRegistry.execute('window-created', eventData);
 * callbackRegistry.unregister(regId);
 * 
 * FOR PRODUCTION CODE (Recommended Approach):
 * -------------------------------------------
 * Use the modern event system directly with event constants:
 * 
 * @example
 * // System events (windows, doors, game state)
 * import { systemEvents, WINDOW_EVENTS, DOOR_KEY_EVENTS, GAME_EVENTS } 
 *   from './events/systemEvents.js';
 * 
 * // Register event listener
 * const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
 *   console.log('Window created:', eventData.entityId);
 * });
 * 
 * // Emit event
 * systemEvents.emit(WINDOW_EVENTS.CREATED, { 
 *   entityId: 'win-1', 
 *   data: { title: 'My Window' } 
 * });
 * 
 * // Remove listener
 * systemEvents.off(listenerId);
 * 
 * @example
 * // Domain events (email, lens, file system)
 * import { domainEvents, EMAIL_EVENTS, LENS_EVENTS, FS_EVENTS } 
 *   from './events/domainEvents.js';
 * 
 * // Register event listener
 * const listenerId = domainEvents.on(EMAIL_EVENTS.RECEIVED, (eventData) => {
 *   console.log('Email received:', eventData.data.subject);
 * });
 * 
 * // Emit event
 * domainEvents.emit(EMAIL_EVENTS.RECEIVED, {
 *   entityId: 'email-1',
 *   data: { subject: 'Hello', from: 'user@example.com' }
 * });
 * 
 * // Remove listener
 * domainEvents.off(listenerId);
 * 
 * MIGRATION GUIDE:
 * ----------------
 * Old API → New API mappings:
 * 
 * callbackRegistry.register(eventType, callback, options)
 *   → systemEvents.on(EVENT_CONSTANT, callback, options)
 *   → domainEvents.on(EVENT_CONSTANT, callback, options)
 * 
 * callbackRegistry.execute(eventType, eventData)
 *   → systemEvents.emit(EVENT_CONSTANT, eventData)
 *   → domainEvents.emit(EVENT_CONSTANT, eventData)
 * 
 * callbackRegistry.unregister(regId)
 *   → systemEvents.off(listenerId)
 *   → domainEvents.off(listenerId)
 * 
 * callbackRegistry.clearEntity(entityId)
 *   → systemEvents.cleanup(entityId)
 *   → domainEvents.cleanup(entityId)
 * 
 * See design document for complete migration guide:
 * .kiro/specs/deprecated-callback-migration/design.md
 * 
 * ============================================================================
 */
// export * from './callbackRegistry.js'; // REMOVED - Use modern event system instead

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

// Import event type router for migration to new event system
import { getEmitterForEventType } from './utils/eventTypeRouter.js';

// Import event emitters for direct usage
import { systemEvents } from '../events/systemEvents.js';
import { domainEvents } from '../events/domainEvents.js';

/**
 * Register a one-time callback that executes only once
 * 
 * INTERNAL IMPLEMENTATION:
 * This convenience function now uses the modern event system internally. It automatically
 * routes string event types to the correct emitter (systemEvents or domainEvents) and
 * creates a wrapper callback that removes itself after execution.
 * 
 * DEPRECATION NOTICE:
 * This function is deprecated in favor of direct event system usage. While it continues
 * to work by internally using systemEvents/domainEvents, direct usage is recommended for:
 * - Better performance (no routing overhead)
 * - Type safety with event constants
 * - Clearer code intent
 * - No deprecation warnings
 * 
 * @deprecated Use systemEvents.on() or domainEvents.on() with event constants instead.
 *   For one-time callbacks, manually call emitter.off(listenerId) after execution.
 *   Example: const id = systemEvents.on(WINDOW_EVENTS.CREATED, (data) => { 
 *     console.log(data); systemEvents.off(id); 
 *   });
 * @param {string} eventType - Event type string to listen for (e.g., 'window-created', 'email-received')
 * @param {Function} callback - Callback function to execute once
 * @param {Object} options - Additional options (entityId, priority, etc.)
 * @returns {string} Listener ID for unregistering
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 1: System Event (Window Created)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerOnceCallback } from './core/index.js';
 * 
 * registerOnceCallback('window-created', (eventData) => {
 *   console.log('First window created:', eventData.entityId);
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
 * 
 * const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
 *   console.log('First window created:', eventData.entityId);
 *   systemEvents.off(listenerId); // Remove after first call
 * });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 2: Domain Event (Email Received)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerOnceCallback } from './core/index.js';
 * 
 * registerOnceCallback('email-received', (eventData) => {
 *   console.log('First email received:', eventData.data.subject);
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { domainEvents, EMAIL_EVENTS } from './events/domainEvents.js';
 * 
 * const listenerId = domainEvents.on(EMAIL_EVENTS.RECEIVED, (eventData) => {
 *   console.log('First email received:', eventData.data.subject);
 *   domainEvents.off(listenerId); // Remove after first call
 * });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 3: System Event with Options (Door Opened)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerOnceCallback } from './core/index.js';
 * 
 * registerOnceCallback('door-opened', (eventData) => {
 *   console.log('Door opened:', eventData.entityId);
 * }, { entityId: 'door-1', priority: 10 });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, DOOR_KEY_EVENTS } from './events/systemEvents.js';
 * 
 * const listenerId = systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, (eventData) => {
 *   console.log('Door opened:', eventData.entityId);
 *   systemEvents.off(listenerId); // Remove after first call
 * }, { entityId: 'door-1', priority: 10 });
 */
export function registerOnceCallback(eventType, callback, options = {}) {
  // Validate inputs
  if (typeof eventType !== 'string') {
    throw new TypeError(
      'registerOnceCallback requires a string event type. ' +
      'For event constants, use systemEvents.on() or domainEvents.on() directly.'
    );
  }
  
  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function');
  }
  
  // Log deprecation warning
  console.warn(
    `[DEPRECATED] Using string event types with registerOnceCallback() is deprecated. ` +
    `Migrate to: systemEvents.on(EVENT_CONSTANT, callback) or domainEvents.on(EVENT_CONSTANT, callback)`
  );
  
  // Use event type router to determine correct emitter
  const { emitter, event } = getEmitterForEventType(eventType);
  
  // Create a wrapper callback that removes itself after execution
  let listenerId;
  const onceCallback = (eventData) => {
    try {
      callback(eventData);
    } finally {
      // Remove the listener after execution
      emitter.off(listenerId);
    }
  };
  
  // Register using the modern event system
  listenerId = emitter.on(event, onceCallback, options);
  
  return listenerId;
}

/**
 * Register a high-priority callback that executes before others
 * 
 * INTERNAL IMPLEMENTATION:
 * This convenience function now uses the modern event system internally. It automatically
 * routes string event types to the correct emitter (systemEvents or domainEvents) and
 * sets the priority option to 100 (high priority) for execution ordering.
 * 
 * DEPRECATION NOTICE:
 * This function is deprecated in favor of direct event system usage with explicit priority.
 * While it continues to work by internally using systemEvents/domainEvents, direct usage
 * provides better clarity and avoids deprecation warnings.
 *
 * @deprecated Use systemEvents.on() or domainEvents.on() with { priority: 100 } option instead.
 *   Example: systemEvents.on(WINDOW_EVENTS.CREATED, callback, { priority: 100 });
 * @param {string} eventType - Event type string (e.g., 'window-created', 'door-opened')
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Additional options (merged with priority: 100)
 * @returns {string} Listener ID for unregistering
 *
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 1: System Event (Door Opened)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerHighPriorityCallback } from './core/index.js';
 * 
 * registerHighPriorityCallback('door-opened', (eventData) => {
 *   console.log('High priority door opened handler');
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, DOOR_KEY_EVENTS } from './events/systemEvents.js';
 * 
 * systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, (eventData) => {
 *   console.log('High priority door opened handler');
 * }, { priority: 100 });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 2: Domain Event (Email Received)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerHighPriorityCallback } from './core/index.js';
 * 
 * registerHighPriorityCallback('email-received', (eventData) => {
 *   console.log('High priority email handler');
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { domainEvents, EMAIL_EVENTS } from './events/domainEvents.js';
 * 
 * domainEvents.on(EMAIL_EVENTS.RECEIVED, (eventData) => {
 *   console.log('High priority email handler');
 * }, { priority: 100 });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 3: System Event with Entity Filtering (Window Created)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerHighPriorityCallback } from './core/index.js';
 * 
 * registerHighPriorityCallback('window-created', (eventData) => {
 *   console.log('High priority window handler:', eventData.entityId);
 * }, { entityId: 'main-window' });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
 * 
 * systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
 *   console.log('High priority window handler:', eventData.entityId);
 * }, { entityId: 'main-window', priority: 100 });
 */
export function registerHighPriorityCallback(eventType, callback, options = {}) {
  if (typeof eventType !== 'string') {
    throw new Error('registerHighPriorityCallback requires string event type');
  }

  console.warn(
    `[DEPRECATED] registerHighPriorityCallback() is deprecated. ` +
    `Use the modern event system: systemEvents.on(EVENT_CONSTANT, callback, { priority: 100 })`
  );

  const { emitter, event } = getEmitterForEventType(eventType);
  return emitter.on(event, callback, {
    ...options,
    priority: options.priority !== undefined ? options.priority : 100
  });
}

/**
 * Register a low-priority callback that executes after others
 * 
 * INTERNAL IMPLEMENTATION:
 * This convenience function now uses the modern event system internally. It automatically
 * routes string event types to the correct emitter (systemEvents or domainEvents) and
 * sets the priority option to -100 (low priority) for execution ordering.
 * 
 * DEPRECATION NOTICE:
 * This function is deprecated in favor of direct event system usage with explicit priority.
 * While it continues to work by internally using systemEvents/domainEvents, direct usage
 * provides better clarity and avoids deprecation warnings.
 *
 * @deprecated Use systemEvents.on() or domainEvents.on() with { priority: -100 } option instead.
 *   Example: domainEvents.on(FS_EVENTS.FILE_SAVED, callback, { priority: -100 });
 * @param {string} eventType - Event type string (e.g., 'window-created', 'file-saved')
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Additional options (merged with priority: -100)
 * @returns {string} Listener ID for unregistering
 *
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 1: Domain Event (File Saved)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerLowPriorityCallback } from './core/index.js';
 * 
 * registerLowPriorityCallback('file-saved', (eventData) => {
 *   console.log('Low priority cleanup after file save');
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { domainEvents, FS_EVENTS } from './events/domainEvents.js';
 * 
 * domainEvents.on(FS_EVENTS.FILE_SAVED, (eventData) => {
 *   console.log('Low priority cleanup after file save');
 * }, { priority: -100 });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 2: System Event (Window Closed)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerLowPriorityCallback } from './core/index.js';
 * 
 * registerLowPriorityCallback('window-closed', (eventData) => {
 *   console.log('Low priority cleanup after window close');
 * });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
 * 
 * systemEvents.on(WINDOW_EVENTS.CLOSED, (eventData) => {
 *   console.log('Low priority cleanup after window close');
 * }, { priority: -100 });
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 3: Domain Event with Entity Filtering (Lens Destroyed)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerLowPriorityCallback } from './core/index.js';
 * 
 * registerLowPriorityCallback('lens-destroyed', (eventData) => {
 *   console.log('Low priority lens cleanup:', eventData.entityId);
 * }, { entityId: 'lens-1' });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { domainEvents, LENS_EVENTS } from './events/domainEvents.js';
 * 
 * domainEvents.on(LENS_EVENTS.DESTROYED, (eventData) => {
 *   console.log('Low priority lens cleanup:', eventData.entityId);
 * }, { entityId: 'lens-1', priority: -100 });
 */
export function registerLowPriorityCallback(eventType, callback, options = {}) {
  if (typeof eventType !== 'string') {
    throw new Error('registerLowPriorityCallback requires string event type');
  }

  console.warn(
    `[DEPRECATED] registerLowPriorityCallback() is deprecated. ` +
    `Use the modern event system: systemEvents.on(EVENT_CONSTANT, callback, { priority: -100 })`
  );

  const { emitter, event } = getEmitterForEventType(eventType);
  return emitter.on(event, callback, {
    ...options,
    priority: options.priority !== undefined ? options.priority : -100
  });
}

/**
 * Register multiple callbacks for the same event
 * 
 * INTERNAL IMPLEMENTATION:
 * This convenience function now uses the modern event system internally. It automatically
 * routes string event types to the correct emitter (systemEvents or domainEvents) and
 * registers each callback in the array, returning an array of listener IDs.
 * 
 * DEPRECATION NOTICE:
 * This function is deprecated in favor of direct event system usage with array mapping.
 * While it continues to work by internally using systemEvents/domainEvents, direct usage
 * provides better clarity, type safety, and avoids deprecation warnings.
 *
 * @deprecated Use array mapping with systemEvents.on() or domainEvents.on() instead.
 *   Example: const ids = callbacks.map(cb => systemEvents.on(WINDOW_EVENTS.CREATED, cb));
 * @param {string} eventType - Event type string (e.g., 'window-created', 'email-received')
 * @param {Array<Function>} callbacks - Array of callback functions
 * @param {Object} options - Options applied to all callbacks (priority, entityId, etc.)
 * @returns {Array<string>} Array of listener IDs for unregistering
 *
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 1: Domain Event (Email Received)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = registerMultipleCallbacks('email-received', [
 *   (eventData) => console.log('Handler 1:', eventData.data.subject),
 *   (eventData) => console.log('Handler 2:', eventData.data.from),
 *   (eventData) => console.log('Handler 3:', eventData.data.body)
 * ]);
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { domainEvents, EMAIL_EVENTS } from './events/domainEvents.js';
 * 
 * const handlers = [
 *   (eventData) => console.log('Handler 1:', eventData.data.subject),
 *   (eventData) => console.log('Handler 2:', eventData.data.from),
 *   (eventData) => console.log('Handler 3:', eventData.data.body)
 * ];
 * 
 * const listenerIds = handlers.map(handler => 
 *   domainEvents.on(EMAIL_EVENTS.RECEIVED, handler)
 * );
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 2: System Event (Window Created)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = registerMultipleCallbacks('window-created', [
 *   (eventData) => console.log('Window created:', eventData.entityId),
 *   (eventData) => console.log('Logging window:', eventData.data),
 *   (eventData) => console.log('Tracking window:', eventData.entityId)
 * ]);
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
 * 
 * const handlers = [
 *   (eventData) => console.log('Window created:', eventData.entityId),
 *   (eventData) => console.log('Logging window:', eventData.data),
 *   (eventData) => console.log('Tracking window:', eventData.entityId)
 * ];
 * 
 * const listenerIds = handlers.map(handler => 
 *   systemEvents.on(WINDOW_EVENTS.CREATED, handler)
 * );
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 3: System Event with Options (Door Opened)
 * // ============================================================================
 * 
 * // BEFORE (OLD - DEPRECATED):
 * import { registerMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = registerMultipleCallbacks('door-opened', [
 *   (eventData) => console.log('Security check:', eventData.data.keyId),
 *   (eventData) => console.log('Logging access:', eventData.entityId),
 *   (eventData) => console.log('Notification sent')
 * ], { priority: 10 });
 * 
 * // AFTER (NEW - RECOMMENDED):
 * import { systemEvents, DOOR_KEY_EVENTS } from './events/systemEvents.js';
 * 
 * const handlers = [
 *   (eventData) => console.log('Security check:', eventData.data.keyId),
 *   (eventData) => console.log('Logging access:', eventData.entityId),
 *   (eventData) => console.log('Notification sent')
 * ];
 * 
 * const listenerIds = handlers.map(handler => 
 *   systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, handler, { priority: 10 })
 * );
 */
export function registerMultipleCallbacks(eventType, callbacks, options = {}) {
  // Validate inputs
  if (typeof eventType !== 'string') {
    throw new TypeError(
      'registerMultipleCallbacks requires a string event type. ' +
      'For event constants, use systemEvents.on() or domainEvents.on() directly.'
    );
  }

  if (!Array.isArray(callbacks)) {
    throw new TypeError('Callbacks must be an array');
  }

  if (callbacks.length === 0) {
    return [];
  }

  // Validate all callbacks are functions
  for (let i = 0; i < callbacks.length; i++) {
    if (typeof callbacks[i] !== 'function') {
      throw new TypeError(`Callback at index ${i} must be a function`);
    }
  }

  // Log deprecation warning once (not per callback)
  console.warn(
    `[DEPRECATED] registerMultipleCallbacks() is deprecated. ` +
    `Use the modern event system: callbacks.map(cb => systemEvents.on(EVENT_CONSTANT, cb))`
  );

  // Use event type router to determine correct emitter
  const { emitter, event } = getEmitterForEventType(eventType);

  // Register all callbacks and collect listener IDs
  return callbacks.map(callback => emitter.on(event, callback, options));
}

/**
 * Unregister multiple callbacks at once
 * 
 * INTERNAL IMPLEMENTATION:
 * This convenience function uses the modern event system internally. Since listener IDs
 * don't indicate which emitter they belong to, this function tries to remove each listener
 * from both systemEvents and domainEvents emitters. It returns the count of successfully
 * removed listeners.
 * 
 * MIGRATION GUIDANCE:
 * While this function is not deprecated (it provides useful batch cleanup functionality),
 * you can achieve the same result by calling off() on the appropriate emitter directly
 * when you know which emitter the listeners belong to.
 * 
 * USAGE NOTES:
 * - Automatically tries both systemEvents and domainEvents
 * - Returns count of successfully removed listeners
 * - Gracefully handles invalid or non-existent listener IDs
 * - Safe to call with mixed listener IDs from different emitters
 * 
 * @param {Array<string>} registrationIds - Array of registration/listener IDs to remove
 * @returns {number} Number of callbacks successfully unregistered
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 1: Mixed Listener IDs (Current Approach - Still Valid)
 * // ============================================================================
 * 
 * // CURRENT APPROACH (STILL VALID):
 * // Useful when you have mixed listener IDs from different emitters
 * import { unregisterMultipleCallbacks } from './core/index.js';
 * 
 * const regIds = [regId1, regId2, regId3]; // Mixed system and domain event listeners
 * const removed = unregisterMultipleCallbacks(regIds);
 * console.log(`Removed ${removed} of ${regIds.length} callbacks`);
 * 
 * // ALTERNATIVE APPROACH (WHEN EMITTER IS KNOWN):
 * // More efficient when you know which emitter the listeners belong to
 * import { systemEvents } from './events/systemEvents.js';
 * 
 * const listenerIds = [id1, id2, id3]; // All from systemEvents
 * listenerIds.forEach(id => systemEvents.off(id));
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 2: System Events Only (Known Emitter)
 * // ============================================================================
 * 
 * // BEFORE (USING CONVENIENCE FUNCTION):
 * import { unregisterMultipleCallbacks } from './core/index.js';
 * 
 * const windowListenerIds = [id1, id2, id3]; // All window event listeners
 * unregisterMultipleCallbacks(windowListenerIds);
 * 
 * // AFTER (DIRECT EMITTER USAGE - MORE EFFICIENT):
 * import { systemEvents } from './events/systemEvents.js';
 * 
 * const windowListenerIds = [id1, id2, id3]; // All window event listeners
 * windowListenerIds.forEach(id => systemEvents.off(id));
 * 
 * @example
 * // ============================================================================
 * // MIGRATION EXAMPLE 3: Mixed Emitters (Explicit Control)
 * // ============================================================================
 * 
 * // BEFORE (USING CONVENIENCE FUNCTION):
 * import { unregisterMultipleCallbacks } from './core/index.js';
 * 
 * const allListenerIds = [
 *   windowListenerId,
 *   doorListenerId,
 *   emailListenerId,
 *   lensListenerId
 * ];
 * unregisterMultipleCallbacks(allListenerIds);
 * 
 * // AFTER (EXPLICIT CONTROL - CLEARER INTENT):
 * import { systemEvents } from './events/systemEvents.js';
 * import { domainEvents } from './events/domainEvents.js';
 * 
 * // System events
 * systemEvents.off(windowListenerId);
 * systemEvents.off(doorListenerId);
 * 
 * // Domain events
 * domainEvents.off(emailListenerId);
 * domainEvents.off(lensListenerId);
 */
export function unregisterMultipleCallbacks(registrationIds) {
  // Validate input
  if (!Array.isArray(registrationIds)) {
    throw new TypeError('registrationIds must be an array');
  }
  
  let removed = 0;
  
  // Try both emitters since we don't know which one has these listeners
  for (const listenerId of registrationIds) {
    // Skip invalid IDs gracefully
    if (!listenerId || typeof listenerId !== 'string') {
      continue;
    }
    
    // Try systemEvents first, then domainEvents
    // The off() method returns true if the listener was found and removed
    if (systemEvents.off(listenerId) || domainEvents.off(listenerId)) {
      removed++;
    }
  }
  
  return removed;
}

