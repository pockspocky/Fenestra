/**
 * Domain Events Module
 * 
 * Defines and manages domain-specific events including email system,
 * lens system, and file system events.
 * 
 * @module events/domainEvents
 */

import { EventEmitter } from './EventEmitter.js';

/**
 * Email system event constants
 */
export const EMAIL_EVENTS = {
  RECEIVED: 'email:received',
  READ: 'email:read',
  ACTION_TRIGGERED: 'email:action:triggered',
  ACTION_EXECUTED: 'email:action:executed',
  INBOX_CHANGED: 'email:inbox:changed',
  VALIDATION_FAILED: 'email:validation:failed'
};

/**
 * Lens system event constants
 */
export const LENS_EVENTS = {
  APPLIED: 'lens:applied',
  REMOVED: 'lens:removed',
  EFFECT_CHANGED: 'lens:effect:changed',
  CREATED: 'lens:created',
  MOVED: 'lens:moved',
  DESTROYED: 'lens:destroyed',
  TRACKING_STARTED: 'lens:tracking:started',
  TRACKING_STOPPED: 'lens:tracking:stopped'
};

/**
 * File system event constants
 */
export const FS_EVENTS = {
  FILE_CREATED: 'fs:file:created',
  FILE_MODIFIED: 'fs:file:modified',
  FILE_DELETED: 'fs:file:deleted',
  FILE_SAVED: 'fs:file:saved',
  FILE_LOADED: 'fs:file:loaded',
  DIRECTORY_CHANGED: 'fs:directory:changed',
  VALIDATION_FAILED: 'fs:validation:failed'
};

/**
 * IPC (Inter-Process Communication) event constants
 */
export const IPC_EVENTS = {
  BEFORE: 'ipc:before',
  AFTER: 'ipc:after',
  ERROR: 'ipc:error'
};

/**
 * Singleton domain events emitter instance
 */
export const domainEvents = new EventEmitter();
