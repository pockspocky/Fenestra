/**
 * Action Logging Middleware
 * 
 * Bridges the logging system with the action callback system by adding
 * action context to log entries when available.
 */

export class ActionLoggingMiddleware {
  constructor(actionCallbackSystem = null) {
    this.actionCallbackSystem = actionCallbackSystem;
  }

  /**
   * Set the action callback system reference
   * @param {ActionCallbackSystem} actionCallbackSystem - Action callback system instance
   */
  setActionCallbackSystem(actionCallbackSystem) {
    this.actionCallbackSystem = actionCallbackSystem;
  }

  /**
   * Middleware function that enriches log entries with action context
   * @param {Object} logEntry - Original log entry
   * @returns {Object} Enhanced log entry with action context
   */
  process(logEntry) {
    if (!this.actionCallbackSystem) {
      return logEntry;
    }

    const currentAction = this.actionCallbackSystem.getCurrentAction();
    
    if (currentAction) {
      return {
        ...logEntry,
        meta: {
          ...logEntry.meta,
          action: {
            name: currentAction.action,
            source: currentAction.source,
            phase: currentAction.phase,
            timestamp: currentAction.timestamp,
            correlationId: currentAction.correlationId
          }
        }
      };
    }

    return logEntry;
  }
}

/**
 * Factory function to create action logging middleware
 * @param {ActionCallbackSystem} actionCallbackSystem - Action callback system instance
 * @returns {Function} Middleware function
 */
export function createActionLoggingMiddleware(actionCallbackSystem = null) {
  const middleware = new ActionLoggingMiddleware(actionCallbackSystem);
  
  return (logEntry) => middleware.process(logEntry);
}