/**
 * Email JSON Schema Validator
 * Provides strict schema validation for email JSON files and actions
 */

import '../../logger.js';

// Email JSON Schema Definition
const EMAIL_JSON_SCHEMA = {
  type: 'object',
  required: ['id', 'senderName', 'senderEmail', 'subject', 'body', 'timestamp', 'isRead'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    senderName: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    senderEmail: {
      type: 'string',
      format: 'email',
      maxLength: 254
    },
    recipientEmail: {
      type: 'string',
      format: 'email',
      maxLength: 254
    },
    subject: {
      type: 'string',
      minLength: 1,
      maxLength: 200
    },
    body: {
      type: 'string',
      minLength: 1,
      maxLength: 10000
    },
    bodyType: {
      type: 'string',
      enum: ['text', 'html']
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    },
    isRead: {
      type: 'boolean'
    },
    priority: {
      type: 'string',
      enum: ['low', 'normal', 'high']
    },
    attachments: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['fileName', 'fileSize', 'filePath'],
        properties: {
          fileName: {
            type: 'string',
            minLength: 1,
            maxLength: 255
          },
          fileSize: {
            type: 'number',
            minimum: 0,
            maximum: 104857600 // 100MB max
          },
          filePath: {
            type: 'string',
            minLength: 1,
            maxLength: 500
          },
          mimeType: {
            type: 'string',
            maxLength: 100
          }
        },
        additionalProperties: false
      }
    },
    actions: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        required: ['label', 'type', 'parameters'],
        properties: {
          label: {
            type: 'string',
            minLength: 1,
            maxLength: 100
          },
          type: {
            type: 'string',
            enum: ['createWindow', 'createDoor', 'createLens', 'executeFunction', 'openPath', 'callback']
          },
          parameters: {
            type: 'object'
          },
          description: {
            type: 'string',
            maxLength: 500
          }
        },
        additionalProperties: false
      }
    },
    metadata: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          maxLength: 100
        },
        category: {
          type: 'string',
          maxLength: 50
        },
        tags: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'string',
            maxLength: 30
          }
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// Action Parameter Schemas
const ACTION_PARAMETER_SCHEMAS = {
  createWindow: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      width: {
        type: 'number',
        minimum: 100,
        maximum: 3840
      },
      height: {
        type: 'number',
        minimum: 100,
        maximum: 2160
      },
      title: {
        type: 'string',
        maxLength: 100
      },
      otherContents: {
        type: 'string',
        maxLength: 100
      }
    },
    additionalProperties: false
  },
  createDoor: {
    type: 'object',
    required: ['doorId'],
    properties: {
      doorId: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      title: {
        type: 'string',
        maxLength: 100
      },
      encrypt: {
        type: 'boolean'
      },
      otherContents: {
        type: 'string',
        maxLength: 100
      }
    },
    additionalProperties: false
  },
  createLens: {
    type: 'object',
    required: ['lensId', 'targetWindowId'],
    properties: {
      lensId: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      targetWindowId: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      width: {
        type: 'number',
        minimum: 100,
        maximum: 1920
      },
      height: {
        type: 'number',
        minimum: 100,
        maximum: 1080
      }
    },
    additionalProperties: false
  },
  executeFunction: {
    type: 'object',
    required: ['functionName'],
    properties: {
      functionName: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-zA-Z][a-zA-Z0-9_.]*$'
      },
      args: {
        type: 'array',
        maxItems: 10,
        items: {
          oneOf: [
            { type: 'string', maxLength: 1000 },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'null' }
          ]
        }
      }
    },
    additionalProperties: false
  },
  openPath: {
    type: 'object',
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        minLength: 1,
        maxLength: 500
      }
    },
    additionalProperties: false
  },
  callback: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-zA-Z][a-zA-Z0-9_]*$'
      },
      args: {
        type: 'array',
        maxItems: 10,
        items: {
          oneOf: [
            { type: 'string', maxLength: 1000 },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'null' }
          ]
        }
      }
    },
    additionalProperties: false
  }
};

/**
 * Email Schema Validator Class
 */
export class EmailSchemaValidator {
  constructor() {
    this.emailSchema = EMAIL_JSON_SCHEMA;
    this.actionSchemas = ACTION_PARAMETER_SCHEMAS;
  }

  /**
   * Validates email JSON against schema
   * @param {Object} emailData - Email data to validate
   * @returns {Object} Validation result
   */
  validateEmailJson(emailData) {
    try {
      const validation = this._validateObject(emailData, this.emailSchema, 'email');
      
      if (!validation.isValid) {
        console.warn('[EMAIL_SCHEMA] Email JSON validation failed', {
          errors: validation.errors,
          emailId: emailData?.id
        });
      }

      return validation;
    } catch (error) {
      console.error('[EMAIL_SCHEMA] Email validation error', {
        error: error.message,
        emailId: emailData?.id
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validates email action against schema
   * @param {Object} action - Action to validate
   * @returns {Object} Validation result
   */
  validateEmailAction(action) {
    try {
      // Basic action structure validation
      const basicValidation = this._validateObject(action, {
        type: 'object',
        required: ['label', 'type', 'parameters'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: Object.keys(this.actionSchemas) },
          parameters: { type: 'object' }
        }
      }, 'action');

      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Validate action parameters against specific schema
      const parameterSchema = this.actionSchemas[action.type];
      if (parameterSchema) {
        const paramValidation = this._validateObject(
          action.parameters, 
          parameterSchema, 
          `${action.type} parameters`
        );

        if (!paramValidation.isValid) {
          return {
            isValid: false,
            errors: paramValidation.errors.map(err => `Parameter validation: ${err}`),
            warnings: paramValidation.warnings
          };
        }
      }

      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      console.error('[EMAIL_SCHEMA] Action validation error', {
        error: error.message,
        actionType: action?.type
      });

      return {
        isValid: false,
        errors: [`Action validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validates multiple email actions
   * @param {Array} actions - Array of actions to validate
   * @returns {Object} Validation result with per-action details
   */
  validateEmailActions(actions) {
    if (!Array.isArray(actions)) {
      return {
        isValid: false,
        errors: ['Actions must be an array'],
        warnings: [],
        actionResults: []
      };
    }

    const actionResults = [];
    let hasErrors = false;
    const allErrors = [];
    const allWarnings = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const validation = this.validateEmailAction(action);
      
      actionResults.push({
        index: i,
        actionType: action?.type,
        actionLabel: action?.label,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (!validation.isValid) {
        hasErrors = true;
        allErrors.push(...validation.errors.map(err => `Action ${i} (${action?.type}): ${err}`));
      }

      allWarnings.push(...validation.warnings.map(warn => `Action ${i} (${action?.type}): ${warn}`));
    }

    return {
      isValid: !hasErrors,
      errors: allErrors,
      warnings: allWarnings,
      actionResults,
      totalActions: actions.length,
      validActions: actionResults.filter(r => r.isValid).length
    };
  }

  /**
   * Gets the email JSON schema
   * @returns {Object} Email JSON schema
   */
  getEmailSchema() {
    return { ...this.emailSchema };
  }

  /**
   * Gets action parameter schemas
   * @returns {Object} Action parameter schemas
   */
  getActionSchemas() {
    return { ...this.actionSchemas };
  }

  /**
   * Adds custom action schema
   * @param {string} actionType - Action type name
   * @param {Object} schema - JSON schema for action parameters
   * @returns {Object} Addition result
   */
  addActionSchema(actionType, schema) {
    try {
      if (!actionType || typeof actionType !== 'string') {
        return {
          success: false,
          error: 'Action type must be a non-empty string'
        };
      }

      if (!schema || typeof schema !== 'object') {
        return {
          success: false,
          error: 'Schema must be an object'
        };
      }

      this.actionSchemas[actionType] = schema;

      console.log('[EMAIL_SCHEMA] Custom action schema added', {
        actionType,
        schemaKeys: Object.keys(schema)
      });

      return {
        success: true,
        actionType
      };
    } catch (error) {
      console.error('[EMAIL_SCHEMA] Failed to add action schema', {
        actionType,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private methods

  /**
   * Validates object against JSON schema
   * @private
   */
  _validateObject(obj, schema, context = 'object') {
    const errors = [];
    const warnings = [];

    try {
      this._validateSchema(obj, schema, '', errors, warnings);
    } catch (error) {
      errors.push(`Schema validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Recursive schema validation
   * @private
   */
  _validateSchema(value, schema, path, errors, warnings) {
    // Type validation
    if (schema.type) {
      const actualType = this._getType(value);
      if (actualType !== schema.type) {
        errors.push(`${path || 'root'}: expected ${schema.type}, got ${actualType}`);
        return;
      }
    }

    // Required properties validation
    if (schema.required && schema.type === 'object') {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in value)) {
          errors.push(`${path || 'root'}: missing required property '${requiredProp}'`);
        }
      }
    }

    // Properties validation
    if (schema.properties && schema.type === 'object') {
      for (const [propName, propValue] of Object.entries(value)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          this._validateSchema(
            propValue, 
            propSchema, 
            path ? `${path}.${propName}` : propName, 
            errors, 
            warnings
          );
        } else if (schema.additionalProperties === false) {
          errors.push(`${path || 'root'}: unexpected property '${propName}'`);
        }
      }
    }

    // Array validation
    if (schema.type === 'array') {
      if (schema.maxItems && value.length > schema.maxItems) {
        errors.push(`${path || 'root'}: array too long (max ${schema.maxItems})`);
      }

      if (schema.items) {
        value.forEach((item, index) => {
          this._validateSchema(
            item, 
            schema.items, 
            `${path || 'root'}[${index}]`, 
            errors, 
            warnings
          );
        });
      }
    }

    // String validation
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${path || 'root'}: string too short (min ${schema.minLength})`);
      }

      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`${path || 'root'}: string too long (max ${schema.maxLength})`);
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${path || 'root'}: string does not match pattern`);
      }

      if (schema.format === 'email' && !this._isValidEmail(value)) {
        errors.push(`${path || 'root'}: invalid email format`);
      }

      if (schema.format === 'date-time' && !this._isValidDateTime(value)) {
        errors.push(`${path || 'root'}: invalid date-time format`);
      }

      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path || 'root'}: value not in allowed enum values`);
      }
    }

    // Number validation
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path || 'root'}: number too small (min ${schema.minimum})`);
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path || 'root'}: number too large (max ${schema.maximum})`);
      }
    }
  }

  /**
   * Gets JavaScript type of value
   * @private
   */
  _getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Validates email format
   * @private
   */
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates ISO 8601 date-time format
   * @private
   */
  _isValidDateTime(dateTime) {
    try {
      const date = new Date(dateTime);
      return !isNaN(date.getTime()) && dateTime.includes('T');
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const emailSchemaValidator = new EmailSchemaValidator();