/**
 * IPC Handler Callbacks Integration
 * 
 * Provides callback integration for IPC (Inter-Process Communication) handlers.
 * Supports before/after/error callbacks for IPC operations with prevention mechanism.
 * 
 * @module ipcCallbacks
 */

import { domainEvents, IPC_EVENTS } from '../../events/domainEvents.js';
import '../../../logger.js';

// Re-export event constants for backward compatibility
export { IPC_EVENTS };

// Export all functions
export function registerIPCBeforeCallback(callback, options = {}) {
  return domainEvents.on(IPC_EVENTS.BEFORE, callback, options);
}

export function registerIPCAfterCallback(callback, options = {}) {
  return domainEvents.on(IPC_EVENTS.AFTER, callback, options);
}

export function registerIPCErrorCallback(callback, options = {}) {
  return domainEvents.on(IPC_EVENTS.ERROR, callback, options);
}

export function unregisterIPCCallback(registrationId) {
  return domainEvents.off(registrationId);
}

export function clearIPCCallbacks(entityId) {
  return domainEvents.cleanup(entityId);
}

export function triggerIPCBefore(channel, args = []) {
  console.debug('[IPC_CALLBACK] Triggering ipc-before', { channel });
  return domainEvents.emit(IPC_EVENTS.BEFORE, {
    entityId: channel,
    channel,
    args,
    timestamp: Date.now(),
    source: 'ipcHandler'
  });
}

export function triggerIPCAfter(channel, args = [], result = null) {
  console.debug('[IPC_CALLBACK] Triggering ipc-after', { channel });
  return domainEvents.emit(IPC_EVENTS.AFTER, {
    entityId: channel,
    channel,
    args,
    result,
    timestamp: Date.now(),
    source: 'ipcHandler'
  });
}

export function triggerIPCError(channel, args = [], error = null) {
  console.debug('[IPC_CALLBACK] Triggering ipc-error', { channel });
  return domainEvents.emit(IPC_EVENTS.ERROR, {
    entityId: channel,
    channel,
    args,
    error,
    timestamp: Date.now(),
    source: 'ipcHandler'
  });
}

/**
 * Wrap an IPC handler with callback execution
 * 
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Original IPC handler function
 * @param {Object} options - Wrapping options
 * @param {boolean} [options.allowPrevention=true] - Allow before callbacks to prevent execution
 * @returns {Function} Wrapped handler function
 * 
 * @example
 * const wrappedHandler = wrapIpcHandler('game/window/create', originalHandler);
 * ipcMain.handle('game/window/create', wrappedHandler);
 */
export function wrapIpcHandler(channel, handler, options = {}) {
  const { allowPrevention = true } = options;

  return async (event, ...args) => {
    try {
      // Execute before callbacks
      const beforeResult = triggerIPCBefore(channel, args);
      
      // Note: New event system doesn't support preventDefault in the same way
      // This is a simplified version for compatibility
      if (allowPrevention && beforeResult.errors > 0) {
        console.debug(`[IPC_CALLBACK] Handler execution prevented for channel: ${channel}`);
        return null;
      }

      // Execute the original handler
      const result = await handler(event, ...args);
      
      // Execute after callbacks
      triggerIPCAfter(channel, args, result);
      
      return result;
    } catch (error) {
      // Execute error callbacks
      triggerIPCError(channel, args, error);
      throw error;
    }
  };
}