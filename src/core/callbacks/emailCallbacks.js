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
import { domainEvents, EMAIL_EVENTS } from '../../events/domainEvents.js';

// Re-export event constants for backward compatibility
export { EMAIL_EVENTS };

// Export all functions
export function registerEmailReceivedCallback(callback, options = {}) {
  // Adapt old callback signature (eventType, eventData) to new signature (data)
  const adaptedCallback = (data) => {
    // Old callbacks expected (eventType, eventData) format
    const eventData = {
      entityId: data.entityId,
      timestamp: data.timestamp,
      source: data.source || 'emailStorage',
      data: data.data || data
    };
    return callback(EMAIL_EVENTS.RECEIVED, eventData);
  };
  return domainEvents.on(EMAIL_EVENTS.RECEIVED, adaptedCallback, options);
}

export function registerEmailReadCallback(callback, options = {}) {
  const adaptedCallback = (data) => {
    const eventData = {
      entityId: data.entityId,
      timestamp: data.timestamp,
      source: data.source || 'emailStorage',
      data: data.data || data
    };
    return callback(EMAIL_EVENTS.READ, eventData);
  };
  return domainEvents.on(EMAIL_EVENTS.READ, adaptedCallback, options);
}

export function registerEmailActionExecutedCallback(callback, options = {}) {
  const adaptedCallback = (data) => {
    const eventData = {
      entityId: data.entityId,
      timestamp: data.timestamp,
      source: data.source || 'emailActions',
      data: data.data || data
    };
    return callback(EMAIL_EVENTS.ACTION_EXECUTED, eventData);
  };
  return domainEvents.on(EMAIL_EVENTS.ACTION_EXECUTED, adaptedCallback, options);
}

export function registerInboxChangedCallback(callback, options = {}) {
  const adaptedCallback = (data) => {
    const eventData = {
      entityId: data.entityId || 'inbox',
      timestamp: data.timestamp,
      source: data.source || 'emailStorage',
      data: data.data || data
    };
    return callback(EMAIL_EVENTS.INBOX_CHANGED, eventData);
  };
  return domainEvents.on(EMAIL_EVENTS.INBOX_CHANGED, adaptedCallback, options);
}

export function registerEmailValidationFailedCallback(callback, options = {}) {
  const adaptedCallback = (data) => {
    const eventData = {
      entityId: data.entityId,
      timestamp: data.timestamp,
      source: data.source || 'emailStorage',
      data: data.data || data
    };
    return callback(EMAIL_EVENTS.VALIDATION_FAILED, eventData);
  };
  return domainEvents.on(EMAIL_EVENTS.VALIDATION_FAILED, adaptedCallback, options);
}

export function unregisterEmailCallback(registrationId) {
  return domainEvents.off(registrationId);
}

export function clearEmailCallbacks(entityId) {
  return domainEvents.cleanup(entityId);
}

export function triggerEmailReceived(emailId, data = {}) {
  // Handle both old and new calling conventions
  let actualEmailId, actualData;
  
  if (typeof emailId === 'object' && emailId !== null && !data.id) {
    // Old convention: triggerEmailReceived(emailData)
    actualData = emailId;
    actualEmailId = emailId.id || null;
  } else {
    // New convention: triggerEmailReceived(emailId, data)
    actualEmailId = emailId;
    actualData = data;
  }
  
  console.debug('[EMAIL_CALLBACK] Triggering email-received', { emailId: actualEmailId });
  return domainEvents.emit(EMAIL_EVENTS.RECEIVED, {
    entityId: actualEmailId,
    timestamp: Date.now(),
    source: 'emailStorage',
    data: actualData
  });
}

export function triggerEmailRead(emailId, data = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-read', { emailId });
  return domainEvents.emit(EMAIL_EVENTS.READ, {
    entityId: emailId,
    timestamp: Date.now(),
    source: 'emailStorage',
    data: { emailId, ...data }
  });
}

export function triggerEmailActionExecuted(emailId, data = {}) {
  console.debug('[EMAIL_CALLBACK] Triggering email-action-executed', { emailId });
  return domainEvents.emit(EMAIL_EVENTS.ACTION_EXECUTED, {
    entityId: emailId,
    timestamp: Date.now(),
    source: 'emailActions',
    data: { ...data }
  });
}

export function triggerInboxChanged(changeType, fileName) {
  console.debug('[EMAIL_CALLBACK] Triggering inbox-changed');
  return domainEvents.emit(EMAIL_EVENTS.INBOX_CHANGED, {
    entityId: 'inbox',
    timestamp: Date.now(),
    source: 'emailStorage',
    data: { changeType, fileName }
  });
}

export function triggerEmailValidationFailed(filePath, validationData) {
  console.debug('[EMAIL_CALLBACK] Triggering email-validation-failed');
  return domainEvents.emit(EMAIL_EVENTS.VALIDATION_FAILED, {
    entityId: filePath,
    timestamp: Date.now(),
    source: 'emailStorage',
    data: { filePath, ...validationData }
  });
}