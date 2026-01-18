import '../../logger.js'; // Import logging system

/**
 * Error Handler Utilities
 * 
 * This module provides standardized error handling for the file completion system.
 * It defines error types, codes, and provides utilities for creating descriptive
 * error messages and proper error propagation.
 */

/**
 * Standard error codes for file completion operations
 */
export const ERROR_CODES = {
  // Path validation errors
  INVALID_PATH: 'INVALID_PATH',
  PATH_OUTSIDE_SCOPE: 'PATH_OUTSIDE_SCOPE',
  PATH_TRAVERSAL_ATTEMPT: 'PATH_TRAVERSAL_ATTEMPT',
  MALFORMED_PATH: 'MALFORMED_PATH',
  
  // File system errors
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DIRECTORY_READ_FAILED: 'DIRECTORY_READ_FAILED',
  
  // Door-key system errors
  DIRECTORY_LOCKED: 'DIRECTORY_LOCKED',
  MISSING_KEY: 'MISSING_KEY',
  KEY_VALIDATION_FAILED: 'KEY_VALIDATION_FAILED',
  
  // Completion system errors
  NO_MATCHES_FOUND: 'NO_MATCHES_FOUND',
  PATTERN_INVALID: 'PATTERN_INVALID',
  COMPLETION_TIMEOUT: 'COMPLETION_TIMEOUT',
  
  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Custom error class for file completion operations
 */
export class FileCompletionError extends Error {
  constructor(message, code = ERROR_CODES.UNKNOWN_ERROR, details = {}) {
    super(message);
    this.name = 'FileCompletionError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(code);
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileCompletionError);
    }
  }

  /**
   * Determines error severity based on error code
   * @param {string} code - Error code
   * @returns {string} Severity level
   */
  determineSeverity(code) {
    const criticalErrors = [
      ERROR_CODES.INTERNAL_ERROR,
      ERROR_CODES.CONFIGURATION_ERROR
    ];
    
    const highErrors = [
      ERROR_CODES.PATH_TRAVERSAL_ATTEMPT,
      ERROR_CODES.DIRECTORY_READ_FAILED
    ];
    
    const mediumErrors = [
      ERROR_CODES.ACCESS_DENIED,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CODES.DIRECTORY_LOCKED
    ];
    
    if (criticalErrors.includes(code)) {
      return ERROR_SEVERITY.CRITICAL;
    } else if (highErrors.includes(code)) {
      return ERROR_SEVERITY.HIGH;
    } else if (mediumErrors.includes(code)) {
      return ERROR_SEVERITY.MEDIUM;
    } else {
      return ERROR_SEVERITY.LOW;
    }
  }

  /**
   * Converts error to a structured object for API responses
   * @returns {Object} Structured error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Creates a standardized error response for file completion operations
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(code, message, details = {}) {
  const error = new FileCompletionError(message, code, details);
  
  // Log the error with appropriate level based on severity
  logError(error);
  
  return {
    success: false,
    message: getUserFriendlyMessage(code, message, details),
    completions: [],
    commonPrefix: '',
    error: code,
    errorDetails: error.toJSON()
  };
}

/**
 * Creates a user-friendly error message based on error code and context
 * @param {string} code - Error code
 * @param {string} originalMessage - Original error message
 * @param {Object} details - Error details
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(code, originalMessage, details = {}) {
  const messages = {
    [ERROR_CODES.INVALID_PATH]: 'The specified path is invalid. Please check the path format and try again.',
    [ERROR_CODES.PATH_OUTSIDE_SCOPE]: 'Access is restricted to the game data directory. Cannot access paths outside the project scope.',
    [ERROR_CODES.PATH_TRAVERSAL_ATTEMPT]: 'Invalid path: directory traversal is not allowed for security reasons.',
    [ERROR_CODES.MALFORMED_PATH]: 'The path format is incorrect. Please use valid file path syntax.',
    
    [ERROR_CODES.DIRECTORY_NOT_FOUND]: `Directory not found: ${details.path || 'unknown path'}`,
    [ERROR_CODES.FILE_NOT_FOUND]: `File not found: ${details.path || 'unknown path'}`,
    [ERROR_CODES.ACCESS_DENIED]: 'Access denied. You do not have permission to access this location.',
    [ERROR_CODES.PERMISSION_DENIED]: 'Permission denied. The directory or file cannot be read.',
    [ERROR_CODES.DIRECTORY_READ_FAILED]: 'Failed to read directory contents. The directory may be corrupted or inaccessible.',
    
    [ERROR_CODES.DIRECTORY_LOCKED]: details.requiredKey ? 
      `Directory is locked. Required key: "${details.requiredKey}"` :
      'Directory is locked. Complete game objectives to unlock access.',
    [ERROR_CODES.MISSING_KEY]: `Missing required key: ${details.requiredKey || 'unknown key'}`,
    [ERROR_CODES.KEY_VALIDATION_FAILED]: 'Key validation failed. Please check your game progress.',
    
    [ERROR_CODES.NO_MATCHES_FOUND]: details.pattern ? 
      `No files match the pattern "${details.pattern}"` :
      'No files found in the current directory',
    [ERROR_CODES.PATTERN_INVALID]: 'The search pattern is invalid. Please use a valid file name pattern.',
    [ERROR_CODES.COMPLETION_TIMEOUT]: 'File completion timed out. The directory may contain too many files.',
    
    [ERROR_CODES.CONFIGURATION_ERROR]: 'Configuration error. Please check the game data directory settings.',
    [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred. Please try again or restart the application.',
    [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
  };

  return messages[code] || originalMessage || 'An error occurred during file completion.';
}

/**
 * Logs an error with appropriate level and context
 * @param {FileCompletionError|Error} error - Error to log
 * @param {Object} context - Additional context for logging
 */
export function logError(error, context = {}) {
  const logContext = {
    operation: 'file_completion',
    errorCode: error.code || 'UNKNOWN',
    severity: error.severity || ERROR_SEVERITY.LOW,
    timestamp: error.timestamp || new Date().toISOString(),
    ...context,
    ...error.details
  };

  // Log with appropriate level based on severity
  switch (error.severity) {
    case ERROR_SEVERITY.CRITICAL:
      console.error(`[FILE_COMPLETION] CRITICAL ERROR: ${error.message}`, logContext);
      break;
    case ERROR_SEVERITY.HIGH:
      console.error(`[FILE_COMPLETION] HIGH SEVERITY: ${error.message}`, logContext);
      break;
    case ERROR_SEVERITY.MEDIUM:
      console.warn(`[FILE_COMPLETION] MEDIUM SEVERITY: ${error.message}`, logContext);
      break;
    case ERROR_SEVERITY.LOW:
    default:
      console.debug(`[FILE_COMPLETION] ${error.message}`, logContext);
      break;
  }
}

/**
 * Wraps an operation with standardized error handling
 * @param {Function} operation - The operation to execute
 * @param {string} operationName - Name of the operation for logging
 * @param {Object} context - Additional context for error handling
 * @returns {Promise<Object>} Operation result or error response
 */
export async function withErrorHandling(operation, operationName, context = {}) {
  const startTime = Date.now();
  
  try {
    console.debug(`[FILE_COMPLETION] Starting operation: ${operationName}`, context);
    
    const result = await operation();
    
    const duration = Date.now() - startTime;
    console.debug(`[FILE_COMPLETION] Operation completed: ${operationName} (${duration}ms)`, {
      ...context,
      duration,
      success: true
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // If it's already a FileCompletionError, just log and return
    if (error instanceof FileCompletionError) {
      logError(error, { ...context, operationName, duration });
      return error.toJSON();
    }
    
    // Convert generic errors to FileCompletionError
    let errorCode = ERROR_CODES.UNKNOWN_ERROR;
    let errorMessage = error.message || 'Unknown error occurred';
    let errorDetails = { ...context, operationName, duration };
    
    // Map common Node.js errors to specific codes
    if (error.code === 'ENOENT') {
      errorCode = ERROR_CODES.DIRECTORY_NOT_FOUND;
      errorMessage = 'Directory or file not found';
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorCode = ERROR_CODES.PERMISSION_DENIED;
      errorMessage = 'Permission denied';
    } else if (error.code === 'ENOTDIR') {
      errorCode = ERROR_CODES.INVALID_PATH;
      errorMessage = 'Path is not a directory';
    } else if (error.name === 'TypeError') {
      errorCode = ERROR_CODES.MALFORMED_PATH;
      errorMessage = 'Invalid path format';
    }
    
    // Add original error details
    errorDetails.originalError = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    };
    
    const completionError = new FileCompletionError(errorMessage, errorCode, errorDetails);
    logError(completionError, { operationName, duration });
    
    return createErrorResponse(errorCode, errorMessage, errorDetails);
  }
}

/**
 * Validates input parameters and returns appropriate error if invalid
 * @param {Object} params - Parameters to validate
 * @param {Array} requiredFields - Required field names
 * @returns {Object|null} Error response if validation fails, null if valid
 */
export function validateInput(params, requiredFields = []) {
  if (!params || typeof params !== 'object') {
    return createErrorResponse(
      ERROR_CODES.MALFORMED_PATH,
      'Invalid input parameters',
      { providedParams: params }
    );
  }
  
  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null) {
      return createErrorResponse(
        ERROR_CODES.MALFORMED_PATH,
        `Missing required parameter: ${field}`,
        { missingField: field, providedParams: Object.keys(params) }
      );
    }
  }
  
  return null; // Validation passed
}

/**
 * Creates a success response with consistent structure
 * @param {Array} completions - Array of completion results
 * @param {string} commonPrefix - Common prefix for completions
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Success response
 */
export function createSuccessResponse(completions = [], commonPrefix = '', metadata = {}) {
  return {
    success: true,
    completions,
    commonPrefix,
    totalMatches: completions.length,
    message: completions.length === 0 ? 'No files found' : '',
    ...metadata
  };
}