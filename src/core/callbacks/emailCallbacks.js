/**
 * Email System Callbacks Integration Module
 * 
 * Provides callback integration for email system events including
 * email reception, read status changes, action execution, inbox changes,
 * and validation failures.
 * 
 * @module callbacks/emailCallbacks
 */

import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

/**
 * Email event types
 */
export const EMAIL_EVENTS = {
  RECEIVED: 'email-received',
  READ: 'email-read',
  ACTION_EXECUTED: 'email-action-executed',
  INBOX_CHANGED: 'inbox-changed',
  VALIDATION_FAILED: 'email-validation-failed'
};

/**
 * Register a callback for email received events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Email ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global email received callback
 * const regId = registerEmailReceivedCallback((eventType, eventData) => {
 *   console.log('Email received:', eventData.data.subject);
 * });
 * 
 * @example
 * // Register callback with priority
 * const regId = registerEmailReceivedCallback(
 *   (eventType, eventData) => {
 *     console.log('New email from:', eventData.data.senderEmail);
 *   },
 *   { priority: 10 }
 * );
 */
export function registerEmailReceivedCallback(callback, options = {}) {
  return callbackRegistry.register(EMAIL_EVENTS.RECEIVED, callback, options);
}

/**
 * Register a callback for email read events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Email ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerEmailReadCallback((eventType, eventData) => {
 *   console.log('Email marked as read:', eventData.entityId);
 * });
 */
export function registerEmailReadCallback(callback, options = {}) {
  return callbackRegistry.register(EMAIL_EVENTS.READ, callback, options);
}

/**
 * Register a callback for email action executed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Email ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerEmailActionExecutedCallback((eventType, eventData) => {
 *   console.log('Email action executed:', eventData.data.actionType);
 * });
 */
export function registerEmailActionExecutedCallback(callback, options = {}) {
  return callbackRegistry.register(EMAIL_EVENTS.ACTION_EXECUTED, callback, options);
}

/**
 * Register a callback for inbox changed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Entity ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerInboxChangedCallback((eventType, eventData) => {
 *   console.log('Inbox changed:', eventData.data.changeType);
 * });
 */
export function registerInboxChangedCallback(callback, options = {}) {
  return callbackRegistry.register(EMAIL_EVENTS.INBOX_CHANGED, callback, options);
}

/**
 * Register a callback for email validation failed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Email ID for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerEmailValidationFailedCallback((eventType, eventData) => {
 *   console.log('Email validation failed:', eventData.data.errors);
 * });
 */
export function registerEmailValidationFailedCallback(callback, options = {}) {
  return callbackRegistry.register(EMAIL_EVENTS.VALIDATION_FAILED, callback, options);
}

/**
 * Unregister an email callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerEmailReceivedCallback(callback);
 * unregisterEmailCallback(regId);
 */
export function unregisterEmailCallback(registrationId) {
  return callbackRegistry.unregister(registrationId);
}

/**
 * Clear all callbacks for a specific entity
 * 
 * @param {string} entityId - Entity ID
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearEmailCallbacks('email-123');
 */
export function clearEmailCallbacks(entityId) {
  return callbackRegistry.clearEntity(entityId);
}

/**
 * Trigger email received event
 * 
 * @param {Object} emailData - Email data including id, subject, sender, etc.
 * @returns {Object} Execution result
 */
export function triggerEmailReceived(emailData = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-received event', { 
    emailId: emailData.id,
    subject: emailData.subject 
  });
  
  return callbackRegistry.execute(EMAIL_EVENTS.RECEIVED, {
    entityId: emailData.id || 'unknown',
    timestamp: Date.now(),
    source: 'emailStorage',
    data: emailData
  });
}

/**
 * Trigger email read event
 * 
 * @param {string} emailId - Email identifier
 * @param {Object} emailData - Additional email data
 * @returns {Object} Execution result
 */
export function triggerEmailRead(emailId, emailData = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-read event', { emailId });
  
  return callbackRegistry.execute(EMAIL_EVENTS.READ, {
    entityId: emailId,
    timestamp: Date.now(),
    source: 'emailStorage',
    data: {
      emailId,
      ...emailData
    }
  });
}

/**
 * Trigger email action executed event
 * 
 * @param {string} emailId - Email identifier
 * @param {Object} actionData - Action execution data
 * @returns {Object} Execution result
 */
export function triggerEmailActionExecuted(emailId, actionData = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-action-executed event', { 
    emailId,
    actionType: actionData.actionType 
  });
  
  return callbackRegistry.execute(EMAIL_EVENTS.ACTION_EXECUTED, {
    entityId: emailId,
    timestamp: Date.now(),
    source: 'emailActions',
    data: {
      emailId,
      ...actionData
    }
  });
}

/**
 * Trigger inbox changed event
 * 
 * @param {string} changeType - Type of change (add, change, unlink)
 * @param {string} fileName - File name that changed
 * @returns {Object} Execution result
 */
export function triggerInboxChanged(changeType, fileName) {
  console.debug('[EMAIL_CALLBACK] Triggering inbox-changed event', { 
    changeType,
    fileName 
  });
  
  return callbackRegistry.execute(EMAIL_EVENTS.INBOX_CHANGED, {
    entityId: 'inbox',
    timestamp: Date.now(),
    source: 'emailStorage',
    data: {
      changeType,
      fileName
    }
  });
}

/**
 * Trigger email validation failed event
 * 
 * @param {string} filePath - Path to the invalid email file
 * @param {Object} validationErrors - Validation error details
 * @returns {Object} Execution result
 */
export function triggerEmailValidationFailed(filePath, validationErrors = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-validation-failed event', { 
    filePath,
    errorCount: validationErrors.errors?.length || 0
  });
  
  return callbackRegistry.execute(EMAIL_EVENTS.VALIDATION_FAILED, {
    entityId: filePath,
    timestamp: Date.now(),
    source: 'emailStorage',
    data: {
      filePath,
      ...validationErrors
    }
  });
}

