/**
 * Callback Factory - Eliminates boilerplate across callback modules
 * 
 * @deprecated This factory is deprecated and will be removed in a future version.
 * The callback modules have been migrated to use the new event system directly.
 * 
 * @module callbacks/callbackFactory
 */

import { callbackRegistry } from '../callbackRegistry.js';

console.warn('[DEPRECATED] callbackFactory is deprecated. Callback modules now use the event system directly.');

/**
 * Creates a complete callback module with all standard functions
 * 
 * @deprecated Use systemEvents or domainEvents directly instead
 */
export function createCallbackModule(config) {
  console.warn('[DEPRECATED] createCallbackModule is deprecated. Use event system directly.');
  
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