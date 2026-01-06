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
import { createCallbackModule } from './callbackFactory.js';

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

// Create the callback module using the factory
const emailCallbacks = createCallbackModule({
  eventTypes: EMAIL_EVENTS,
  moduleName: 'emailSystem',
  debugPrefix: '[EMAIL_CALLBACK]'
});

// Export all functions
export const registerEmailReceivedCallback = emailCallbacks.registerRECEIVEDCallback;
export const registerEmailReadCallback = emailCallbacks.registerREADCallback;
export const registerEmailActionExecutedCallback = emailCallbacks.registerACTION_EXECUTEDCallback;
export const registerInboxChangedCallback = emailCallbacks.registerINBOX_CHANGEDCallback;
export const registerEmailValidationFailedCallback = emailCallbacks.registerVALIDATION_FAILEDCallback;

export const unregisterEmailCallback = emailCallbacks.unregister;
export const clearEmailCallbacks = emailCallbacks.clear;

export function triggerEmailReceived(emailId, data = {}) {
  return emailCallbacks.triggerRECEIVED(emailId, data);
}

export function triggerEmailRead(emailId, data = {}) {
  return emailCallbacks.triggerREAD(emailId, data);
}

export function triggerEmailActionExecuted(emailId, data = {}) {
  return emailCallbacks.triggerACTION_EXECUTED(emailId, data);
}

export function triggerInboxChanged(data = {}) {
  return emailCallbacks.triggerINBOX_CHANGED(null, data);
}

export function triggerEmailValidationFailed(data = {}) {
  return emailCallbacks.triggerVALIDATION_FAILED(null, data);
}