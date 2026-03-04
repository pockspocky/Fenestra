/**
 * System Events Module
 * 
 * Defines and manages system-level events including game state,
 * window lifecycle, and door/key system events.
 * 
 * @module events/systemEvents
 */

import { EventEmitter } from './EventEmitter.js';

/**
 * Game state event constants
 */
export const GAME_EVENTS = {
  STATE_RESET: 'game:state:reset',
  LEVEL_COMPLETED: 'game:level:completed',
  STATE_EXPORTED: 'game:state:exported',
  STATE_SAVED: 'game:state:saved',
  STATE_LOADED: 'game:state:loaded'
};

/**
 * Window lifecycle event constants
 */
export const WINDOW_EVENTS = {
  CREATED: 'window:created',
  CLOSED: 'window:closed',
  FOCUSED: 'window:focused',
  MOVED: 'window:moved',
  RESIZED: 'window:resized',
  READY: 'window:ready'
};

/**
 * Door and key system event constants
 */
export const DOOR_KEY_EVENTS = {
  DOOR_OPENED: 'doorkey:door:opened',
  DOOR_CLOSED: 'doorkey:door:closed',
  KEY_COLLECTED: 'doorkey:key:collected',
  KEY_USED: 'doorkey:key:used',
  ACCESS_DENIED: 'doorkey:access:denied',
  RELATION_INITIALIZED: 'doorkey:relation:initialized',
  DOOR_STATE_CHANGED: 'doorkey:door:state:changed'
};

/**
 * Email scheduling system event constants
 */
export const EMAIL_SCHEDULING_EVENTS = {
  EMAIL_SCHEDULED: 'email:scheduling:scheduled',
  EMAIL_SENT: 'email:scheduling:sent',
  EMAIL_SEND_FAILED: 'email:scheduling:send-failed',
  EMAIL_CANCELLED: 'email:scheduling:cancelled'
};

/**
 * Singleton system events emitter instance
 */
export const systemEvents = new EventEmitter();
