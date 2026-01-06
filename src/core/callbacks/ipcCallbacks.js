/**
 * IPC Handler Callbacks Integration
 * 
 * Provides callback integration for IPC (Inter-Process Communication) handlers.
 * Supports before/after/error callbacks for IPC operations with prevention mechanism.
 * 
 * @module ipcCallbacks
 */

import { createCallbackModule } from './callbackFactory.js';
import '../../../logger.js';

/**
 * IPC event types
 */
export const IPC_EVENTS = {
  BEFORE: 'ipc-before',
  AFTER: 'ipc-after',
  ERROR: 'ipc-error'
};

// Create the callback module using the factory
const ipcCallbacks = createCallbackModule({
  eventTypes: IPC_EVENTS,
  moduleName: 'ipcHandler',
  debugPrefix: '[IPC_CALLBACK]'
});

// Export all functions
export const registerIPCBeforeCallback = ipcCallbacks.registerBEFORECallback;
export const registerIPCAfterCallback = ipcCallbacks.registerAFTERCallback;
export const registerIPCErrorCallback = ipcCallbacks.registerERRORCallback;

export const unregisterIPCCallback = ipcCallbacks.unregister;
export const clearIPCCallbacks = ipcCallbacks.clear;

export function triggerIPCBefore(channel, args = []) {
  return ipcCallbacks.triggerBEFORE(channel, { channel, args });
}

export function triggerIPCAfter(channel, args = [], result = null) {
  return ipcCallbacks.triggerAFTER(channel, { channel, args, result });
}

export function triggerIPCError(channel, args = [], error = null) {
  return ipcCallbacks.triggerERROR(channel, { channel, args, error });
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
      
      if (allowPrevention && beforeResult.prevented) {
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