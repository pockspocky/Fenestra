# Enhanced Error Handling System

This document describes the enhanced error handling system implemented for the file completion functionality.

## Overview

The enhanced error handling system provides:
- Standardized error codes and types
- User-friendly error messages
- Detailed logging for debugging
- Proper error propagation through the completion system
- Consistent error response formats

## Error Codes

### Path Validation Errors
- `INVALID_PATH`: Invalid path format or structure
- `PATH_OUTSIDE_SCOPE`: Path attempts to access outside game data directory
- `PATH_TRAVERSAL_ATTEMPT`: Path contains directory traversal sequences
- `MALFORMED_PATH`: Path format is incorrect or malformed

### File System Errors
- `DIRECTORY_NOT_FOUND`: Directory does not exist
- `FILE_NOT_FOUND`: File does not exist
- `ACCESS_DENIED`: General access denied
- `PERMISSION_DENIED`: Insufficient permissions
- `DIRECTORY_READ_FAILED`: Failed to read directory contents

### Door-Key System Errors
- `DIRECTORY_LOCKED`: Directory is locked by door-key system
- `MISSING_KEY`: Required key is not available
- `KEY_VALIDATION_FAILED`: Key validation process failed

### Completion System Errors
- `NO_MATCHES_FOUND`: No files match the search pattern
- `PATTERN_INVALID`: Search pattern is invalid
- `COMPLETION_TIMEOUT`: Operation timed out

### System Errors
- `UNKNOWN_ERROR`: Unexpected error occurred
- `INTERNAL_ERROR`: Internal system error
- `CONFIGURATION_ERROR`: Configuration-related error

## Error Severity Levels

- **LOW**: Minor issues that don't prevent operation
- **MEDIUM**: Issues that may affect functionality
- **HIGH**: Serious issues that prevent operation
- **CRITICAL**: System-level failures

## Usage Examples

### Creating Custom Errors

```javascript
import { FileCompletionError, ERROR_CODES } from './errorHandler.js';

const error = new FileCompletionError(
  'Directory not accessible',
  ERROR_CODES.ACCESS_DENIED,
  { path: '/restricted/path', userId: 'user123' }
);
```

### Using Error Responses

```javascript
import { createErrorResponse } from './errorHandler.js';

return createErrorResponse(
  ERROR_CODES.DIRECTORY_NOT_FOUND,
  'The specified directory could not be found',
  { searchPath: '/missing/directory' }
);
```

### Wrapping Operations

```javascript
import { withErrorHandling } from './errorHandler.js';

const result = await withErrorHandling(async () => {
  // Your operation here
  return await someAsyncOperation();
}, 'operationName', { context: 'data' });
```

## Error Response Format

All error responses follow this standardized format:

```javascript
{
  success: false,
  message: "User-friendly error message",
  completions: [],
  commonPrefix: '',
  error: "ERROR_CODE",
  errorDetails: {
    name: "FileCompletionError",
    message: "Technical error message",
    code: "ERROR_CODE",
    severity: "medium",
    details: { /* context data */ },
    timestamp: "2025-10-31T16:54:23.187Z"
  }
}
```

## Success Response Format

Success responses follow this format:

```javascript
{
  success: true,
  completions: [/* completion objects */],
  commonPrefix: "common_prefix",
  totalMatches: 5,
  message: "", // Optional message
  /* additional metadata */
}
```

## Logging

The system automatically logs errors with appropriate severity levels:
- **DEBUG**: Low severity errors and operation details
- **WARN**: Medium severity errors
- **ERROR**: High and critical severity errors

All logs include contextual information for debugging:
- Operation name
- Error code and severity
- Timestamp
- Relevant context data
- Original error details (when applicable)

## Integration Points

The enhanced error handling is integrated into:
- Path security validation (`pathSecurityValidator.js`)
- Directory navigation (`directoryNavigator.js`)
- Door-key system access control (`doorKeySystem.js`)
- Main file completion logic (`ipcHandlers.js`)

## Best Practices

1. **Always use specific error codes** rather than generic ones
2. **Include relevant context** in error details for debugging
3. **Use withErrorHandling wrapper** for consistent error handling
4. **Provide user-friendly messages** that guide users toward solutions
5. **Log errors appropriately** based on their severity
6. **Validate inputs** before processing to catch issues early

## Testing

The error handling system includes comprehensive test coverage for:
- Error creation and classification
- User-friendly message generation
- Error response formatting
- Input validation
- Operation wrapping
- Integration with existing systems

Run tests with: `node test-error-handling.js` (when available)