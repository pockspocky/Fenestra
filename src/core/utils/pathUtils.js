/**
 * Cross-platform path utilities for Windows compatibility
 * Provides comprehensive path handling functions that work across all platforms
 * @module pathUtils
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Platform detection
const isWindows = process.platform === 'win32';

// Windows reserved filenames (case-insensitive)
const RESERVED_FILENAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

// Windows reserved characters
const WINDOWS_RESERVED_CHARS = /[<>:"|?*\x00-\x1F]/;
const WINDOWS_RESERVED_CHARS_GLOBAL = /[<>:"|?*\x00-\x1F]/g;

/**
 * Joins path segments using platform-appropriate separators
 * @param {...string} segments - Path segments to join
 * @returns {string} Joined path
 * 
 * @example
 * joinPaths('src', 'core', 'utils') // 'src/core/utils' on Unix, 'src\\core\\utils' on Windows
 */
export function joinPaths(...segments) {
  if (segments.length === 0) {
    return '.';
  }
  
  // Filter out empty segments
  const validSegments = segments.filter(seg => seg && typeof seg === 'string');
  
  if (validSegments.length === 0) {
    return '.';
  }
  
  return path.join(...validSegments);
}

/**
 * Resolves path segments to an absolute path
 * @param {...string} segments - Path segments to resolve
 * @returns {string} Absolute path
 * 
 * @example
 * resolvePath('src', 'core') // '/absolute/path/to/src/core'
 */
export function resolvePath(...segments) {
  if (segments.length === 0) {
    return process.cwd();
  }
  
  const validSegments = segments.filter(seg => seg && typeof seg === 'string');
  
  if (validSegments.length === 0) {
    return process.cwd();
  }
  
  return path.resolve(...validSegments);
}

/**
 * Normalizes a path by resolving . and .. segments and standardizing separators
 * @param {string} inputPath - Path to normalize
 * @returns {string} Normalized path
 * 
 * @example
 * normalizePath('src/../lib/./file.js') // 'lib/file.js'
 */
export function normalizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  return path.normalize(inputPath);
}

/**
 * Normalizes a path for a specific target platform
 * @param {string} inputPath - Path to normalize
 * @param {string} targetPlatform - Target platform: 'win32', 'darwin', 'linux'
 * @returns {string} Path normalized for target platform
 * 
 * @example
 * normalizePathForPlatform('src/core/utils', 'win32') // 'src\\core\\utils'
 */
export function normalizePathForPlatform(inputPath, targetPlatform = process.platform) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  const normalized = path.normalize(inputPath);
  
  if (targetPlatform === 'win32') {
    // Convert to backslashes for Windows
    return normalized.replace(/\//g, '\\');
  } else {
    // Convert to forward slashes for Unix-like systems
    return normalized.replace(/\\/g, '/');
  }
}

/**
 * Compares two paths for equality, accounting for platform-specific case sensitivity
 * @param {string} path1 - First path
 * @param {string} path2 - Second path
 * @returns {boolean} True if paths are equal
 * 
 * @example
 * pathsAreEqual('C:\\Users\\Test', 'c:\\users\\test') // true on Windows, false on Unix
 */
export function pathsAreEqual(path1, path2) {
  if (!path1 || !path2) {
    return path1 === path2;
  }
  
  const normalized1 = path.normalize(path1);
  const normalized2 = path.normalize(path2);
  
  if (isWindows) {
    // Case-insensitive comparison on Windows
    return normalized1.toLowerCase() === normalized2.toLowerCase();
  }
  
  return normalized1 === normalized2;
}

/**
 * Checks if a target path is within a scope path
 * @param {string} targetPath - Path to check
 * @param {string} scopePath - Scope path that should contain the target
 * @returns {boolean} True if target is within scope
 * 
 * @example
 * isPathWithinScope('/app/data/file.txt', '/app/data') // true
 */
export function isPathWithinScope(targetPath, scopePath) {
  if (!targetPath || !scopePath) {
    return false;
  }
  
  const normalizedTarget = path.resolve(targetPath);
  const normalizedScope = path.resolve(scopePath);
  
  const relativePath = path.relative(normalizedScope, normalizedTarget);
  
  // If relative path starts with .. or is absolute, it's outside scope
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }
  
  return true;
}

/**
 * Validates path characters for platform compatibility
 * @param {string} inputPath - Path to validate
 * @returns {Object} Validation result with isValid and errors
 * 
 * @example
 * validatePathCharacters('file<name>.txt') // { isValid: false, errors: ['Contains reserved characters'] }
 */
export function validatePathCharacters(inputPath) {
  const result = {
    isValid: true,
    errors: []
  };
  
  if (!inputPath || typeof inputPath !== 'string') {
    result.isValid = false;
    result.errors.push('Path must be a non-empty string');
    return result;
  }
  
  // Check for Windows reserved characters (apply to all platforms for consistency)
  if (WINDOWS_RESERVED_CHARS.test(inputPath)) {
    result.isValid = false;
    result.errors.push('Path contains reserved characters (<>:"|?* or control characters)');
  }
  
  // Check for null bytes
  if (inputPath.includes('\0')) {
    result.isValid = false;
    result.errors.push('Path contains null bytes');
  }
  
  return result;
}

/**
 * Checks if a filename is a Windows reserved name
 * @param {string} filename - Filename to check (without path)
 * @returns {boolean} True if filename is reserved
 * 
 * @example
 * isReservedFilename('CON') // true
 * isReservedFilename('con.txt') // true
 */
export function isReservedFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  
  // Extract just the filename without extension
  const baseName = path.basename(filename, path.extname(filename));
  
  // Check against reserved names (case-insensitive)
  return RESERVED_FILENAMES.has(baseName.toUpperCase());
}

/**
 * Sanitizes a filename by removing dangerous characters
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 * 
 * @example
 * sanitizeFilename('file<name>?.txt') // 'filename.txt'
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  // Remove reserved characters (use global flag to replace all occurrences)
  let sanitized = filename.replace(WINDOWS_RESERVED_CHARS_GLOBAL, '');
  
  // Remove leading/trailing dots and spaces (Windows strips these)
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // If the result is a reserved filename, prefix with underscore
  if (isReservedFilename(sanitized)) {
    sanitized = '_' + sanitized;
  }
  
  // If sanitization resulted in empty string, provide default
  if (!sanitized) {
    sanitized = 'unnamed';
  }
  
  return sanitized;
}

/**
 * Converts an absolute path to a relative path from a base path
 * @param {string} absolutePath - Absolute path to convert
 * @param {string} basePath - Base path for relative calculation
 * @returns {string} Relative path
 * 
 * @example
 * toRelativePath('/app/data/file.txt', '/app') // 'data/file.txt'
 */
export function toRelativePath(absolutePath, basePath = process.cwd()) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return '';
  }
  
  const resolvedAbsolute = path.resolve(absolutePath);
  const resolvedBase = path.resolve(basePath);
  
  return path.relative(resolvedBase, resolvedAbsolute);
}

/**
 * Converts a relative path to an absolute path from a base path
 * @param {string} relativePath - Relative path to convert
 * @param {string} basePath - Base path for resolution
 * @returns {string} Absolute path
 * 
 * @example
 * toAbsolutePath('data/file.txt', '/app') // '/app/data/file.txt'
 */
export function toAbsolutePath(relativePath, basePath = process.cwd()) {
  if (!relativePath || typeof relativePath !== 'string') {
    return basePath;
  }
  
  return path.resolve(basePath, relativePath);
}

/**
 * Converts path separators to forward slashes
 * @param {string} inputPath - Path to convert
 * @returns {string} Path with forward slashes
 * 
 * @example
 * toForwardSlashes('src\\core\\utils') // 'src/core/utils'
 */
export function toForwardSlashes(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  return inputPath.replace(/\\/g, '/');
}

/**
 * Converts path to platform-appropriate separators
 * @param {string} inputPath - Path to convert
 * @returns {string} Path with platform separators
 * 
 * @example
 * toPlatformPath('src/core/utils') // 'src\\core\\utils' on Windows, 'src/core/utils' on Unix
 */
export function toPlatformPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }
  
  // Normalize will use platform-appropriate separators
  return path.normalize(inputPath);
}

/**
 * Extracts path components (root, dir, base, name, ext)
 * @param {string} inputPath - Path to parse
 * @returns {Object} Path components
 * 
 * @example
 * getPathComponents('C:\\Users\\test\\file.txt')
 * // { root: 'C:\\', dir: 'C:\\Users\\test', base: 'file.txt', name: 'file', ext: '.txt' }
 */
export function getPathComponents(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return {
      root: '',
      dir: '',
      base: '',
      name: '',
      ext: ''
    };
  }
  
  const parsed = path.parse(inputPath);
  
  return {
    root: parsed.root,
    dir: parsed.dir,
    base: parsed.base,
    name: parsed.name,
    ext: parsed.ext
  };
}

/**
 * Checks if a path is absolute
 * @param {string} inputPath - Path to check
 * @returns {boolean} True if path is absolute
 * 
 * @example
 * isAbsolutePath('C:\\Users\\test') // true on Windows
 * isAbsolutePath('/usr/local') // true on Unix
 */
export function isAbsolutePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }
  
  return path.isAbsolute(inputPath);
}

/**
 * Checks if a path has a Windows drive letter
 * @param {string} inputPath - Path to check
 * @returns {boolean} True if path has drive letter
 * 
 * @example
 * hasWindowsDriveLetter('C:\\Users') // true
 * hasWindowsDriveLetter('/usr/local') // false
 */
export function hasWindowsDriveLetter(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }
  
  // Check for drive letter pattern: X: or X:\
  return /^[a-zA-Z]:[\\/]?/.test(inputPath);
}

/**
 * Checks if a path is a UNC path (\\server\share)
 * @param {string} inputPath - Path to check
 * @returns {boolean} True if path is UNC
 * 
 * @example
 * isUNCPath('\\\\server\\share\\file') // true
 * isUNCPath('C:\\Users') // false
 */
export function isUNCPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }
  
  // UNC paths start with \\ or // followed by server and share
  return /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/.test(inputPath);
}
