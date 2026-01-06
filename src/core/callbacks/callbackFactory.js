/**
 * Callback Factory - Eliminates boilerplate across callback modules
 * 
 * This factory generates all the register/trigger/unregister functions
 * that are currently duplicated across 7 callback modules.
 * 
 * @module callbacks/callbackFactory
 */

import { callbackRegistry } from '../callbackRegistry.js';

/**
 * Creates a complete callback module with all standard functions
 * 
 * @param {Object} config - Configuration for the callback module
 * @param {Object} config.eventTypes - Event type constants (e.g., {CREATED: 'window-created'})
 * @param {string} config.moduleName - Module name for source field (e.g., 'windowManager')
 * @param {string} config.debugPrefix - Debug log prefix (e.g., '[WINDOW_CALLBACK]')
 * @param {string} [config.entityIdField='entityId'] - Field name for entity ID
 * @returns {Object} Complete callback module with all functions
 * 
 * @example
 * const windowCallbacks = createCallbackModule({
 *   eventTypes: { CREATED: 'window-created', CLOSED: 'window-closed' },
 *   moduleName: 'windowManager',
 *   debugPrefix: '[WINDOW_CALLBACK]'
 * });
 */
export function createCallbackModule(config) {
  const {
    eventTypes,
    moduleName,
    debugPrefix,
    entityIdField = 'entityId',
    sourceField = moduleName
  } = config;

  const callbacks = {};

  // Generate register functions for each event type
  for (const [eventKey, eventName] of Object.entries(eventTypes)) {
    const functionName = `register${eventKey}Callback`;
    callbacks[functionName] = (callback, options = {}) => {
      return callbackRegistry.register(eventName, callback, options);
    };
  }

  // Generate trigger functions for each event type
  for (const [eventKey, eventName] of Object.entries(eventTypes)) {
    const functionName = `trigger${eventKey}`;
    callbacks[functionName] = (entityId, ...args) => {
      console.debug(`${debugPrefix} Triggering ${eventName}`, { entityId });
      
      // Handle different argument patterns
      let data = {};
      if (args.length === 1 && typeof args[0] === 'object') {
        data = args[0];
      } else if (args.length > 1) {
        // For functions with multiple specific parameters
        data = args.reduce((acc, arg, index) => {
          if (typeof arg === 'object' && arg !== null) {
            return { ...acc, ...arg };
          }
          return acc;
        }, {});
      }
      
      return callbackRegistry.execute(eventName, {
        [entityIdField]: entityId,
        timestamp: Date.now(),
        source: sourceField,
        data
      });
    };
  }

  // Generate unregister function
  callbacks.unregister = (registrationId) => {
    return callbackRegistry.unregister(registrationId);
  };

  // Generate clear function
  callbacks.clear = (entityId) => {
    return callbackRegistry.clearEntity(entityId);
  };

  // Export event types
  callbacks.eventTypes = eventTypes;

  return callbacks;
}