/**
 * Configuration Schemas
 * 
 * Defines validation schemas for different configuration sections
 */

export const LOGGING_SCHEMA = {
  type: 'object',
  required: ['level', 'transports'],
  properties: {
    level: {
      type: 'string',
      enum: ['debug', 'info', 'warn', 'error', 'none']
    },
    modules: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error', 'none']
      }
    },
    transports: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['console', 'file', 'remote']
          },
          level: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error', 'none']
          },
          format: {
            type: 'string',
            enum: ['json', 'pretty']
          },
          options: {
            type: 'object'
          }
        }
      }
    }
  }
};

export const ACTION_CALLBACKS_SCHEMA = {
  type: 'object',
  properties: {
    errorIsolation: {
      type: 'boolean'
    },
    defaultLogging: {
      type: 'boolean'
    },
    performanceThreshold: {
      type: 'number',
      minimum: 0
    }
  }
};

export const WINDOW_MANAGEMENT_SCHEMA = {
  type: 'object',
  properties: {
    defaults: {
      type: 'object',
      properties: {
        width: {
          type: 'number',
          minimum: 100
        },
        height: {
          type: 'number',
          minimum: 100
        },
        resizable: {
          type: 'boolean'
        },
        show: {
          type: 'boolean'
        }
      }
    },
    positioning: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['center', 'cascade', 'manual']
        },
        offset: {
          type: 'number',
          minimum: 0
        }
      }
    }
  }
};

export const RESOURCE_MANAGEMENT_SCHEMA = {
  type: 'object',
  properties: {
    cache: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean'
        },
        maxSize: {
          type: 'number',
          minimum: 0
        },
        ttl: {
          type: 'number',
          minimum: 0
        }
      }
    },
    watching: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean'
        },
        debounceMs: {
          type: 'number',
          minimum: 0
        }
      }
    }
  }
};

export const PERFORMANCE_MONITORING_SCHEMA = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean'
    },
    thresholds: {
      type: 'object',
      properties: {
        slow: {
          type: 'number',
          minimum: 0
        },
        warning: {
          type: 'number',
          minimum: 0
        },
        critical: {
          type: 'number',
          minimum: 0
        }
      }
    },
    sampling: {
      type: 'object',
      properties: {
        rate: {
          type: 'number',
          minimum: 0,
          maximum: 1
        }
      }
    }
  }
};

export const GAME_SCHEMA = {
  type: 'object',
  properties: {
    dataDirectory: {
      type: 'string'
    },
    autoSave: {
      type: 'boolean'
    },
    autoSaveInterval: {
      type: 'number',
      minimum: 1000
    },
    maxSaveFiles: {
      type: 'number',
      minimum: 1
    }
  }
};

export const ALL_SCHEMAS = {
  logging: LOGGING_SCHEMA,
  actionCallbacks: ACTION_CALLBACKS_SCHEMA,
  windowManagement: WINDOW_MANAGEMENT_SCHEMA,
  resourceManagement: RESOURCE_MANAGEMENT_SCHEMA,
  performanceMonitoring: PERFORMANCE_MONITORING_SCHEMA,
  game: GAME_SCHEMA
};