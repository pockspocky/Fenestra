import path from 'node:path';
import fs from 'node:fs';
import '../../../logger.js'; // Import logging system
import { getGameDataDirectory } from '../config.js';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  logError 
} from './errorHandler.js';
import {
  hasWindowsDriveLetter,
  isUNCPath,
  isReservedFilename,
  validatePathCharacters as validatePathChars
} from './pathUtils.js';

// Platform detection
const isWindows = process.platform === 'win32';

/**
 * Path Security Validator
 * 
 * This module provides secure path validation and resolution utilities
 * to ensure all file operations stay within the designated game data directory.
 * It prevents directory traversal attacks and handles cross-platform path separators.
 */

/**
 * Validates and resolves a path within the game scope
 * @param {string} inputPath - The input path to validate and resolve
 * @param {string} currentDir - The current working directory
 * @param {string} gameDataRoot - The root directory for game data (defaults to project root)
 * @returns {Object} Validation result with resolved path
 */
export function validateAndResolvePath(inputPath, currentDir, gameDataRoot = null) {
  console.debug(`[PATH_SECURITY] Validating path: "${inputPath}", currentDir: "${currentDir}"`);

  try {
    // Set default game data root to configured directory if not provided
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    
    // Normalize the game data root path
    const normalizedGameRoot = path.resolve(actualGameDataRoot);
    
    // Handle empty or null input
    if (!inputPath || typeof inputPath !== 'string') {
      const error = new FileCompletionError(
        'Input path is required and must be a string',
        ERROR_CODES.MALFORMED_PATH,
        { inputPath, currentDir, gameDataRoot }
      );
      logError(error);
      
      return {
        isValid: false,
        resolvedPath: '',
        error: error.message,
        errorCode: error.code,
        isWithinScope: false
      };
    }

    // Normalize input path and handle cross-platform separators
    let normalizedInput = normalizeCrossPlatformPath(inputPath.trim());
    
    // Handle quoted paths
    normalizedInput = removeQuotes(normalizedInput);
    
    // Validate Windows-specific path requirements
    if (isWindows) {
      const windowsValidation = validateWindowsPath(normalizedInput);
      if (!windowsValidation.isValid) {
        const error = new FileCompletionError(
          windowsValidation.error,
          ERROR_CODES.MALFORMED_PATH,
          { inputPath, normalizedInput, validationErrors: windowsValidation.errors }
        );
        logError(error);
        
        return {
          isValid: false,
          resolvedPath: '',
          error: error.message,
          errorCode: error.code,
          isWithinScope: false
        };
      }
    }
    
    // Check for potential path traversal attempts (both forward and backslashes)
    if (detectPathTraversal(normalizedInput)) {
      const error = new FileCompletionError(
        'Path traversal attempts are not allowed',
        ERROR_CODES.PATH_TRAVERSAL_ATTEMPT,
        { inputPath, normalizedInput, currentDir }
      );
      logError(error);
      
      return {
        isValid: false,
        resolvedPath: '',
        error: error.message,
        errorCode: error.code,
        isWithinScope: false
      };
    }
    
    // Resolve the path based on whether it's absolute or relative
    let resolvedPath;
    
    if (path.isAbsolute(normalizedInput)) {
      // For absolute paths, use as-is but validate scope
      resolvedPath = path.resolve(normalizedInput);
    } else {
      // For relative paths, resolve against current directory or game root
      const baseDir = currentDir || normalizedGameRoot;
      const normalizedBaseDir = path.resolve(baseDir);
      resolvedPath = path.resolve(normalizedBaseDir, normalizedInput);
    }

    // Check if the resolved path is within game scope
    const withinScope = isWithinGameScope(resolvedPath, normalizedGameRoot);
    
    if (!withinScope) {
      const error = new FileCompletionError(
        'Access restricted to project scope',
        ERROR_CODES.PATH_OUTSIDE_SCOPE,
        { 
          inputPath, 
          resolvedPath, 
          gameDataRoot: normalizedGameRoot,
          currentDir 
        }
      );
      logError(error);
      
      return {
        isValid: false,
        resolvedPath: '',
        error: error.message,
        errorCode: error.code,
        isWithinScope: false
      };
    }

    console.debug(`[PATH_SECURITY] Path validation successful: "${resolvedPath}"`);
    
    return {
      isValid: true,
      resolvedPath,
      error: null,
      errorCode: null,
      isWithinScope: true
    };

  } catch (error) {
    const completionError = new FileCompletionError(
      `Path validation failed: ${error.message}`,
      ERROR_CODES.INTERNAL_ERROR,
      { 
        inputPath, 
        currentDir, 
        gameDataRoot,
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    );
    logError(completionError);
    
    return {
      isValid: false,
      resolvedPath: '',
      error: completionError.message,
      errorCode: completionError.code,
      isWithinScope: false
    };
  }
}

/**
 * Checks if a target path is within the allowed game scope
 * Uses case-insensitive comparison on Windows
 * @param {string} targetPath - The path to check
 * @param {string} gameDataRoot - The root directory for game data
 * @returns {boolean} True if path is within scope, false otherwise
 */
export function isWithinGameScope(targetPath, gameDataRoot) {
  try {
    // Normalize both paths for comparison
    const normalizedTarget = normalizeForComparison(targetPath);
    const normalizedRoot = normalizeForComparison(gameDataRoot);
    
    // Check if target path starts with the game root path
    const relativePath = path.relative(normalizedRoot, normalizedTarget);
    
    // If relative path starts with '..' or is absolute, it's outside scope
    const isOutside = relativePath.startsWith('..') || path.isAbsolute(relativePath);
    
    console.debug(`[PATH_SECURITY] Scope check - Target: "${normalizedTarget}", Root: "${normalizedRoot}", Relative: "${relativePath}", Outside: ${isOutside}`);
    
    return !isOutside;
    
  } catch (error) {
    console.error(`[PATH_SECURITY] Scope check failed:`, error);
    return false;
  }
}

/**
 * Validates Windows-specific path requirements
 * @param {string} inputPath - The path to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateWindowsPath(inputPath) {
  const result = {
    isValid: true,
    errors: [],
    error: null
  };
  
  if (!inputPath || typeof inputPath !== 'string') {
    result.isValid = false;
    result.errors.push('Path must be a non-empty string');
    result.error = 'Path must be a non-empty string';
    return result;
  }
  
  // Validate drive letter format if present
  if (hasWindowsDriveLetter(inputPath)) {
    const driveMatch = inputPath.match(/^([a-zA-Z]):([\\/].*)?$/);
    if (!driveMatch) {
      result.isValid = false;
      result.errors.push('Invalid Windows drive letter format');
    }
  }
  
  // Validate UNC path format if present
  if (isUNCPath(inputPath)) {
    // UNC paths should have format \\server\share
    const uncMatch = inputPath.match(/^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/);
    if (!uncMatch) {
      result.isValid = false;
      result.errors.push('Invalid UNC path format');
    }
  }
  
  // Check for reserved filenames in path components
  const pathComponents = inputPath.split(/[\\/]+/);
  for (const component of pathComponents) {
    if (component && isReservedFilename(component)) {
      result.isValid = false;
      result.errors.push(`Path contains reserved filename: ${component}`);
    }
  }
  
  // Validate path characters, but exclude the colon if it's part of a valid drive letter
  let pathToValidate = inputPath;
  if (hasWindowsDriveLetter(inputPath)) {
    // Remove the drive letter and colon for character validation
    pathToValidate = inputPath.substring(2);
  }
  
  const charValidation = validatePathChars(pathToValidate);
  if (!charValidation.isValid) {
    result.isValid = false;
    result.errors.push(...charValidation.errors);
  }
  
  if (!result.isValid && result.errors.length > 0) {
    result.error = result.errors[0];
  }
  
  return result;
}

/**
 * Normalizes a path for comparison, handling case sensitivity based on platform
 * @param {string} inputPath - The path to normalize
 * @returns {string} Normalized path suitable for comparison
 */
export function normalizeForComparison(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  // Resolve to absolute path
  const resolved = path.resolve(inputPath);
  
  // On Windows, convert to lowercase for case-insensitive comparison
  if (isWindows) {
    return resolved.toLowerCase();
  }
  
  return resolved;
}

/**
 * Detects path traversal attempts using both forward and backslashes
 * @param {string} inputPath - The path to check
 * @returns {boolean} True if path traversal is detected
 */
export function detectPathTraversal(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }
  
  // Check for .. sequences with any separator
  if (inputPath.includes('..')) {
    return true;
  }
  
  // Check for home directory expansion
  if (inputPath.includes('~')) {
    return true;
  }
  
  // Check for encoded path traversal attempts
  if (inputPath.includes('%2e%2e') || inputPath.includes('%2E%2E')) {
    return true;
  }
  
  // Check for backslash-based traversal (Windows)
  if (inputPath.includes('..\\') || inputPath.includes('../')) {
    return true;
  }
  
  return false;
}

/**
 * Normalizes cross-platform path separators
 * @param {string} inputPath - The path to normalize
 * @returns {string} Normalized path
 */
function normalizeCrossPlatformPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  // Replace backslashes with forward slashes for consistency
  // Then let path.resolve handle the platform-specific normalization
  let normalized = inputPath.replace(/\\/g, '/');
  
  // Handle multiple consecutive slashes
  normalized = normalized.replace(/\/+/g, '/');
  
  // Remove trailing slash unless it's the root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Removes surrounding quotes from a path string
 * @param {string} pathString - The path string that may have quotes
 * @returns {string} Path string without surrounding quotes
 */
function removeQuotes(pathString) {
  if (!pathString || typeof pathString !== 'string') {
    return '';
  }
  
  const trimmed = pathString.trim();
  
  // Remove matching quotes (single or double)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  return trimmed;
}

/**
 * Validates that a path exists and is accessible
 * @param {string} targetPath - The path to validate
 * @returns {Object} Validation result with access information
 */
export function validatePathAccess(targetPath) {
  console.debug(`[PATH_SECURITY] Validating path access: "${targetPath}"`);
  
  try {
    // Check if path exists
    if (!fs.existsSync(targetPath)) {
      const error = new FileCompletionError(
        'Path does not exist',
        ERROR_CODES.DIRECTORY_NOT_FOUND,
        { path: targetPath }
      );
      
      return {
        exists: false,
        isDirectory: false,
        isFile: false,
        readable: false,
        error: error.message,
        errorCode: error.code
      };
    }
    
    // Get path stats
    const stats = fs.statSync(targetPath);
    const isDirectory = stats.isDirectory();
    const isFile = stats.isFile();
    
    // Check read access
    let readable = false;
    let accessError = null;
    
    try {
      fs.accessSync(targetPath, fs.constants.R_OK);
      readable = true;
    } catch (err) {
      const error = new FileCompletionError(
        'Read access denied',
        ERROR_CODES.PERMISSION_DENIED,
        { 
          path: targetPath,
          systemError: err.code,
          isDirectory,
          isFile
        }
      );
      logError(error);
      accessError = error;
    }
    
    return {
      exists: true,
      isDirectory,
      isFile,
      readable,
      error: accessError ? accessError.message : null,
      errorCode: accessError ? accessError.code : null
    };
    
  } catch (error) {
    let errorCode = ERROR_CODES.INTERNAL_ERROR;
    let errorMessage = `Path access validation failed: ${error.message}`;
    
    // Map specific Node.js errors to appropriate codes
    if (error.code === 'ENOENT') {
      errorCode = ERROR_CODES.DIRECTORY_NOT_FOUND;
      errorMessage = 'Path does not exist';
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorCode = ERROR_CODES.PERMISSION_DENIED;
      errorMessage = 'Permission denied';
    } else if (error.code === 'ENOTDIR') {
      errorCode = ERROR_CODES.INVALID_PATH;
      errorMessage = 'Path is not a directory';
    }
    
    const completionError = new FileCompletionError(
      errorMessage,
      errorCode,
      { 
        path: targetPath,
        originalError: {
          name: error.name,
          message: error.message,
          code: error.code
        }
      }
    );
    logError(completionError);
    
    return {
      exists: false,
      isDirectory: false,
      isFile: false,
      readable: false,
      error: completionError.message,
      errorCode: completionError.code
    };
  }
}

/**
 * Gets the default game data directory path
 * @returns {string} The default game data directory path
 */
export function getDefaultGameDataDirectory() {
  // Use the configured game data directory
  return getGameDataDirectory();
}

/**
 * Sanitizes a path for safe usage in file operations
 * @param {string} inputPath - The path to sanitize
 * @returns {string} Sanitized path
 */
export function sanitizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  // Remove null bytes and other dangerous characters
  let sanitized = inputPath.replace(/\0/g, '');
  
  // Remove or replace other potentially dangerous characters
  // Keep alphanumeric, spaces, dots, hyphens, underscores, and path separators
  sanitized = sanitized.replace(/[^\w\s.\-\/\\]/g, '');
  
  // Normalize path separators
  sanitized = normalizeCrossPlatformPath(sanitized);
  
  return sanitized;
}