import path from 'node:path';
import fs from 'node:fs';
import '../../../logger.js'; // Import logging system
import { validateAndResolvePath, isWithinGameScope, validatePathAccess } from './pathSecurityValidator.js';
import { getGameDataDirectory } from '../config.js';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  createErrorResponse, 
  logError,
  withErrorHandling 
} from './errorHandler.js';

/**
 * Directory Navigator
 * 
 * This module provides safe directory navigation and content retrieval utilities
 * for the file completion system. It ensures all operations stay within the game scope
 * and provides pattern matching capabilities for file completion.
 */

/**
 * Navigates to a target directory within the game scope
 * @param {string} targetPath - The target directory path (relative or absolute)
 * @param {string} currentDir - The current working directory
 * @param {string} gameDataRoot - The root directory for game data (defaults to project root)
 * @returns {Object} Navigation result with new path or error
 */
export function navigateToDirectory(targetPath, currentDir, gameDataRoot = null) {
  return withErrorHandling(async () => {
    console.debug(`[DIRECTORY_NAVIGATOR] Navigating to: "${targetPath}", from: "${currentDir}"`);

    // Use configured game data directory as default
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    
    // Validate and resolve the target path
    const pathValidation = validateAndResolvePath(targetPath, currentDir, actualGameDataRoot);
    
    if (!pathValidation.isValid) {
      throw new FileCompletionError(
        pathValidation.error,
        pathValidation.errorCode || ERROR_CODES.INVALID_PATH,
        { targetPath, currentDir, gameDataRoot: actualGameDataRoot }
      );
    }

    const resolvedPath = pathValidation.resolvedPath;

    // Check if the path exists and is accessible
    const accessValidation = validatePathAccess(resolvedPath);
    
    if (!accessValidation.exists) {
      throw new FileCompletionError(
        accessValidation.error,
        accessValidation.errorCode || ERROR_CODES.DIRECTORY_NOT_FOUND,
        { path: resolvedPath, targetPath, currentDir }
      );
    }

    if (!accessValidation.isDirectory) {
      throw new FileCompletionError(
        'Path is not a directory',
        ERROR_CODES.INVALID_PATH,
        { path: resolvedPath, isFile: accessValidation.isFile }
      );
    }

    if (!accessValidation.readable) {
      throw new FileCompletionError(
        accessValidation.error || 'Directory is not readable',
        accessValidation.errorCode || ERROR_CODES.PERMISSION_DENIED,
        { path: resolvedPath }
      );
    }

    console.debug(`[DIRECTORY_NAVIGATOR] Navigation successful to: "${resolvedPath}"`);
    
    return {
      success: true,
      newPath: resolvedPath,
      error: null
    };
  }, 'navigateToDirectory', { targetPath, currentDir, gameDataRoot });
}

/**
 * Gets directory contents with optional pattern matching
 * @param {string} dirPath - The directory path to read
 * @param {string} pattern - Optional pattern to match against (supports partial matching)
 * @param {Object} options - Additional options for filtering and sorting
 * @returns {Object} Directory contents result with entries or error
 */
export function getDirectoryContents(dirPath, pattern = '', options = {}) {
  return withErrorHandling(async () => {
    console.debug(`[DIRECTORY_NAVIGATOR] Getting contents for: "${dirPath}", pattern: "${pattern}"`);

    const defaultOptions = {
      includeHidden: false,
      includeDirectories: true,
      includeFiles: true,
      caseSensitive: false,
      sortAlphabetically: true,
      maxResults: 1000
    };

    const opts = { ...defaultOptions, ...options };

    // Validate path access
    const accessValidation = validatePathAccess(dirPath);
    
    if (!accessValidation.exists) {
      throw new FileCompletionError(
        accessValidation.error,
        accessValidation.errorCode || ERROR_CODES.DIRECTORY_NOT_FOUND,
        { path: dirPath, pattern, options: opts }
      );
    }

    if (!accessValidation.isDirectory) {
      throw new FileCompletionError(
        'Path is not a directory',
        ERROR_CODES.INVALID_PATH,
        { path: dirPath, isFile: accessValidation.isFile }
      );
    }

    if (!accessValidation.readable) {
      throw new FileCompletionError(
        accessValidation.error || 'Directory is not readable',
        accessValidation.errorCode || ERROR_CODES.PERMISSION_DENIED,
        { path: dirPath }
      );
    }

    // Read directory contents
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
      let errorCode = ERROR_CODES.DIRECTORY_READ_FAILED;
      let errorMessage = `Failed to read directory: ${error.message}`;
      
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        errorCode = ERROR_CODES.PERMISSION_DENIED;
        errorMessage = 'Permission denied reading directory';
      } else if (error.code === 'ENOENT') {
        errorCode = ERROR_CODES.DIRECTORY_NOT_FOUND;
        errorMessage = 'Directory not found';
      }
      
      throw new FileCompletionError(errorMessage, errorCode, {
        path: dirPath,
        systemError: error.code,
        originalError: error.message
      });
    }
    
    // Filter and process entries
    const processedEntries = [];
    const processingErrors = [];
    
    for (const entry of entries) {
      try {
        // Skip hidden files unless explicitly requested
        if (!opts.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Filter by type
        if (entry.isDirectory() && !opts.includeDirectories) {
          continue;
        }
        
        if (entry.isFile() && !opts.includeFiles) {
          continue;
        }

        // Apply pattern matching if provided (basic filtering, enhanced filtering done at completion level)
        if (pattern && !matchesPattern(entry.name, pattern, opts.caseSensitive)) {
          continue;
        }

        // Create entry object
        const entryPath = path.join(dirPath, entry.name);
        const processedEntry = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: entryPath,
          relativePath: path.relative(dirPath, entryPath),
          hasSpecialChars: hasSpecialCharacters(entry.name),
          isHidden: entry.name.startsWith('.')
        };

        // Add directory-specific properties
        if (entry.isDirectory()) {
          processedEntry.name = entry.name + '/'; // Add trailing slash for directories
        }

        processedEntries.push(processedEntry);

        // Respect max results limit
        if (processedEntries.length >= opts.maxResults) {
          console.warn(`[DIRECTORY_NAVIGATOR] Reached max results limit (${opts.maxResults})`);
          break;
        }

      } catch (entryError) {
        processingErrors.push({
          entryName: entry.name,
          error: entryError.message
        });
        console.warn(`[DIRECTORY_NAVIGATOR] Error processing entry "${entry.name}":`, entryError);
        // Continue processing other entries
      }
    }

    // Sort results if requested
    if (opts.sortAlphabetically) {
      processedEntries.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        // Then alphabetically
        return a.name.localeCompare(b.name, undefined, { 
          numeric: true, 
          sensitivity: opts.caseSensitive ? 'case' : 'base' 
        });
      });
    }

    console.debug(`[DIRECTORY_NAVIGATOR] Found ${processedEntries.length} entries`);
    
    const result = {
      success: true,
      entries: processedEntries,
      totalCount: processedEntries.length,
      error: null
    };

    // Add processing errors as warnings if any occurred
    if (processingErrors.length > 0) {
      result.warnings = processingErrors;
    }

    return result;
  }, 'getDirectoryContents', { dirPath, pattern, options });
}

/**
 * Resolves a relative path within the game scope
 * @param {string} relativePath - The relative path to resolve
 * @param {string} basePath - The base path to resolve against
 * @param {string} gameDataRoot - The root directory for game data
 * @returns {Object} Resolution result with resolved path or error
 */
export function resolveRelativePath(relativePath, basePath, gameDataRoot = null) {
  console.debug(`[DIRECTORY_NAVIGATOR] Resolving relative path: "${relativePath}" from base: "${basePath}"`);

  try {
    // Use configured game data directory as default
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    
    // Use the path security validator for consistent validation
    const validation = validateAndResolvePath(relativePath, basePath, actualGameDataRoot);
    
    if (!validation.isValid) {
      return {
        success: false,
        resolvedPath: '',
        error: validation.error
      };
    }

    return {
      success: true,
      resolvedPath: validation.resolvedPath,
      error: null
    };

  } catch (error) {
    console.error(`[DIRECTORY_NAVIGATOR] Relative path resolution failed:`, error);
    
    return {
      success: false,
      resolvedPath: '',
      error: `Path resolution failed: ${error.message}`
    };
  }
}

/**
 * Gets the parent directory of a given path within game scope
 * @param {string} currentPath - The current path
 * @param {string} gameDataRoot - The root directory for game data
 * @returns {Object} Parent directory result
 */
export function getParentDirectory(currentPath, gameDataRoot = null) {
  console.debug(`[DIRECTORY_NAVIGATOR] Getting parent directory for: "${currentPath}"`);

  try {
    // Use configured game data directory as default
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    const normalizedRoot = path.resolve(actualGameDataRoot);
    const normalizedCurrent = path.resolve(currentPath);

    // Check if we're already at the root
    if (normalizedCurrent === normalizedRoot) {
      return {
        success: false,
        parentPath: '',
        error: 'Already at game data root directory'
      };
    }

    // Get parent directory
    const parentPath = path.dirname(normalizedCurrent);

    // Ensure parent is still within game scope
    if (!isWithinGameScope(parentPath, normalizedRoot)) {
      return {
        success: false,
        parentPath: '',
        error: 'Parent directory is outside game scope'
      };
    }

    return {
      success: true,
      parentPath,
      error: null
    };

  } catch (error) {
    console.error(`[DIRECTORY_NAVIGATOR] Failed to get parent directory:`, error);
    
    return {
      success: false,
      parentPath: '',
      error: `Failed to get parent directory: ${error.message}`
    };
  }
}

/**
 * Checks if a filename matches a given pattern
 * @param {string} filename - The filename to check
 * @param {string} pattern - The pattern to match against
 * @param {boolean} caseSensitive - Whether matching should be case sensitive
 * @returns {boolean} True if filename matches pattern
 */
function matchesPattern(filename, pattern, caseSensitive = false) {
  if (!pattern) {
    return true; // Empty pattern matches everything
  }

  // Prepare strings for comparison
  const name = caseSensitive ? filename : filename.toLowerCase();
  const pat = caseSensitive ? pattern : pattern.toLowerCase();

  // Enhanced pattern matching - support multiple matching strategies
  
  // 1. Prefix matching (most common case)
  if (name.startsWith(pat)) {
    return true;
  }

  // 2. Substring matching for partial file names
  if (name.includes(pat)) {
    return true;
  }

  // 3. Word boundary matching (for better partial matches)
  // Split filename by common separators and check if any part starts with pattern
  const nameParts = name.split(/[-_.\s]/);
  for (const part of nameParts) {
    if (part.startsWith(pat)) {
      return true;
    }
  }

  // 4. Extension matching - if pattern looks like an extension
  if (pat.startsWith('.') && name.endsWith(pat)) {
    return true;
  }

  return false;
}

/**
 * Checks if a filename contains special characters that need escaping
 * @param {string} filename - The filename to check
 * @returns {boolean} True if filename has special characters
 */
function hasSpecialCharacters(filename) {
  // Characters that typically need escaping in shell contexts
  const specialChars = /[\s'"\\!*?[\]{}()&|;><~`$]/;
  return specialChars.test(filename);
}

/**
 * Finds the common prefix among a list of filenames with enhanced special character handling
 * @param {Array<string>} filenames - Array of filenames
 * @returns {string} Common prefix string
 */
export function findCommonPrefix(filenames) {
  return findCommonPrefixWithSpecialChars(filenames);
}

/**
 * Enhanced common prefix finder with better special character and path handling
 * @param {Array<string>} filenames - Array of filenames
 * @param {Object} options - Options for prefix calculation
 * @returns {string} Common prefix string
 */
export function findCommonPrefixWithSpecialChars(filenames, options = {}) {
  const {
    caseSensitive = false,
    respectWordBoundaries = true,
    minPrefixLength = 1,
    includePathSeparators = true
  } = options;

  if (!filenames || filenames.length === 0) {
    return '';
  }

  if (filenames.length === 1) {
    // For single file, return the full name but remove trailing slash for directories
    return filenames[0].replace(/\/$/, '');
  }

  // Filter out empty strings and normalize
  const validFilenames = filenames.filter(name => name && typeof name === 'string');
  
  if (validFilenames.length === 0) {
    return '';
  }

  if (validFilenames.length === 1) {
    return validFilenames[0].replace(/\/$/, '');
  }

  // Normalize filenames for comparison if case-insensitive
  const normalizedFilenames = caseSensitive 
    ? validFilenames 
    : validFilenames.map(name => name.toLowerCase());

  // Find the shortest string to limit comparison
  const shortest = normalizedFilenames.reduce((min, current) => 
    current.length < min.length ? current : min
  );

  let commonPrefix = '';
  
  for (let i = 0; i < shortest.length; i++) {
    const char = shortest[i];
    
    // Check if all strings have the same character at this position
    const allMatch = normalizedFilenames.every(filename => filename[i] === char);
    
    if (allMatch) {
      // Use the original case from the first filename
      commonPrefix += validFilenames[0][i];
    } else {
      break;
    }
  }

  // Apply minimum prefix length requirement
  if (commonPrefix.length < minPrefixLength) {
    return '';
  }

  // Enhanced word boundary detection for better prefix truncation
  if (respectWordBoundaries && commonPrefix.length > 0 && commonPrefix.length < shortest.length) {
    // Define word boundary characters including special characters common in filenames
    const wordBoundaryChars = ['/', '\\', '-', '_', '.', ' ', '(', ')', '[', ']', '{', '}'];
    
    let lastWordBoundary = -1;
    
    // Find the last word boundary in the common prefix
    for (let i = commonPrefix.length - 1; i >= 0; i--) {
      if (wordBoundaryChars.includes(commonPrefix[i])) {
        lastWordBoundary = i;
        break;
      }
    }
    
    // If we found a word boundary and it's not at the very beginning
    if (lastWordBoundary > 0) {
      // Check if truncating would still leave a meaningful prefix
      const truncatedPrefix = commonPrefix.substring(0, lastWordBoundary + 1);
      if (truncatedPrefix.length >= minPrefixLength) {
        commonPrefix = truncatedPrefix;
      }
    }
    // If no word boundary found but we have a partial word, check if it's meaningful
    else if (lastWordBoundary === -1 && commonPrefix.length >= 3) {
      // Keep partial words if they're at least 3 characters (likely meaningful)
      // This helps with cases like "test" being common prefix of "test1.txt", "test2.txt"
    }
    // If the prefix is very short and no word boundary, it might not be useful
    else if (commonPrefix.length < 3) {
      // Check if the next character in any filename would break the pattern
      const nextChars = validFilenames
        .filter(name => name.length > commonPrefix.length)
        .map(name => name[commonPrefix.length]);
      
      // If next characters are all word boundaries, keep the prefix
      const allNextAreWordBoundaries = nextChars.length > 0 && 
        nextChars.every(char => wordBoundaryChars.includes(char));
      
      if (!allNextAreWordBoundaries && commonPrefix.length < minPrefixLength) {
        return '';
      }
    }
  }

  // Handle path separators specially if requested
  if (!includePathSeparators && (commonPrefix.endsWith('/') || commonPrefix.endsWith('\\'))) {
    commonPrefix = commonPrefix.slice(0, -1);
  }

  return commonPrefix;
}

/**
 * Normalizes a path for completion display with enhanced special character handling
 * @param {string} inputPath - The path to normalize
 * @param {string} basePath - The base path for relative resolution
 * @returns {string} Normalized path for display
 */
export function normalizePathForCompletion(inputPath, basePath = '') {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }

  // Remove quotes and trim
  let normalized = inputPath.trim();
  
  // Handle different quote types and nested quotes more robustly
  // Support both single and double quotes, including mixed scenarios
  if (normalized.length >= 2) {
    if ((normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))) {
      normalized = normalized.slice(1, -1);
    }
    // Handle partial quotes (e.g., when user is typing)
    else if (normalized.startsWith('"') || normalized.startsWith("'")) {
      normalized = normalized.slice(1);
    }
  }

  // Handle escaped characters more comprehensively
  // Unescape common shell escape sequences
  normalized = normalized
    .replace(/\\(.)/g, '$1')  // Basic escape sequences
    .replace(/\\\\/g, '\\')   // Double backslashes
    .replace(/\\"/g, '"')     // Escaped quotes
    .replace(/\\'/g, "'");    // Escaped single quotes

  // Handle relative paths with better error handling
  if (!path.isAbsolute(normalized) && basePath) {
    try {
      normalized = path.join(basePath, normalized);
    } catch (error) {
      // If path.join fails, return the original normalized path
      console.warn(`[PATH_NORMALIZE] Failed to join paths: ${error.message}`);
    }
  }

  // Normalize separators and resolve path components
  try {
    normalized = path.normalize(normalized);
  } catch (error) {
    // If normalization fails, continue with basic cleanup
    console.warn(`[PATH_NORMALIZE] Failed to normalize path: ${error.message}`);
  }
  
  // Convert backslashes to forward slashes for consistency across platforms
  normalized = normalized.replace(/\\/g, '/');

  // Remove duplicate slashes but preserve leading slashes for absolute paths
  normalized = normalized.replace(/\/+/g, '/');

  // Clean up trailing slashes unless it's the root directory
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Escapes a filename for safe shell usage
 * @param {string} filename - The filename to escape
 * @param {Object} options - Escaping options
 * @returns {string} Escaped filename
 */
export function escapeFilenameForShell(filename, options = {}) {
  const { forceQuotes = false, preferSingleQuotes = false } = options;
  
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Check if escaping is needed
  const needsEscaping = /[\s'"\\!*?[\]{}()&|;><$`~#]/.test(filename);
  
  if (!needsEscaping && !forceQuotes) {
    return filename;
  }

  // Choose quote type based on content and preference
  const hasSingleQuote = filename.includes("'");
  const hasDoubleQuote = filename.includes('"');
  
  if (hasSingleQuote && hasDoubleQuote) {
    // Both quote types present - escape with backslashes
    return filename.replace(/(['"\\!*?[\]{}()&|;><$`~#\s])/g, '\\$1');
  } else if (hasSingleQuote || (!hasDoubleQuote && !preferSingleQuotes)) {
    // Use double quotes
    return `"${filename.replace(/([\\"])/g, '\\$1')}"`;
  } else {
    // Use single quotes
    return `'${filename.replace(/'/g, "\\'")}'`;
  }
}

/**
 * Unescapes a filename from shell format
 * @param {string} escapedFilename - The escaped filename
 * @returns {string} Unescaped filename
 */
export function unescapeFilenameFromShell(escapedFilename) {
  if (!escapedFilename || typeof escapedFilename !== 'string') {
    return '';
  }

  let unescaped = escapedFilename.trim();

  // Remove surrounding quotes
  if (unescaped.length >= 2) {
    if ((unescaped.startsWith('"') && unescaped.endsWith('"')) ||
        (unescaped.startsWith("'") && unescaped.endsWith("'"))) {
      unescaped = unescaped.slice(1, -1);
    }
  }

  // Unescape backslash sequences
  unescaped = unescaped
    .replace(/\\(.)/g, '$1')  // Basic escape sequences
    .replace(/\\\\/g, '\\');  // Double backslashes

  return unescaped;
}

/**
 * Validates if a path contains only safe characters
 * @param {string} inputPath - The path to validate
 * @returns {Object} Validation result with details
 */
export function validatePathCharacters(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return {
      isValid: false,
      error: 'Path must be a non-empty string',
      unsafeCharacters: []
    };
  }

  // Characters that are generally unsafe in file paths across platforms
  const unsafeChars = /[<>:"|?*\x00-\x1f\x7f]/;
  const matches = inputPath.match(new RegExp(unsafeChars.source, 'g'));
  
  if (matches) {
    return {
      isValid: false,
      error: `Path contains unsafe characters: ${matches.join(', ')}`,
      unsafeCharacters: [...new Set(matches)] // Remove duplicates
    };
  }

  // Check for reserved names on Windows (even on other platforms for compatibility)
  const pathParts = inputPath.split(/[/\\]/);
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  
  for (const part of pathParts) {
    const baseName = part.split('.')[0]; // Remove extension
    if (reservedNames.test(baseName)) {
      return {
        isValid: false,
        error: `Path contains reserved name: ${part}`,
        unsafeCharacters: [],
        reservedName: part
      };
    }
  }

  return {
    isValid: true,
    error: null,
    unsafeCharacters: []
  };
}