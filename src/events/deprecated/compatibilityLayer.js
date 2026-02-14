/**
 * ⚠️⚠️⚠️ DEPRECATED - DO NOT USE IN PRODUCTION CODE ⚠️⚠️⚠️
 * 
 * Compatibility Layer for Old Callback API
 * 
 * ============================================================================
 * THIS MODULE IS DEPRECATED AND KEPT FOR TEST COMPATIBILITY ONLY
 * ============================================================================
 * 
 * Provides backward compatibility by mapping the old callback registry API
 * to the new event emitter system. This allows gradual migration without
 * breaking existing code.
 * 
 * This module is used ONLY by the deprecated callbackRegistry module.
 * Production code should use the event system directly.
 * 
 * @module events/compatibilityLayer
 * @deprecated This module is for backward compatibility only and will be removed
 */

import { systemEvents, GAME_EVENTS, WINDOW_EVENTS, DOOR_KEY_EVENTS } from '../systemEvents.js';
import { domainEvents, EMAIL_EVENTS, LENS_EVENTS, FS_EVENTS, IPC_EVENTS } from '../domainEvents.js';

/**
 * Map old event type strings to new event constants and emitters
 */
const EVENT_MAPPING = {
  // Game state events -> systemEvents
  'state-reset': { emitter: systemEvents, event: GAME_EVENTS.STATE_RESET },
  'level-completed': { emitter: systemEvents, event: GAME_EVENTS.LEVEL_COMPLETED },
  'state-exported': { emitter: systemEvents, event: GAME_EVENTS.STATE_EXPORTED },
  'state-saved': { emitter: systemEvents, event: GAME_EVENTS.STATE_SAVED },
  'state-loaded': { emitter: systemEvents, event: GAME_EVENTS.STATE_LOADED },

  // Window events -> systemEvents
  'window-created': { emitter: systemEvents, event: WINDOW_EVENTS.CREATED },
  'window-closed': { emitter: systemEvents, event: WINDOW_EVENTS.CLOSED },
  'window-focused': { emitter: systemEvents, event: WINDOW_EVENTS.FOCUSED },
  'window-moved': { emitter: systemEvents, event: WINDOW_EVENTS.MOVED },
  'window-resized': { emitter: systemEvents, event: WINDOW_EVENTS.RESIZED },
  'window-ready': { emitter: systemEvents, event: WINDOW_EVENTS.READY },

  // Door/Key events -> systemEvents
  'door-opened': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_OPENED },
  'door-closed': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_CLOSED },
  'key-used': { emitter: systemEvents, event: DOOR_KEY_EVENTS.KEY_USED },
  'access-denied': { emitter: systemEvents, event: DOOR_KEY_EVENTS.ACCESS_DENIED },
  'door-state-changed': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_STATE_CHANGED },

  // Email events -> domainEvents
  'email-received': { emitter: domainEvents, event: EMAIL_EVENTS.RECEIVED },
  'email-read': { emitter: domainEvents, event: EMAIL_EVENTS.READ },
  'email-action-executed': { emitter: domainEvents, event: EMAIL_EVENTS.ACTION_EXECUTED },
  'inbox-changed': { emitter: domainEvents, event: EMAIL_EVENTS.INBOX_CHANGED },
  'email-validation-failed': { emitter: domainEvents, event: EMAIL_EVENTS.VALIDATION_FAILED },

  // Lens events -> domainEvents
  'lens-created': { emitter: domainEvents, event: LENS_EVENTS.CREATED },
  'lens-moved': { emitter: domainEvents, event: LENS_EVENTS.MOVED },
  'lens-destroyed': { emitter: domainEvents, event: LENS_EVENTS.DESTROYED },
  'lens-tracking-started': { emitter: domainEvents, event: LENS_EVENTS.TRACKING_STARTED },
  'lens-tracking-stopped': { emitter: domainEvents, event: LENS_EVENTS.TRACKING_STOPPED },

  // File system events -> domainEvents
  'file-saved': { emitter: domainEvents, event: FS_EVENTS.FILE_SAVED },
  'file-loaded': { emitter: domainEvents, event: FS_EVENTS.FILE_LOADED },
  'file-deleted': { emitter: domainEvents, event: FS_EVENTS.FILE_DELETED },
  'directory-changed': { emitter: domainEvents, event: FS_EVENTS.DIRECTORY_CHANGED },
  'validation-failed': { emitter: domainEvents, event: FS_EVENTS.VALIDATION_FAILED },

  // IPC events -> domainEvents
  'ipc-before': { emitter: domainEvents, event: IPC_EVENTS.BEFORE },
  'ipc-after': { emitter: domainEvents, event: IPC_EVENTS.AFTER },
  'ipc-error': { emitter: domainEvents, event: IPC_EVENTS.ERROR }
};

/**
 * Compatibility wrapper for callbackRegistry.register()
 * 
 * @deprecated Use systemEvents.on() or domainEvents.on() directly
 * @param {string} eventType - Old event type string
 * @param {Function} callback - Callback function
 * @param {Object} options - Registration options
 * @returns {string} Listener ID
 */
export function register(eventType, callback, options = {}) {
  console.warn('[COMPAT] Using deprecated callback API. Please migrate to new event system.', {
    eventType,
    stack: new Error().stack
  });

  const mapping = EVENT_MAPPING[eventType];

  if (!mapping) {
    console.error('[COMPAT] Unknown event type in compatibility layer', { eventType });
    throw new Error(`Unknown event type: ${eventType}`);
  }

  // Handle 'once' option by wrapping callback
  let listenerId;
  
  // Adapt old callback signature (eventType, context) to new signature (data)
  const adaptedCallback = (data) => {
    // Old callbacks expected (eventType, context) where context had eventType, entityId, data, etc.
    const context = {
      eventType: mapping.event,
      entityId: data.entityId || null,
      timestamp: data.timestamp || Date.now(),
      source: data.source || 'unknown',
      data: data.data || data,
      previousState: data.previousState
    };

    // If once option is set, remove listener after execution
    if (options.once) {
      mapping.emitter.off(listenerId);
    }

    return callback(eventType, context);
  };

  listenerId = mapping.emitter.on(mapping.event, adaptedCallback, {
    entityId: options.entityId
  });

  return listenerId;
}

/**
 * Compatibility wrapper for callbackRegistry.unregister()
 * 
 * @deprecated Use emitter.off() directly
 * @param {string} listenerId - Listener ID
 * @returns {boolean} True if removed
 */
export function unregister(listenerId) {
  console.warn('[COMPAT] Using deprecated callback API. Please migrate to new event system.');

  // Try both emitters since we don't know which one has this listener
  return systemEvents.off(listenerId) || domainEvents.off(listenerId);
}

/**
 * Compatibility wrapper for callbackRegistry.execute()
 * 
 * @deprecated Use emitter.emit() directly
 * @param {string} eventType - Old event type string
 * @param {Object} eventData - Event data
 * @returns {Object} Execution result
 */
export function execute(eventType, eventData = {}) {
  console.warn('[COMPAT] Using deprecated callback API. Please migrate to new event system.', {
    eventType
  });

  const mapping = EVENT_MAPPING[eventType];

  if (!mapping) {
    console.error('[COMPAT] Unknown event type in compatibility layer', { eventType });
    return { executed: 0, errors: 0, prevented: false };
  }

  const result = mapping.emitter.emit(mapping.event, eventData);

  // Old API returned { executed, prevented, errors }
  // New API returns { executed, errors }
  // For compatibility, add prevented: false
  return {
    ...result,
    prevented: false
  };
}

/**
 * Compatibility wrapper for callbackRegistry.clearEntity()
 * 
 * @deprecated Use emitter.cleanup() directly
 * @param {string} entityId - Entity ID
 * @returns {number} Number of listeners removed
 */
export function clearEntity(entityId) {
  console.warn('[COMPAT] Using deprecated callback API. Please migrate to new event system.');

  const systemRemoved = systemEvents.cleanup(entityId);
  const domainRemoved = domainEvents.cleanup(entityId);

  return systemRemoved + domainRemoved;
}

/**
 * Compatibility wrapper for callbackRegistry.clearEventType()
 * 
 * @deprecated Use emitter.removeAllListeners() directly
 * @param {string} eventType - Old event type string
 * @returns {number} Number of listeners removed
 */
export function clearEventType(eventType) {
  console.warn('[COMPAT] Using deprecated callback API. Please migrate to new event system.');

  const mapping = EVENT_MAPPING[eventType];

  if (!mapping) {
    console.error('[COMPAT] Unknown event type in compatibility layer', { eventType });
    return 0;
  }

  return mapping.emitter.removeAllListeners(mapping.event);
}

/**
 * Compatibility wrapper for callbackRegistry.getCallbackCount()
 * 
 * @deprecated Use emitter.totalListenerCount() directly
 * @returns {number} Total listener count
 */
export function getCallbackCount() {
  return systemEvents.totalListenerCount() + domainEvents.totalListenerCount();
}

/**
 * Compatibility wrapper for callbackRegistry.getEventTypeCallbackCount()
 * 
 * @deprecated Use emitter.listenerCount() directly
 * @param {string} eventType - Old event type string
 * @returns {number} Listener count for event
 */
export function getEventTypeCallbackCount(eventType) {
  const mapping = EVENT_MAPPING[eventType];

  if (!mapping) {
    return 0;
  }

  return mapping.emitter.listenerCount(mapping.event);
}

/**
 * Compatibility wrapper for callbackRegistry.getEntityCallbackCount()
 * 
 * @deprecated Use custom tracking if needed
 * @param {string} entityId - Entity ID
 * @returns {number} Listener count for entity (approximation)
 */
export function getEntityCallbackCount(entityId) {
  console.warn('[COMPAT] getEntityCallbackCount is not fully supported in new event system');
  // This is difficult to implement efficiently in the new system
  // Return 0 as a placeholder
  return 0;
}
