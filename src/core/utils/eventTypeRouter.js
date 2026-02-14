/**
 * Event Type Router
 * 
 * Utility module for routing old string-based event types to the correct
 * event emitter (systemEvents or domainEvents) and event constants.
 * 
 * This module is part of the migration from the deprecated callbackRegistry
 * system to the modern event-based architecture.
 * 
 * @module core/utils/eventTypeRouter
 */

import { 
  systemEvents, 
  GAME_EVENTS, 
  WINDOW_EVENTS, 
  DOOR_KEY_EVENTS 
} from '../../events/systemEvents.js';

import { 
  domainEvents, 
  EMAIL_EVENTS, 
  LENS_EVENTS, 
  FS_EVENTS,
  IPC_EVENTS 
} from '../../events/domainEvents.js';

/**
 * Mapping of old string-based event types to new event system
 * 
 * Each entry maps an old event type string to:
 * - emitter: The EventEmitter instance (systemEvents or domainEvents)
 * - event: The event constant from the new system
 * 
 * @constant {Object.<string, {emitter: EventEmitter, event: string}>}
 */
export const EVENT_MAPPING = {
  // System Events - Game State
  'state-reset': { emitter: systemEvents, event: GAME_EVENTS.STATE_RESET },
  'level-completed': { emitter: systemEvents, event: GAME_EVENTS.LEVEL_COMPLETED },
  'state-exported': { emitter: systemEvents, event: GAME_EVENTS.STATE_EXPORTED },
  'state-saved': { emitter: systemEvents, event: GAME_EVENTS.STATE_SAVED },
  'state-loaded': { emitter: systemEvents, event: GAME_EVENTS.STATE_LOADED },
  
  // System Events - Window Lifecycle
  'window-created': { emitter: systemEvents, event: WINDOW_EVENTS.CREATED },
  'window-closed': { emitter: systemEvents, event: WINDOW_EVENTS.CLOSED },
  'window-focused': { emitter: systemEvents, event: WINDOW_EVENTS.FOCUSED },
  'window-moved': { emitter: systemEvents, event: WINDOW_EVENTS.MOVED },
  'window-resized': { emitter: systemEvents, event: WINDOW_EVENTS.RESIZED },
  'window-ready': { emitter: systemEvents, event: WINDOW_EVENTS.READY },
  
  // System Events - Door and Key System
  'door-opened': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_OPENED },
  'door-closed': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_CLOSED },
  'key-used': { emitter: systemEvents, event: DOOR_KEY_EVENTS.KEY_USED },
  'access-denied': { emitter: systemEvents, event: DOOR_KEY_EVENTS.ACCESS_DENIED },
  'door-state-changed': { emitter: systemEvents, event: DOOR_KEY_EVENTS.DOOR_STATE_CHANGED },
  
  // Domain Events - Email System
  'email-received': { emitter: domainEvents, event: EMAIL_EVENTS.RECEIVED },
  'email-read': { emitter: domainEvents, event: EMAIL_EVENTS.READ },
  'email-action-executed': { emitter: domainEvents, event: EMAIL_EVENTS.ACTION_EXECUTED },
  'inbox-changed': { emitter: domainEvents, event: EMAIL_EVENTS.INBOX_CHANGED },
  'email-validation-failed': { emitter: domainEvents, event: EMAIL_EVENTS.VALIDATION_FAILED },
  
  // Domain Events - Lens System
  'lens-created': { emitter: domainEvents, event: LENS_EVENTS.CREATED },
  'lens-moved': { emitter: domainEvents, event: LENS_EVENTS.MOVED },
  'lens-destroyed': { emitter: domainEvents, event: LENS_EVENTS.DESTROYED },
  'lens-tracking-started': { emitter: domainEvents, event: LENS_EVENTS.TRACKING_STARTED },
  'lens-tracking-stopped': { emitter: domainEvents, event: LENS_EVENTS.TRACKING_STOPPED },
  
  // Domain Events - File System
  'file-saved': { emitter: domainEvents, event: FS_EVENTS.FILE_SAVED },
  'file-loaded': { emitter: domainEvents, event: FS_EVENTS.FILE_LOADED },
  'file-deleted': { emitter: domainEvents, event: FS_EVENTS.FILE_DELETED },
  'directory-changed': { emitter: domainEvents, event: FS_EVENTS.DIRECTORY_CHANGED },
  'validation-failed': { emitter: domainEvents, event: FS_EVENTS.VALIDATION_FAILED },
  
  // Domain Events - IPC (Inter-Process Communication)
  'ipc-before': { emitter: domainEvents, event: IPC_EVENTS.BEFORE },
  'ipc-after': { emitter: domainEvents, event: IPC_EVENTS.AFTER },
  'ipc-error': { emitter: domainEvents, event: IPC_EVENTS.ERROR }
};

/**
 * Determines the correct event emitter and constant for a given event type
 * 
 * @param {string} eventType - Old-style event type string (e.g., 'window-created')
 * @returns {{emitter: EventEmitter, event: string}} Object containing the emitter and event constant
 * @throws {Error} If the event type is unknown
 * 
 * @example
 * // Get emitter for window creation event
 * const { emitter, event } = getEmitterForEventType('window-created');
 * emitter.on(event, callback);
 * 
 * @example
 * // Recommended: Use event constants directly instead
 * import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
 * systemEvents.on(WINDOW_EVENTS.CREATED, callback);
 */
export function getEmitterForEventType(eventType) {
  const mapping = EVENT_MAPPING[eventType];
  
  if (!mapping) {
    throw new Error(
      `Unknown event type: ${eventType}. ` +
      `Use event constants from systemEvents or domainEvents instead.`
    );
  }
  
  return mapping;
}

/**
 * Checks if an event type is a system event
 * 
 * @param {string} eventType - Event type string to check
 * @returns {boolean} True if the event is a system event, false otherwise
 * 
 * @example
 * isSystemEvent('window-created'); // true
 * isSystemEvent('email-received'); // false
 */
export function isSystemEvent(eventType) {
  const mapping = EVENT_MAPPING[eventType];
  return !!(mapping && mapping.emitter === systemEvents);
}

/**
 * Checks if an event type is a domain event
 * 
 * @param {string} eventType - Event type string to check
 * @returns {boolean} True if the event is a domain event, false otherwise
 * 
 * @example
 * isDomainEvent('email-received'); // true
 * isDomainEvent('window-created'); // false
 */
export function isDomainEvent(eventType) {
  const mapping = EVENT_MAPPING[eventType];
  return !!(mapping && mapping.emitter === domainEvents);
}
