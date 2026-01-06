/**
 * Event Validation Middleware
 * 
 * Middleware that validates events against registered schemas using EventRegistry.
 */

export class ValidationMiddleware {
  constructor(eventRegistry, options = {}) {
    this.eventRegistry = eventRegistry;
    this.strictMode = options.strictMode !== false; // Default to true
    this.logValidationErrors = options.logValidationErrors !== false; // Default to true
  }

  /**
   * Middleware function that validates events
   * @param {Object} event - Event to validate
   * @returns {Object} Event (potentially modified)
   */
  process(event) {
    if (!this.eventRegistry) {
      return event;
    }

    const validation = this.eventRegistry.validate(event.type, event.data);
    
    // Add validation metadata to event
    const validatedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          validatedAt: Date.now()
        }
      }
    };

    // Log validation issues
    if (this.logValidationErrors) {
      if (validation.errors.length > 0) {
        console.error(`[ValidationMiddleware] Event validation failed for '${event.type}':`, validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.warn(`[ValidationMiddleware] Event validation warnings for '${event.type}':`, validation.warnings);
      }
    }

    // In strict mode, throw error for invalid events
    if (this.strictMode && !validation.isValid) {
      throw new Error(`Event validation failed for '${event.type}': ${validation.errors.join(', ')}`);
    }

    return validatedEvent;
  }
}

/**
 * Factory function to create validation middleware
 * @param {EventRegistry} eventRegistry - Event registry instance
 * @param {Object} options - Middleware options
 * @returns {Function} Middleware function
 */
export function createValidationMiddleware(eventRegistry, options = {}) {
  const middleware = new ValidationMiddleware(eventRegistry, options);
  
  return (event) => middleware.process(event);
}