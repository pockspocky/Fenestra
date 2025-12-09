/**
 * IPC Handler Callbacks Integration
 * 
 * Provides callback integration for IPC (Inter-Process Communication) handlers.
 * Supports before/after/error callbacks for IPC operations with prevention mechanism.
 * 
 * @module ipcCallbacks
 */

import { callbackRegistry } from '../callbackRegistry.js';
import '../../../logger.js';

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
    const context = {
      channel,
      args,
      event,
      timestamp: Date.now()
    };

    console.debug('[IPC_CALLBACKS] IPC handler invoked', {
      channel,
      argsCount: args.length
    });

    // Execute before callbacks
    const beforeEventType = `ipc-before-${channel}`;
    const beforeResult = callbackRegistry.execute(beforeEventType, {
      entityId: channel,
      timestamp: context.timestamp,
      source: 'ipcHandler',
      data: {
        channel,
        args,
        event: {
          sender: event.sender?.id,
          frameId: event.frameId
        }
      }
    });
    
    console.debug('[IPC_CALLBACKS] Before callbacks executed', {
      channel,
      beforeEventType,
      executed: beforeResult.executed,
      prevented: beforeResult.prevented
    });

    // Check if execution should be prevented
    if (allowPrevention && beforeResult.prevented) {
      console.warn('[IPC_CALLBACKS] IPC handler execution prevented by before callback', {
        channel
      });

      return {
        success: false,
        error: 'Operation prevented by callback',
        prevented: true
      };
    }
    
    console.debug('[IPC_CALLBACKS] About to execute handler', { channel });

    // Execute the original handler
    let handlerResult;
    let handlerError = null;

    try {
      handlerResult = await handler(event, ...args);
      
      // Execute after callbacks only on success
      const afterEventType = `ipc-after-${channel}`;
      const afterResult = callbackRegistry.execute(afterEventType, {
        entityId: channel,
        timestamp: Date.now(),
        source: 'ipcHandler',
        data: {
          channel,
          args,
          result: handlerResult
        }
      });
      
      console.debug('[IPC_CALLBACKS] After callbacks executed', {
        channel,
        afterEventType,
        executed: afterResult.executed
      });

      return handlerResult;
    } catch (error) {
      handlerError = error;
      console.error('[IPC_CALLBACKS] IPC handler error', {
        channel,
        error: error.message,
        stack: error.stack
      });

      // Execute error callbacks
      const errorEventType = `ipc-error-${channel}`;
      const errorResult = callbackRegistry.execute(errorEventType, {
        entityId: channel,
        timestamp: Date.now(),
        source: 'ipcHandler',
        data: {
          channel,
          args,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        }
      });
      
      console.debug('[IPC_CALLBACKS] Error callbacks executed', {
        channel,
        errorEventType,
        executed: errorResult.executed
      });

      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Register a before callback for an IPC channel
 * 
 * @param {string} channel - IPC channel name or pattern
 * @param {Function} callback - Callback function
 * @param {Object} options - Registration options
 * @returns {string} Registration ID
 * 
 * @example
 * registerIpcBeforeCallback('game/window/create', (eventType, eventData) => {
 *   console.log('Before window creation:', eventData.data.args);
 * });
 */
export function registerIpcBeforeCallback(channel, callback, options = {}) {
  const eventType = `ipc-before-${channel}`;
  return callbackRegistry.register(eventType, callback, {
    ...options,
    entityId: channel
  });
}

/**
 * Register an after callback for an IPC channel
 * 
 * @param {string} channel - IPC channel name or pattern
 * @param {Function} callback - Callback function
 * @param {Object} options - Registration options
 * @returns {string} Registration ID
 * 
 * @example
 * registerIpcAfterCallback('game/window/create', (eventType, eventData) => {
 *   console.log('After window creation:', eventData.data.result);
 * });
 */
export function registerIpcAfterCallback(channel, callback, options = {}) {
  const eventType = `ipc-after-${channel}`;
  return callbackRegistry.register(eventType, callback, {
    ...options,
    entityId: channel
  });
}

/**
 * Register an error callback for an IPC channel
 * 
 * @param {string} channel - IPC channel name or pattern
 * @param {Function} callback - Callback function
 * @param {Object} options - Registration options
 * @returns {string} Registration ID
 * 
 * @example
 * registerIpcErrorCallback('game/window/create', (eventType, eventData) => {
 *   console.error('Window creation error:', eventData.data.error);
 * });
 */
export function registerIpcErrorCallback(channel, callback, options = {}) {
  const eventType = `ipc-error-${channel}`;
  return callbackRegistry.register(eventType, callback, {
    ...options,
    entityId: channel
  });
}

/**
 * Register callbacks for all IPC lifecycle events (before, after, error)
 * 
 * @param {string} channel - IPC channel name
 * @param {Object} callbacks - Callback functions
 * @param {Function} [callbacks.before] - Before callback
 * @param {Function} [callbacks.after] - After callback
 * @param {Function} [callbacks.error] - Error callback
 * @param {Object} options - Registration options
 * @returns {Object} Registration IDs for each callback
 * 
 * @example
 * registerIpcLifecycleCallbacks('game/window/create', {
 *   before: (eventType, eventData) => console.log('Before'),
 *   after: (eventType, eventData) => console.log('After'),
 *   error: (eventType, eventData) => console.error('Error')
 * });
 */
export function registerIpcLifecycleCallbacks(channel, callbacks, options = {}) {
  const registrationIds = {};

  if (callbacks.before) {
    registrationIds.before = registerIpcBeforeCallback(channel, callbacks.before, options);
  }

  if (callbacks.after) {
    registrationIds.after = registerIpcAfterCallback(channel, callbacks.after, options);
  }

  if (callbacks.error) {
    registrationIds.error = registerIpcErrorCallback(channel, callbacks.error, options);
  }

  return registrationIds;
}

/**
 * Unregister all callbacks for an IPC channel
 * 
 * @param {string} channel - IPC channel name
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearIpcCallbacks('game/window/create');
 */
export function clearIpcCallbacks(channel) {
  return callbackRegistry.clearEntity(channel);
}

/**
 * Check if a channel matches a pattern
 * Supports wildcards (*) for pattern matching
 * 
 * @param {string} channel - Channel name to test
 * @param {string} pattern - Pattern to match against
 * @returns {boolean} True if channel matches pattern
 * 
 * @example
 * matchesChannelPattern('game/window/create', 'game/window/*'); // true
 * matchesChannelPattern('game/window/create', 'game/*'); // true
 * matchesChannelPattern('game/window/create', 'email/*'); // false
 */
export function matchesChannelPattern(channel, pattern) {
  // Exact match
  if (channel === pattern) {
    return true;
  }

  // No wildcard - no match
  if (!pattern.includes('*')) {
    return false;
  }

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*'); // Replace * with .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(channel);
}

/**
 * Register a callback for multiple channels matching a pattern
 * 
 * @param {string} pattern - Channel pattern (supports wildcards)
 * @param {string} eventPhase - Event phase: 'before', 'after', or 'error'
 * @param {Function} callback - Callback function
 * @param {Object} options - Registration options
 * @returns {Array<string>} Array of registration IDs
 * 
 * @example
 * // Register for all window-related IPC channels
 * registerIpcPatternCallback('game/window/*', 'before', (eventType, eventData) => {
 *   console.log('Window IPC operation:', eventData.data.channel);
 * });
 */
export function registerIpcPatternCallback(pattern, eventPhase, callback, options = {}) {
  // For pattern-based registration, we create a wrapper callback that checks the pattern
  const wrappedCallback = (eventType, eventData) => {
    const channel = eventData.data?.channel || eventData.entityId;
    
    if (matchesChannelPattern(channel, pattern)) {
      return callback(eventType, eventData);
    }
  };

  // Register as a global callback for the event phase
  const eventType = `ipc-${eventPhase}-${pattern}`;
  return callbackRegistry.register(eventType, wrappedCallback, {
    ...options,
    entityId: null // Global callback
  });
}

