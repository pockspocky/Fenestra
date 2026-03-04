/**
 * Email Scheduling Callbacks Integration Module
 * 
 * Provides callback integration for email scheduling system events including
 * email scheduled, sent, send failed, and cancelled events.
 * 
 * Follows the established patterns from the door/key callback system.
 * 
 * @module callbacks/emailSchedulingCallbacks
 */

import { systemEvents, EMAIL_SCHEDULING_EVENTS } from '../../events/systemEvents.js';

// Re-export event constants for backward compatibility
export { EMAIL_SCHEDULING_EVENTS };

/**
 * Register a callback for email-scheduled events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Schedule ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global email scheduled callback
 * const regId = registerEmailScheduledCallback((data) => {
 *   console.log('Email scheduled:', data.scheduleId);
 * });
 * 
 * @example
 * // Register entity-specific callback
 * const regId = registerEmailScheduledCallback(
 *   (data) => {
 *     console.log('Specific email scheduled:', data.emailFileName);
 *   },
 *   { entityId: 'schedule-123' }
 * );
 * 
 * Requirements: 4.1, 4.5, 4.6
 */
export function registerEmailScheduledCallback(callback, options = {}) {
  return systemEvents.on(EMAIL_SCHEDULING_EVENTS.EMAIL_SCHEDULED, callback, options);
}

/**
 * Register a callback for email-sent events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Email ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global email sent callback
 * const regId = registerEmailSentCallback((data) => {
 *   console.log('Email sent:', data.emailId);
 * });
 * 
 * Requirements: 4.2, 4.5, 4.6
 */
export function registerEmailSentCallback(callback, options = {}) {
  return systemEvents.on(EMAIL_SCHEDULING_EVENTS.EMAIL_SENT, callback, options);
}

/**
 * Register a callback for email-send-failed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Schedule ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global email send failed callback
 * const regId = registerEmailSendFailedCallback((data) => {
 *   console.error('Email send failed:', data.error, data.message);
 * });
 * 
 * Requirements: 4.3, 4.5, 4.6
 */
export function registerEmailSendFailedCallback(callback, options = {}) {
  return systemEvents.on(EMAIL_SCHEDULING_EVENTS.EMAIL_SEND_FAILED, callback, options);
}

/**
 * Register a callback for email-cancelled events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Schedule ID for entity-specific callback
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global email cancelled callback
 * const regId = registerEmailCancelledCallback((data) => {
 *   console.log('Email cancelled:', data.scheduleId, 'reason:', data.reason);
 * });
 * 
 * Requirements: 4.4, 4.5, 4.6
 */
export function registerEmailCancelledCallback(callback, options = {}) {
  return systemEvents.on(EMAIL_SCHEDULING_EVENTS.EMAIL_CANCELLED, callback, options);
}

/**
 * Unregister an email scheduling callback
 * 
 * @param {string} registrationId - Registration ID from register function
 * @returns {boolean} Success status
 * 
 * @example
 * const regId = registerEmailSentCallback((data) => { ... });
 * // Later...
 * unregisterEmailSchedulingCallback(regId);
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function unregisterEmailSchedulingCallback(registrationId) {
  return systemEvents.off(registrationId);
}

/**
 * Clear all callbacks for a specific schedule
 * 
 * @param {string} scheduleId - Schedule ID
 * @returns {void}
 * 
 * @example
 * clearEmailSchedulingCallbacks('schedule-123');
 * 
 * Requirements: 5.1, 5.2
 */
export function clearEmailSchedulingCallbacks(scheduleId) {
  return systemEvents.cleanup(scheduleId);
}

/**
 * Trigger email-scheduled event
 * 
 * @param {string} scheduleId - Schedule ID
 * @param {Object} data - Event data
 * @returns {Object} Execution result
 * 
 * @example
 * triggerEmailScheduled('schedule-123', {
 *   emailFileName: 'welcome.json',
 *   delayMs: 5000,
 *   sendAt: Date.now() + 5000
 * });
 * 
 * Requirements: 4.7, 4.8, 4.9
 */
export function triggerEmailScheduled(scheduleId, data = {}) {
  console.debug('[EMAIL_SCHEDULING_CALLBACK] Triggering email-scheduled', { scheduleId });
  return systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SCHEDULED, {
    entityId: scheduleId,
    scheduleId,
    timestamp: Date.now(),
    source: 'emailScheduler',
    ...data
  });
}

/**
 * Trigger email-sent event
 * 
 * @param {string} emailId - Email ID
 * @param {Object} data - Event data
 * @returns {Object} Execution result
 * 
 * @example
 * triggerEmailSent('email-123', {
 *   emailFileName: 'welcome.json',
 *   scheduleId: 'schedule-123'
 * });
 * 
 * Requirements: 4.7, 4.8, 4.9
 */
export function triggerEmailSent(emailId, data = {}) {
  console.debug('[EMAIL_SCHEDULING_CALLBACK] Triggering email-sent', { emailId });
  return systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SENT, {
    entityId: emailId,
    emailId,
    timestamp: Date.now(),
    source: 'emailScheduler',
    ...data
  });
}

/**
 * Trigger email-send-failed event
 * 
 * @param {string} scheduleId - Schedule ID
 * @param {Object} data - Event data including error
 * @returns {Object} Execution result
 * 
 * @example
 * triggerEmailSendFailed('schedule-123', {
 *   emailFileName: 'welcome.json',
 *   error: 'EMAIL_FILE_NOT_FOUND',
 *   message: 'Email file not found'
 * });
 * 
 * Requirements: 4.7, 4.8, 4.9
 */
export function triggerEmailSendFailed(scheduleId, data = {}) {
  console.debug('[EMAIL_SCHEDULING_CALLBACK] Triggering email-send-failed', { scheduleId });
  return systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SEND_FAILED, {
    entityId: scheduleId,
    scheduleId,
    timestamp: Date.now(),
    source: 'emailScheduler',
    ...data
  });
}

/**
 * Trigger email-cancelled event
 * 
 * @param {string} scheduleId - Schedule ID
 * @param {Object} data - Event data
 * @returns {Object} Execution result
 * 
 * @example
 * triggerEmailCancelled('schedule-123', {
 *   emailFileName: 'welcome.json',
 *   reason: 'manual'
 * });
 * 
 * Requirements: 4.7, 4.8, 4.9
 */
export function triggerEmailCancelled(scheduleId, data = {}) {
  console.debug('[EMAIL_SCHEDULING_CALLBACK] Triggering email-cancelled', { scheduleId });
  return systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_CANCELLED, {
    entityId: scheduleId,
    scheduleId,
    timestamp: Date.now(),
    source: 'emailScheduler',
    ...data
  });
}
