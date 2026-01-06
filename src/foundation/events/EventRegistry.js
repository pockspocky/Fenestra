/**
 * Event Registry Implementation
 * 
 * Provides schema validation and type-safe event handling for the event system.
 * Allows registration of event schemas and validation of event data.
 */

export class EventRegistry {
  constructor() {
    this.schemas = new Map(); // event type -> schema
    this.validators = new Map(); // event type -> validator function
  }

  /**
   * Register an event schema
   * @param {string} eventType - Event type name
   * @param {Object} schema - Event schema definition
   * @param {Function} validator - Optional custom validator function
   */
  registerSchema(eventType, schema, validator = null) {
    this.schemas.set(eventType, schema);
    
    if (validator) {
      this.validators.set(eventType, validator);
    } else {
      // Create default validator from schema
      this.validators.set(eventType, this._createDefaultValidator(schema));
    }
  }

  /**
   * Validate event data against registered schema
   * @param {string} eventType - Event type
   * @param {any} data - Event data to validate
   * @returns {Object} Validation result
   */
  validate(eventType, data) {
    const validator = this.validators.get(eventType);
    
    if (!validator) {
      return {
        isValid: true,
        errors: [],
        warnings: [`No schema registered for event type: ${eventType}`]
      };
    }

    try {
      return validator(data);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get registered schema for an event type
   * @param {string} eventType - Event type
   * @returns {Object|null} Schema or null if not found
   */
  getSchema(eventType) {
    return this.schemas.get(eventType) || null;
  }

  /**
   * Get all registered event types
   * @returns {string[]} Array of event types
   */
  getEventTypes() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Check if an event type is registered
   * @param {string} eventType - Event type
   * @returns {boolean} Whether the event type is registered
   */
  isRegistered(eventType) {
    return this.schemas.has(eventType);
  }

  /**
   * Unregister an event schema
   * @param {string} eventType - Event type to unregister
   * @returns {boolean} Whether the event type was found and removed
   */
  unregister(eventType) {
    const hadSchema = this.schemas.delete(eventType);
    const hadValidator = this.validators.delete(eventType);
    return hadSchema || hadValidator;
  }

  /**
   * Clear all registered schemas
   */
  clear() {
    this.schemas.clear();
    this.validators.clear();
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics about the registry
   */
  getStats() {
    return {
      totalSchemas: this.schemas.size,
      eventTypes: this.getEventTypes()
    };
  }

  /**
   * Create a default validator from schema
   * @private
   */
  _createDefaultValidator(schema) {
    return (data) => {
      const errors = [];
      const warnings = [];

      // Validate required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (data === null || data === undefined || !(field in data)) {
            errors.push(`Required field '${field}' is missing`);
          }
        }
      }

      // Validate field types
      if (schema.properties && data && typeof data === 'object') {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
          if (field in data) {
            const fieldErrors = this._validateField(field, data[field], fieldSchema);
            errors.push(...fieldErrors);
          }
        }
      }

      // Check for unknown fields if strict mode
      if (schema.strict && data && typeof data === 'object') {
        const allowedFields = new Set(Object.keys(schema.properties || {}));
        for (const field of Object.keys(data)) {
          if (!allowedFields.has(field)) {
            warnings.push(`Unknown field '${field}' in event data`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    };
  }

  /**
   * Validate a single field
   * @private
   */
  _validateField(fieldName, value, fieldSchema) {
    const errors = [];

    // Type validation
    if (fieldSchema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== fieldSchema.type) {
        errors.push(`Field '${fieldName}' should be of type '${fieldSchema.type}', got '${actualType}'`);
      }
    }

    // String validations
    if (fieldSchema.type === 'string' && typeof value === 'string') {
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        errors.push(`Field '${fieldName}' should have minimum length ${fieldSchema.minLength}`);
      }
      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        errors.push(`Field '${fieldName}' should have maximum length ${fieldSchema.maxLength}`);
      }
      if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(value)) {
        errors.push(`Field '${fieldName}' does not match required pattern`);
      }
    }

    // Number validations
    if (fieldSchema.type === 'number' && typeof value === 'number') {
      if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
        errors.push(`Field '${fieldName}' should be >= ${fieldSchema.minimum}`);
      }
      if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
        errors.push(`Field '${fieldName}' should be <= ${fieldSchema.maximum}`);
      }
    }

    // Array validations
    if (fieldSchema.type === 'array' && Array.isArray(value)) {
      if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
        errors.push(`Field '${fieldName}' should have minimum ${fieldSchema.minItems} items`);
      }
      if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
        errors.push(`Field '${fieldName}' should have maximum ${fieldSchema.maxItems} items`);
      }
    }

    // Enum validation
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push(`Field '${fieldName}' should be one of: ${fieldSchema.enum.join(', ')}`);
    }

    return errors;
  }
}