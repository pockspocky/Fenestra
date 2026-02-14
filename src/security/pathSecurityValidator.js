import path from 'node:path';
import fs from 'node:fs';
import '../../logger.js'; // Import logging system
import { getGameDataDirectory } from '../core/config.js';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  ERROR_SEVERITY,
  logError 
} from '../utils/errorHandler.js';
import {
  hasWindowsDriveLetter,
  isUNCPath,
  isReservedFilename,
  validatePathCharacters as validatePathChars,
  normalizePath as normalizePathUtil,
  isPathWithinScope
} from '../utils/pathUtils.js';
import { securityAuditSystem, SECURITY_EVENT_TYPES, SEVERITY_LEVELS } from '../security/auditSystem.js';

// Platform detection
const isWindows = process.platform === 'win32';

/**
 * Blocked directories - directories that are protected from terminal access
 * These directories contain sensitive system files, source code, or configuration
 * that should not be accessible through terminal commands for security reasons.
 * 
 * Directories can be programmatically unlocked using the unlockDirectory() method
 * to allow temporary access when needed (e.g., for game mechanics like door/key systems).
 * 
 * @constant {Array<string>}
 */
const BLOCKED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.kiro/hooks',
  'src',
  'renderer',
  'test',
  'tests',
  '__tests__',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'out'
];

// Security configuration constants
const SECURITY_CONFIG = {
  MAX_PATH_LENGTH: 4096,
  MAX_COMPONENT_LENGTH: 255,
  MAX_DEPTH: 32,
  ALLOWED_EXTENSIONS: new Set(['.fenestra', '.txt', '.md', '.json', '.js', '.html', '.css', '.png', '.jpg', '.jpeg']),
  BLOCKED_PATTERNS: [
    /\.\./,           // Path traversal
    /~[\/\\]/,        // Home directory expansion
    /%2e%2e/i,        // URL encoded traversal
    /\x00/,           // Null bytes
    /[\x01-\x1f]/,    // Control characters
    /\$\{.*\}/,       // Template injection
    /`.*`/,           // Command injection
    /<script/i,       // Script injection
    /javascript:/i,   // JavaScript protocol
    /data:/i,         // Data protocol
    /file:/i          // File protocol
  ]
};

// Security policies per operation type
const SECURITY_POLICIES = {
  READ: {
    allowAbsolute: true,  // Allow absolute paths within scope
    maxDepth: 10,
    allowedExtensions: SECURITY_CONFIG.ALLOWED_EXTENSIONS,
    requireScope: true,
    logAccess: true
  },
  WRITE: {
    allowAbsolute: true,  // Allow absolute paths within scope
    maxDepth: 15,  // Increased to accommodate deeper paths
    allowedExtensions: new Set(['.fenestra', '.txt', '.md', '.json']),
    requireScope: true,
    logAccess: true,
    requireConfirmation: true
  },
  EXECUTE: {
    allowAbsolute: false,
    maxDepth: 5,
    allowedExtensions: new Set(['.js']),
    requireScope: true,
    logAccess: true,
    requireConfirmation: true,
    sandboxed: true
  },
  LIST: {
    allowAbsolute: true,  // Allow absolute paths within scope
    maxDepth: 15,
    allowedExtensions: null, // Allow all for listing
    requireScope: true,
    logAccess: false
  }
};

/**
 * Enhanced Path Security Validator
 * 
 * This module provides comprehensive path validation and security enforcement
 * with multi-layer validation, configurable policies, and advanced threat detection.
 * It prevents directory traversal attacks, validates path components, and enforces
 * security policies based on operation types.
 */

/**
 * Enhanced Path Security Validator Class
 * Provides comprehensive path validation with configurable security policies
 * 
 * @property {string} gameDataRoot - Root directory for game data
 * @property {Object} securityPolicies - Security policies per operation type
 * @property {boolean} auditEnabled - Whether security auditing is enabled
 * @property {Map} cache - Validation result cache
 * @property {number} cacheMaxSize - Maximum cache size
 * @property {number} cacheTimeout - Cache timeout in milliseconds
 * @property {Set<string>} unlockedDirectories - Set of directories that have been unlocked for access
 *                                                despite being in the blocked list. Directories can be
 *                                                unlocked programmatically using unlockDirectory() and
 *                                                locked again using lockDirectory(). This enables dynamic
 *                                                access control for game mechanics like door/key systems.
 */
export class EnhancedPathSecurityValidator {
  constructor(options = {}) {
    this.gameDataRoot = options.gameDataRoot || getGameDataDirectory();
    this.securityPolicies = { ...SECURITY_POLICIES, ...options.policies };
    this.auditEnabled = options.auditEnabled !== false;
    this.cache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 1000;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.unlockedDirectories = new Set();
    
    console.debug('[PATH_SECURITY] Enhanced validator initialized', {
      gameDataRoot: this.gameDataRoot,
      auditEnabled: this.auditEnabled,
      cacheMaxSize: this.cacheMaxSize
    });
  }

  /**
   * Core validation method with multi-layer security checks
   * @param {string} inputPath - Path to validate
   * @param {string} baseDir - Base directory for relative paths
   * @param {string} allowedScope - Allowed scope directory
   * @param {string} operation - Operation type (READ, WRITE, EXECUTE, LIST)
   * @param {boolean} useBlocklist - If true, uses blocklist validation; if false, uses allowlist validation
   * @returns {Object} Comprehensive validation result
   */
  validatePath(inputPath, baseDir = null, allowedScope = null, operation = 'READ', useBlocklist = true) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `${inputPath}|${baseDir}|${allowedScope}|${operation}|${useBlocklist}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        console.debug('[PATH_SECURITY] Cache hit for path validation', { inputPath, operation, useBlocklist });
        return cached;
      }

      console.debug('[PATH_SECURITY] Starting enhanced path validation', {
        inputPath,
        baseDir,
        allowedScope,
        operation,
        useBlocklist
      });

      // Layer 1: Basic input validation
      const basicValidation = this.validateBasicInput(inputPath);
      if (!basicValidation.isValid) {
        return this.createValidationResult(false, basicValidation.error, basicValidation.details);
      }

      // Layer 2: Path traversal detection
      const traversalCheck = this.detectTraversalAttempts(inputPath);
      if (!traversalCheck.isValid) {
        this.logSecurityViolation('PATH_TRAVERSAL', inputPath, traversalCheck.details);
        return this.createValidationResult(false, traversalCheck.error, traversalCheck.details);
      }

      // Layer 3: Character validation
      const charValidation = this.validatePathCharacters(inputPath);
      if (!charValidation.isValid) {
        return this.createValidationResult(false, charValidation.error, charValidation.details);
      }

      // Layer 4: Length validation
      const lengthValidation = this.checkPathLength(inputPath);
      if (!lengthValidation.isValid) {
        return this.createValidationResult(false, lengthValidation.error, lengthValidation.details);
      }

      // Layer 5: Path normalization and canonicalization
      const normalizedPath = this.normalizePath(inputPath);
      const canonicalPath = this.canonicalizePath(normalizedPath, baseDir);

      // Layer 6: Scope validation
      const scopeValidation = this.validateScope(canonicalPath, allowedScope || this.gameDataRoot, useBlocklist);
      if (!scopeValidation.isValid) {
        this.logSecurityViolation('SCOPE_VIOLATION', inputPath, scopeValidation.details);
        return this.createValidationResult(false, scopeValidation.error, scopeValidation.details);
      }

      // Layer 7: Security policy enforcement
      const policyValidation = this.enforceSecurityPolicy(canonicalPath, operation);
      if (!policyValidation.isValid) {
        this.logSecurityViolation('POLICY_VIOLATION', inputPath, policyValidation.details);
        return this.createValidationResult(false, policyValidation.error, policyValidation.details);
      }

      // Layer 8: File type restrictions
      const typeValidation = this.checkFileTypeRestrictions(canonicalPath, operation);
      if (!typeValidation.isValid) {
        return this.createValidationResult(false, typeValidation.error, typeValidation.details);
      }

      const result = this.createValidationResult(true, null, {
        originalPath: inputPath,
        normalizedPath,
        canonicalPath,
        operation,
        useBlocklist,
        validationTime: Date.now() - startTime
      });

      // Cache successful validation
      this.setCachedResult(cacheKey, result);

      if (this.auditEnabled && this.securityPolicies[operation]?.logAccess) {
        this.logSecurityEvent('PATH_ACCESS_GRANTED', inputPath, {
          canonicalPath,
          operation,
          useBlocklist,
          validationTime: result.details.validationTime
        });
      }

      console.debug('[PATH_SECURITY] Path validation successful', {
        inputPath,
        canonicalPath,
        operation,
        useBlocklist,
        validationTime: result.details.validationTime
      });

      return result;

    } catch (error) {
      const errorResult = this.createValidationResult(false, 
        `Path validation failed: ${error.message}`,
        { 
          originalError: error.message,
          inputPath,
          operation,
          useBlocklist,
          validationTime: Date.now() - startTime
        }
      );

      this.logSecurityViolation('VALIDATION_ERROR', inputPath, errorResult.details);
      return errorResult;
    }
  }

  /**
   * Batch validation for multiple paths
   * @param {Array<string>} paths - Array of paths to validate
   * @param {string} baseDir - Base directory for relative paths
   * @param {string} allowedScope - Allowed scope directory
   * @param {string} operation - Operation type
   * @returns {Object} Batch validation results
   */
  validatePathBatch(paths, baseDir = null, allowedScope = null, operation = 'READ') {
    const startTime = Date.now();
    
    console.debug('[PATH_SECURITY] Starting batch path validation', {
      pathCount: paths.length,
      operation
    });

    const results = {
      valid: [],
      invalid: [],
      totalProcessed: 0,
      validCount: 0,
      invalidCount: 0,
      processingTime: 0
    };

    for (const inputPath of paths) {
      const validation = this.validatePath(inputPath, baseDir, allowedScope, operation);
      
      if (validation.isValid) {
        results.valid.push({
          originalPath: inputPath,
          canonicalPath: validation.details.canonicalPath,
          validation
        });
        results.validCount++;
      } else {
        results.invalid.push({
          originalPath: inputPath,
          error: validation.error,
          details: validation.details
        });
        results.invalidCount++;
      }
      
      results.totalProcessed++;
    }

    results.processingTime = Date.now() - startTime;

    console.debug('[PATH_SECURITY] Batch validation completed', {
      totalProcessed: results.totalProcessed,
      validCount: results.validCount,
      invalidCount: results.invalidCount,
      processingTime: results.processingTime
    });

    return results;
  }

  /**
   * Advanced traversal detection with multiple attack vectors
   * @param {string} inputPath - Path to check
   * @returns {Object} Detection result
   */
  detectTraversalAttempts(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'Invalid input path', details: { inputPath } };
    }

    const violations = [];

    // Check each blocked pattern
    for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
      if (pattern.test(inputPath)) {
        violations.push(`Blocked pattern detected: ${pattern.source}`);
      }
    }

    // Check for encoded traversal attempts
    const decodedPath = decodeURIComponent(inputPath);
    if (decodedPath !== inputPath) {
      for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
        if (pattern.test(decodedPath)) {
          violations.push(`Encoded traversal attempt detected: ${pattern.source}`);
        }
      }
    }

    // Check for double encoding
    try {
      const doubleDecoded = decodeURIComponent(decodedPath);
      if (doubleDecoded !== decodedPath) {
        for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
          if (pattern.test(doubleDecoded)) {
            violations.push(`Double-encoded traversal attempt detected: ${pattern.source}`);
          }
        }
      }
    } catch (error) {
      // Ignore decode errors
    }

    // Whitelist of allowed hidden directories/files
    const allowedHiddenPaths = new Set([
      '.fenestra-storage',
      '.fenestra-config.json'
    ]);

    // Check for path component violations
    const components = inputPath.split(/[\/\\]+/);
    for (const component of components) {
      if (component === '..') {
        violations.push('Direct parent directory reference');
      }
      if (component === '~') {
        violations.push('Home directory reference');
      }
      // Check for suspicious hidden files, but allow whitelisted ones
      if (component.startsWith('.') && component.length > 2 && !allowedHiddenPaths.has(component)) {
        violations.push(`Suspicious hidden file reference: ${component}`);
      }
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        error: 'Path traversal attempt detected',
        details: {
          inputPath,
          violations,
          severity: ERROR_SEVERITY.HIGH
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Enhanced character validation with security focus
   * @param {string} inputPath - Path to validate
   * @returns {Object} Validation result
   */
  validatePathCharacters(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'Path must be a non-empty string', details: { inputPath } };
    }

    const violations = [];

    // Use existing path character validation
    const basicValidation = validatePathChars(inputPath);
    if (!basicValidation.isValid) {
      violations.push(...basicValidation.errors);
    }

    // Additional security-focused character checks
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(inputPath)) {
      violations.push('Contains control characters');
    }

    if (/[<>"|*?]/.test(inputPath)) {
      violations.push('Contains shell metacharacters');
    }

    if (/[`${}]/.test(inputPath)) {
      violations.push('Contains command injection characters');
    }

    // Check for Unicode normalization attacks
    const normalized = inputPath.normalize('NFC');
    if (normalized !== inputPath) {
      violations.push('Unicode normalization mismatch detected');
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        error: 'Invalid path characters detected',
        details: {
          inputPath,
          violations,
          severity: ERROR_SEVERITY.MEDIUM
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Path length validation with component-level checks
   * @param {string} inputPath - Path to validate
   * @returns {Object} Validation result
   */
  checkPathLength(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'Path must be a non-empty string', details: { inputPath } };
    }

    const violations = [];

    // Check total path length
    if (inputPath.length > SECURITY_CONFIG.MAX_PATH_LENGTH) {
      violations.push(`Path exceeds maximum length: ${inputPath.length} > ${SECURITY_CONFIG.MAX_PATH_LENGTH}`);
    }

    // Check individual component lengths
    const components = inputPath.split(/[\/\\]+/);
    for (const component of components) {
      if (component.length > SECURITY_CONFIG.MAX_COMPONENT_LENGTH) {
        violations.push(`Component exceeds maximum length: "${component}" (${component.length} > ${SECURITY_CONFIG.MAX_COMPONENT_LENGTH})`);
      }
    }

    // Check path depth
    const depth = components.filter(c => c && c !== '.').length;
    if (depth > SECURITY_CONFIG.MAX_DEPTH) {
      violations.push(`Path depth exceeds maximum: ${depth} > ${SECURITY_CONFIG.MAX_DEPTH}`);
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        error: 'Path length validation failed',
        details: {
          inputPath,
          violations,
          pathLength: inputPath.length,
          componentCount: components.length,
          depth,
          severity: ERROR_SEVERITY.MEDIUM
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Advanced path normalization with security considerations
   * @param {string} inputPath - Path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }

    // Start with basic normalization
    let normalized = normalizePathUtil(inputPath);

    // Remove redundant separators
    normalized = normalized.replace(/[\/\\]+/g, path.sep);

    // Remove trailing separators (except root)
    if (normalized.length > 1 && normalized.endsWith(path.sep)) {
      normalized = normalized.slice(0, -1);
    }

    // Handle Windows drive letter normalization
    if (isWindows && hasWindowsDriveLetter(normalized)) {
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    // Unicode normalization for security
    normalized = normalized.normalize('NFC');

    return normalized;
  }

  /**
   * Path canonicalization with base directory resolution
   * @param {string} inputPath - Path to canonicalize
   * @param {string} baseDir - Base directory for relative paths
   * @returns {string} Canonical path
   */
  canonicalizePath(inputPath, baseDir = null) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }

    try {
      let canonical;

      if (path.isAbsolute(inputPath)) {
        canonical = path.resolve(inputPath);
      } else {
        const base = baseDir || this.gameDataRoot;
        canonical = path.resolve(base, inputPath);
      }

      // Additional canonicalization for Windows
      if (isWindows) {
        canonical = canonical.toLowerCase();
      }

      return canonical;
    } catch (error) {
      console.warn('[PATH_SECURITY] Canonicalization failed', {
        inputPath,
        baseDir,
        error: error.message
      });
      return inputPath;
    }
  }

  /**
   * Security policy enforcement based on operation type
   * @param {string} canonicalPath - Canonical path to check
   * @param {string} operation - Operation type
   * @returns {Object} Policy validation result
   */
  enforceSecurityPolicy(canonicalPath, operation) {
    const policy = this.securityPolicies[operation.toUpperCase()];
    if (!policy) {
      return {
        isValid: false,
        error: `Unknown operation type: ${operation}`,
        details: { operation, canonicalPath }
      };
    }

    const violations = [];

    // Check absolute path policy
    if (!policy.allowAbsolute && path.isAbsolute(canonicalPath)) {
      violations.push('Absolute paths not allowed for this operation');
    }

    // Check depth policy
    const components = canonicalPath.split(path.sep).filter(c => c);
    if (components.length > policy.maxDepth) {
      violations.push(`Path depth exceeds policy limit: ${components.length} > ${policy.maxDepth}`);
    }

    // Check extension policy (only for files, not directories)
    if (policy.allowedExtensions) {
      const ext = path.extname(canonicalPath).toLowerCase();
      
      // Determine if this is a directory path
      const isDirectory = this.isDirectoryPath(canonicalPath);
      
      // Only validate extension for files (paths with extensions that are not directories)
      if (ext && !isDirectory && !policy.allowedExtensions.has(ext)) {
        violations.push(`File extension not allowed: ${ext}`);
      }
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        error: 'Security policy violation',
        details: {
          canonicalPath,
          operation,
          violations,
          policy: {
            allowAbsolute: policy.allowAbsolute,
            maxDepth: policy.maxDepth,
            allowedExtensions: policy.allowedExtensions ? Array.from(policy.allowedExtensions) : null
          },
          severity: ERROR_SEVERITY.HIGH
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Determines if a path refers to a directory
   * @param {string} pathToCheck - Path to check
   * @returns {boolean} True if the path is a directory
   */
  isDirectoryPath(pathToCheck) {
    if (!pathToCheck || typeof pathToCheck !== 'string') {
      return false;
    }

    // Whitelist of known directory names
    const whitelistedDirectories = new Set([
      '.fenestra-storage',
      '.fenestra-config',
      'node_modules',
      '.git'
    ]);

    // Check if path ends with a separator
    if (pathToCheck.endsWith(path.sep) || pathToCheck.endsWith('/') || pathToCheck.endsWith('\\')) {
      return true;
    }

    // Check if path contains a whitelisted directory name
    const pathComponents = pathToCheck.split(/[\/\\]+/);
    for (const component of pathComponents) {
      if (whitelistedDirectories.has(component)) {
        return true;
      }
    }

    // Check if the path exists and is a directory
    try {
      if (fs.existsSync(pathToCheck)) {
        const stats = fs.statSync(pathToCheck);
        return stats.isDirectory();
      }
    } catch (error) {
      // If we can't check, fall back to heuristics
    }

    // If no extension, likely a directory (but not definitive)
    const ext = path.extname(pathToCheck);
    if (!ext) {
      // Additional heuristic: if the last component looks like a directory name
      const basename = path.basename(pathToCheck);
      // Common directory patterns: starts with dot, no extension, all lowercase/uppercase
      if (basename.startsWith('.') || basename === basename.toLowerCase() || basename === basename.toUpperCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * File type restriction validation
   * @param {string} filePath - File path to check
   * @param {string} operation - Operation type
   * @returns {Object} Validation result
   */
  checkFileTypeRestrictions(filePath, operation) {
    const ext = path.extname(filePath).toLowerCase();
    const policy = this.securityPolicies[operation.toUpperCase()];

    // Skip if no extension or no policy restrictions
    if (!ext || !policy?.allowedExtensions) {
      return { isValid: true };
    }

    if (!policy.allowedExtensions.has(ext)) {
      return {
        isValid: false,
        error: `File type not allowed for ${operation} operation`,
        details: {
          filePath,
          extension: ext,
          operation,
          allowedExtensions: Array.from(policy.allowedExtensions),
          severity: ERROR_SEVERITY.MEDIUM
        }
      };
    }

    return { isValid: true };
  }

  // Helper methods for validation results, caching, and logging
  validateBasicInput(inputPath) {
    if (!inputPath) {
      return { isValid: false, error: 'Path is required', details: { inputPath } };
    }

    if (typeof inputPath !== 'string') {
      return { isValid: false, error: 'Path must be a string', details: { inputPath, type: typeof inputPath } };
    }

    if (inputPath.trim() === '') {
      return { isValid: false, error: 'Path cannot be empty', details: { inputPath } };
    }

    return { isValid: true };
  }

  /**
     * Validates if a path is within allowed scope using blocklist or allowlist approach
     * 
     * This method supports two validation modes:
     * 1. Blocklist mode (useBlocklist=true): Allows access to any path except those containing
     *    blocked directory components. More flexible for file operations.
     * 2. Allowlist mode (useBlocklist=false): Only allows access within the allowedScope directory.
     *    More restrictive, used for directory navigation commands.
     * 
     * Validation flow:
     * 1. If allowlist mode: Check if path is within allowed scope
     * 2. If blocklist mode: Check if path contains any blocked directory components
     * 3. Check if blocked directory has been explicitly unlocked
     * 4. Return validation result with specific error messages
     * 
     * @param {string} canonicalPath - The canonical (absolute, normalized) path to validate
     * @param {string} allowedScope - Allowed scope directory (used in allowlist mode)
     * @param {boolean} useBlocklist - If true, uses blocklist validation; if false, uses allowlist validation
     * @returns {Object} Validation result object
     * @returns {boolean} returns.isValid - True if path is valid and accessible
     * @returns {string} [returns.error] - Error message if validation failed
     * @returns {Object} [returns.details] - Additional details about the validation
     * 
     * @example
     * // Blocklist mode: Path not blocked
     * validateScope('/game/data/content/image.png', '/game/data', true)
     * // Returns: { isValid: true }
     * 
     * @example
     * // Blocklist mode: Path contains blocked directory
     * validateScope('/game/data/node_modules/package.json', '/game/data', true)
     * // Returns: { isValid: false, error: '...', details: {...} }
     * 
     * @example
     * // Allowlist mode: Path within scope
     * validateScope('/game/data/saves/game1.json', '/game/data', false)
     * // Returns: { isValid: true }
     * 
     * @example
     * // Allowlist mode: Path outside scope
     * validateScope('/home/user/image.png', '/game/data', false)
     * // Returns: { isValid: false, error: '...', details: {...} }
     */
    validateScope(canonicalPath, allowedScope, useBlocklist = true) {
      try {
        // Allowlist mode: Only allow paths within the allowed scope
        if (!useBlocklist) {
          const isWithin = isPathWithinScope(canonicalPath, allowedScope);

          if (!isWithin) {
            return {
              isValid: false,
              error: 'Path outside allowed scope',
              details: {
                canonicalPath,
                allowedScope,
                mode: 'allowlist',
                severity: ERROR_SEVERITY.HIGH
              }
            };
          }

          // In allowlist mode, if within scope, it's valid
          return { isValid: true };
        }

        // Blocklist mode: Check if path contains any blocked directory components
        const blockCheck = this.isBlockedDirectory(canonicalPath);

        if (blockCheck.isBlocked) {
          // Check if this blocked directory has been explicitly unlocked
          const isUnlocked = this.isDirectoryUnlocked(canonicalPath);

          if (!isUnlocked) {
            // Path is blocked and not unlocked - deny access
            return {
              isValid: false,
              error: `Access denied: Path contains blocked directory '${blockCheck.blockedDirectory}'. This directory is protected for security reasons.`,
              details: {
                canonicalPath,
                blockedDirectory: blockCheck.blockedDirectory,
                reason: 'blocked_directory',
                mode: 'blocklist',
                severity: ERROR_SEVERITY.HIGH
              }
            };
          }

          // Path is blocked but has been unlocked - allow access
          console.debug('[PATH_SECURITY] Allowing access to unlocked blocked directory', {
            canonicalPath,
            blockedDirectory: blockCheck.blockedDirectory
          });
        }

        // Path is valid - either not blocked or explicitly unlocked
        return { isValid: true };

      } catch (error) {
        return {
          isValid: false,
          error: 'Scope validation failed',
          details: {
            canonicalPath,
            allowedScope,
            useBlocklist,
            error: error.message,
            severity: ERROR_SEVERITY.MEDIUM
          }
        };
      }
    }
  /**
   * Checks if a path contains any blocked directory components
   *
   * This method validates whether a given path contains any directory components
   * that are in the BLOCKED_DIRECTORIES list. It performs case-insensitive matching
   * for Windows compatibility and checks each path component individually.
   *
   * @param {string} pathToCheck - The path to check for blocked directories
   * @returns {Object} Result object with isBlocked flag and details
   * @returns {boolean} returns.isBlocked - True if path contains a blocked directory
   * @returns {string|null} returns.blockedDirectory - The blocked directory that was matched, or null
   * @returns {string|null} returns.error - Error message if path is blocked, or null
   *
   * @example
   * // Returns { isBlocked: true, blockedDirectory: 'node_modules', error: '...' }
   * validator.isBlockedDirectory('/path/to/node_modules/package')
   *
   * @example
   * // Returns { isBlocked: false, blockedDirectory: null, error: null }
   * validator.isBlockedDirectory('/path/to/user/content')
   */
  /**
     * Checks if a path contains any blocked directory components
     * 
     * This method validates whether a given path contains any directory components
     * that are in the BLOCKED_DIRECTORIES list. It performs case-insensitive matching
     * for Windows compatibility and checks each path component individually.
     * It also handles path patterns like '.kiro/hooks' by checking for consecutive
     * component matches.
     * 
     * @param {string} pathToCheck - The path to check for blocked directories
     * @returns {Object} Result object with isBlocked flag and details
     * @returns {boolean} returns.isBlocked - True if path contains a blocked directory
     * @returns {string|null} returns.blockedDirectory - The blocked directory that was matched, or null
     * @returns {string|null} returns.error - Error message if path is blocked, or null
     * 
     * @example
     * // Returns { isBlocked: true, blockedDirectory: 'node_modules', error: '...' }
     * validator.isBlockedDirectory('/path/to/node_modules/package')
     * 
     * @example
     * // Returns { isBlocked: false, blockedDirectory: null, error: null }
     * validator.isBlockedDirectory('/path/to/user/content')
     */
    isBlockedDirectory(pathToCheck) {
      if (!pathToCheck || typeof pathToCheck !== 'string') {
        return {
          isBlocked: false,
          blockedDirectory: null,
          error: null
        };
      }

      // Normalize the path for consistent comparison
      const normalizedPath = this.normalizePath(pathToCheck);

      // Split path into components
      const pathComponents = normalizedPath.split(path.sep).filter(c => c);

      // Check each blocked directory pattern
      for (const blockedDir of BLOCKED_DIRECTORIES) {
        // Check if blocked directory contains path separator (pattern like '.kiro/hooks')
        if (blockedDir.includes('/') || blockedDir.includes('\\')) {
          // Normalize the blocked directory pattern
          const blockedPattern = blockedDir.replace(/[\/\\]+/g, path.sep);
          const blockedComponents = blockedPattern.split(path.sep).filter(c => c);

          // Check if the path contains this sequence of components
          for (let i = 0; i <= pathComponents.length - blockedComponents.length; i++) {
            let matches = true;
            for (let j = 0; j < blockedComponents.length; j++) {
              const pathComp = pathComponents[i + j].toLowerCase();
              const blockedComp = blockedComponents[j].toLowerCase();
              if (pathComp !== blockedComp) {
                matches = false;
                break;
              }
            }

            if (matches) {
              return {
                isBlocked: true,
                blockedDirectory: blockedDir,
                error: `Access denied: Path contains blocked directory '${blockedDir}'. This directory is protected for security reasons.`
              };
            }
          }
        } else {
          // Single component check
          for (const component of pathComponents) {
            // Case-insensitive comparison for Windows compatibility
            const componentLower = component.toLowerCase();
            const blockedDirLower = blockedDir.toLowerCase();

            if (componentLower === blockedDirLower) {
              return {
                isBlocked: true,
                blockedDirectory: blockedDir,
                error: `Access denied: Path contains blocked directory '${blockedDir}'. This directory is protected for security reasons.`
              };
            }
          }
        }
      }

      // No blocked directories found
      return {
        isBlocked: false,
        blockedDirectory: null,
        error: null
      };
    }

    /**
     * Returns a list of all currently unlocked directories.
     *
     * This method provides visibility into which directories have been explicitly
     * unlocked using the unlockDirectory() method. This is useful for debugging,
     * game state management, and displaying unlock status to users.
     *
     * The returned array contains normalized absolute paths of all unlocked directories.
     * The array is a copy of the internal Set, so modifying it will not affect the
     * validator's state.
     *
     * @returns {Array<string>} Array of unlocked directory paths (normalized absolute paths)
     *
     * @example
     * // Get list of unlocked directories
     * validator.unlockDirectory('./doors/secret-room');
     * validator.unlockDirectory('./doors/treasure-vault');
     * const unlocked = validator.listUnlockedDirectories();
     * console.log(unlocked);
     * // [
     * //   '/absolute/path/to/doors/secret-room',
     * //   '/absolute/path/to/doors/treasure-vault'
     * // ]
     *
     * @example
     * // Check if any directories are unlocked
     * const unlocked = validator.listUnlockedDirectories();
     * if (unlocked.length > 0) {
     *   console.log(`${unlocked.length} directories are currently unlocked`);
     * }
     */
    listUnlockedDirectories() {
      // Return array copy of unlockedDirectories Set
      return Array.from(this.unlockedDirectories);
    }

    /**
     * Clears all unlocked directories, restoring default blocklist behavior for all paths.
     *
     * This method removes all directories from the unlockedDirectories set, effectively
     * locking all previously unlocked directories at once. This is useful for game reset
     * scenarios, level transitions, or when you need to restore the default security state.
     *
     * The method returns the count of directories that were cleared, which can be useful
     * for logging or confirming the operation's effect.
     *
     * @returns {number} The number of directories that were cleared (unlocked before clearing)
     *
     * @example
     * // Clear all unlocked directories
     * validator.unlockDirectory('./doors/secret-room');
     * validator.unlockDirectory('./doors/treasure-vault');
     * const count = validator.clearUnlockedDirectories();
     * console.log(`Cleared ${count} unlocked directories`);
     * // Output: "Cleared 2 unlocked directories"
     *
     * @example
     * // Reset security state on game restart
     * function resetGameState() {
     *   const clearedCount = validator.clearUnlockedDirectories();
     *   console.log(`Game reset: ${clearedCount} directories locked`);
     * }
     *
     * @example
     * // Clear when no directories are unlocked
     * const count = validator.clearUnlockedDirectories();
     * console.log(count); // 0
     */
    clearUnlockedDirectories() {
      // Get count before clearing
      const count = this.unlockedDirectories.size;

      // Clear the Set
      this.unlockedDirectories.clear();

      console.debug('[PATH_SECURITY] Cleared all unlocked directories', {
        clearedCount: count
      });

      // Return count of cleared directories
      return count;
    }


    /**
     * Checks if a directory has been explicitly unlocked for access
     *
     * This method checks if a given directory path or any of its parent directories
     * have been explicitly unlocked using the unlockDirectory() method. Unlocked
     * directories bypass the blocklist restrictions while still maintaining all
     * other security checks (path traversal, encoding, etc.).
     *
     * The method walks up the directory tree checking each parent directory to see
     * if it has been unlocked. This allows unlocking a parent directory to grant
     * access to all its subdirectories.
     *
     * @param {string} directoryPath - The directory path to check for unlock status
     * @returns {boolean} True if the directory or any parent is unlocked, false otherwise
     *
     * @example
     * // Check if a specific directory is unlocked
     * validator.unlockDirectory('/game/data/src');
     * validator.isDirectoryUnlocked('/game/data/src/config.js'); // Returns: true
     *
     * @example
     * // Parent directory unlock grants access to children
     * validator.unlockDirectory('/game/data/src');
     * validator.isDirectoryUnlocked('/game/data/src/utils/helper.js'); // Returns: true
     *
     * @example
     * // Directory not unlocked
     * validator.isDirectoryUnlocked('/game/data/node_modules/package.json'); // Returns: false
     */
    isDirectoryUnlocked(directoryPath) {
      if (!directoryPath || typeof directoryPath !== 'string') {
        return false;
      }

      try {
        // Normalize the path for consistent comparison
        const normalizedPath = path.resolve(directoryPath);

        // Check if the exact path is unlocked
        if (this.unlockedDirectories.has(normalizedPath)) {
          return true;
        }

        // Walk up the directory tree to check if any parent is unlocked
        let currentPath = normalizedPath;
        const root = path.parse(currentPath).root;

        while (currentPath !== root) {
          if (this.unlockedDirectories.has(currentPath)) {
            return true;
          }

          const parentPath = path.dirname(currentPath);
          if (parentPath === currentPath) {
            // Reached the root
            break;
          }
          currentPath = parentPath;
        }

        // No unlocked directory found in the path hierarchy
        return false;

      } catch (error) {
        console.error('[PATH_SECURITY] Error checking directory unlock status', {
          directoryPath,
          error: error.message
        });
        return false;
      }
    }

  /**
   * Unlocks a directory to allow access despite being in the blocked list.
   * 
   * This method allows programmatic unlocking of directories that would normally
   * be blocked by the security validator. This is useful for game mechanics like
   * door/key systems where access to certain directories should be granted
   * dynamically based on game state.
   * 
   * The unlocked directory and all its subdirectories will be accessible until
   * explicitly locked again using lockDirectory(). However, all other security
   * checks (path traversal, encoding validation, etc.) remain active.
   * 
   * @param {string} directoryPath - The directory path to unlock
   * @returns {Object} Result object with success status and details
   * @returns {boolean} result.success - Whether the unlock operation succeeded
   * @returns {string} result.unlockedPath - The normalized path that was unlocked
   * @returns {string} [result.error] - Error message if the operation failed
   * 
   * @example
   * // Unlock a specific directory
   * const result = validator.unlockDirectory('./doors/secret-room');
   * if (result.success) {
   *   console.log(`Unlocked: ${result.unlockedPath}`);
   * }
   * 
   * @example
   * // Attempting to unlock system root (will fail)
   * const result = validator.unlockDirectory('/');
   * console.log(result.error); // "Cannot unlock system root directory"
   */
  unlockDirectory(directoryPath) {
    // Validate input
    if (!directoryPath || typeof directoryPath !== 'string') {
      return {
        success: false,
        error: 'Invalid directory path: Path must be a non-empty string'
      };
    }

    try {
      // Normalize and resolve the directory path
      const normalizedPath = path.resolve(directoryPath);

      // Validate path is not system root
      const parsedPath = path.parse(normalizedPath);
      const isSystemRoot = normalizedPath === parsedPath.root;
      
      if (isSystemRoot) {
        return {
          success: false,
          error: `Cannot unlock system root directory: ${normalizedPath}`
        };
      }

      // Check for dangerous locations (parent of current working directory, etc.)
      const cwd = process.cwd();
      const cwdParent = path.dirname(cwd);
      
      // Prevent unlocking parent directories of the application
      if (normalizedPath === cwdParent || normalizedPath === path.dirname(cwdParent)) {
        return {
          success: false,
          error: `Cannot unlock dangerous location: ${normalizedPath}`
        };
      }

      // Add normalized path to unlockedDirectories Set
      this.unlockedDirectories.add(normalizedPath);

      console.debug('[PATH_SECURITY] Directory unlocked', {
        path: normalizedPath,
        totalUnlocked: this.unlockedDirectories.size
      });

      // Return success result object with unlocked path
      return {
        success: true,
        unlockedPath: normalizedPath,
        message: `Directory unlocked successfully: ${normalizedPath}`
      };

    } catch (error) {
      // Handle errors gracefully with descriptive error messages
      console.error('[PATH_SECURITY] Error unlocking directory', {
        directoryPath,
        error: error.message
      });

      return {
        success: false,
        error: `Failed to unlock directory: ${error.message}`
      };
    }
  }

  /**
   * Locks a previously unlocked directory, removing it from the unlocked directories set.
   * 
   * This method removes a directory from the unlockedDirectories set, restoring the
   * default blocklist behavior for that directory. After locking, the directory will
   * be subject to normal blocklist validation again.
   * 
   * If the directory was not previously unlocked, the method returns a warning (not an error)
   * to indicate that the operation had no effect but is not considered a failure.
   * 
   * @param {string} directoryPath - The path to the directory to lock. Can be absolute or relative.
   *                                  The path will be normalized and resolved to an absolute path.
   * 
   * @returns {Object} Result object with the following properties:
   *   - success {boolean} - Always true (even if directory wasn't unlocked)
   *   - lockedPath {string} - The normalized absolute path that was locked
   *   - message {string} - Success or warning message
   *   - wasUnlocked {boolean} - Whether the directory was actually unlocked before locking
   * 
   * @example
   * // Lock a previously unlocked directory
   * validator.unlockDirectory('./doors/secret-room');
   * const result = validator.lockDirectory('./doors/secret-room');
   * console.log(result);
   * // {
   * //   success: true,
   * //   lockedPath: '/absolute/path/to/doors/secret-room',
   * //   message: 'Directory locked successfully: /absolute/path/to/doors/secret-room',
   * //   wasUnlocked: true
   * // }
   * 
   * @example
   * // Lock a directory that wasn't unlocked (returns warning)
   * const result = validator.lockDirectory('./some/directory');
   * console.log(result);
   * // {
   * //   success: true,
   * //   lockedPath: '/absolute/path/to/some/directory',
   * //   message: 'Warning: Directory was not unlocked: /absolute/path/to/some/directory',
   * //   wasUnlocked: false
   * // }
   * 
   * @example
   * // Lock with relative path (will be normalized)
   * const result = validator.lockDirectory('../parent/directory');
   * console.log(result.lockedPath); // Absolute normalized path
   */
  lockDirectory(directoryPath) {
    // Validate input
    if (!directoryPath || typeof directoryPath !== 'string') {
      return {
        success: false,
        error: 'Invalid directory path: Path must be a non-empty string'
      };
    }

    try {
      // Normalize and resolve the directory path using path.resolve()
      const normalizedPath = path.resolve(directoryPath);

      // Check if directory was actually unlocked
      const wasUnlocked = this.unlockedDirectories.has(normalizedPath);

      // Remove path from unlockedDirectories Set using Set.delete()
      this.unlockedDirectories.delete(normalizedPath);

      console.debug('[PATH_SECURITY] Directory lock attempt', {
        path: normalizedPath,
        wasUnlocked,
        totalUnlocked: this.unlockedDirectories.size
      });

      // Return success result object
      // Handle case where directory wasn't unlocked (return warning, not error)
      return {
        success: true,
        lockedPath: normalizedPath,
        message: wasUnlocked 
          ? `Directory locked successfully: ${normalizedPath}`
          : `Warning: Directory was not unlocked: ${normalizedPath}`,
        wasUnlocked
      };

    } catch (error) {
      // Handle errors gracefully with descriptive error messages
      console.error('[PATH_SECURITY] Error locking directory', {
        directoryPath,
        error: error.message
      });

      return {
        success: false,
        error: `Failed to lock directory: ${error.message}`
      };
    }
  }

  /**
   * Returns a list of all currently unlocked directories.
   * 
   * This method provides visibility into which directories have been explicitly
   * unlocked using the unlockDirectory() method. This is useful for debugging,
   * game state management, and displaying unlock status to users.
   * 
   * The returned array contains normalized absolute paths of all unlocked directories.
   * The array is a copy of the internal Set, so modifying it will not affect the
   * validator's state.
   * 
   * @returns {Array<string>} Array of unlocked directory paths (normalized absolute paths)
   * 
   * @example
   * // Get list of unlocked directories
   * validator.unlockDirectory('./doors/secret-room');
   * validator.unlockDirectory('./doors/treasure-vault');
   * const unlocked = validator.listUnlockedDirectories();
   * console.log(unlocked);
   * // [
   * //   '/absolute/path/to/doors/secret-room',
   * //   '/absolute/path/to/doors/treasure-vault'
   * // ]
   * 
   * @example
   * // Check if any directories are unlocked
   * const unlocked = validator.listUnlockedDirectories();
   * if (unlocked.length > 0) {
   *   console.log(`${unlocked.length} directories are currently unlocked`);
   * }
   */
  listUnlockedDirectories() {
    // Return array copy of unlockedDirectories Set
    return Array.from(this.unlockedDirectories);
  }

  /**
   * Clears all unlocked directories, restoring default blocklist behavior for all paths.
   * 
   * This method removes all directories from the unlockedDirectories set, effectively
   * locking all previously unlocked directories at once. This is useful for game reset
   * scenarios, level transitions, or when you need to restore the default security state.
   * 
   * The method returns the count of directories that were cleared, which can be useful
   * for logging or confirming the operation's effect.
   * 
   * @returns {number} The number of directories that were cleared (unlocked before clearing)
   * 
   * @example
   * // Clear all unlocked directories
   * validator.unlockDirectory('./doors/secret-room');
   * validator.unlockDirectory('./doors/treasure-vault');
   * const count = validator.clearUnlockedDirectories();
   * console.log(`Cleared ${count} unlocked directories`);
   * // Output: "Cleared 2 unlocked directories"
   * 
   * @example
   * // Reset security state on game restart
   * function resetGameState() {
   *   const clearedCount = validator.clearUnlockedDirectories();
   *   console.log(`Game reset: ${clearedCount} directories locked`);
   * }
   * 
   * @example
   * // Clear when no directories are unlocked
   * const count = validator.clearUnlockedDirectories();
   * console.log(count); // 0
   */
  clearUnlockedDirectories() {
    // Get count before clearing
    const count = this.unlockedDirectories.size;

    // Clear the Set
    this.unlockedDirectories.clear();

    console.debug('[PATH_SECURITY] Cleared all unlocked directories', {
      clearedCount: count
    });

    // Return count of cleared directories
    return count;
  }

  createValidationResult(isValid, error = null, details = {}) {
    return {
      isValid,
      error,
      details: {
        timestamp: new Date().toISOString(),
        validator: 'EnhancedPathSecurityValidator',
        ...details
      }
    };
  }

  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  setCachedResult(key, result) {
    // Implement LRU cache behavior
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  logSecurityViolation(violationType, inputPath, details) {
    if (!this.auditEnabled) return;

    // Log to audit system
    try {
      const auditEventType = this.mapViolationToAuditEventType(violationType);
      const auditSeverity = this.mapSeverityToAuditSeverity(details.severity || 'high');
      
      securityAuditSystem.logSecurityEvent(auditEventType, auditSeverity, {
        component: 'EnhancedPathSecurityValidator',
        function: 'validatePath',
        violationType,
        mitigationAction: 'path_rejected',
        inputData: inputPath,
        ...details
      });
    } catch (auditError) {
      console.error('[PATH_SECURITY] Failed to log to audit system', {
        violationType,
        inputPath,
        error: auditError.message
      });
    }

    const violation = new FileCompletionError(
      `Security violation: ${violationType}`,
      ERROR_CODES.PATH_TRAVERSAL_ATTEMPT,
      {
        violationType,
        inputPath,
        ...details,
        severity: details.severity || ERROR_SEVERITY.HIGH
      }
    );

    logError(violation, { 
      component: 'EnhancedPathSecurityValidator',
      violationType,
      inputPath
    });
  }

  /**
   * Maps path violation type to audit system event type
   * @param {string} violationType - Path violation type
   * @returns {string} Audit system event type
   */
  mapViolationToAuditEventType(violationType) {
    const eventTypeMap = {
      'PATH_TRAVERSAL': SECURITY_EVENT_TYPES.PATH_TRAVERSAL,
      'SCOPE_VIOLATION': SECURITY_EVENT_TYPES.ACCESS_DENIED,
      'POLICY_VIOLATION': SECURITY_EVENT_TYPES.ACCESS_DENIED,
      'VALIDATION_ERROR': SECURITY_EVENT_TYPES.PATH_TRAVERSAL
    };
    
    return eventTypeMap[violationType] || SECURITY_EVENT_TYPES.ACCESS_DENIED;
  }

  /**
   * Maps path severity to audit system severity
   * @param {string} pathSeverity - Path severity level
   * @returns {string} Audit system severity level
   */
  mapSeverityToAuditSeverity(pathSeverity) {
    const severityMap = {
      'low': SEVERITY_LEVELS.LOW,
      'medium': SEVERITY_LEVELS.MEDIUM,
      'high': SEVERITY_LEVELS.HIGH,
      'critical': SEVERITY_LEVELS.CRITICAL
    };
    
    return severityMap[pathSeverity] || SEVERITY_LEVELS.HIGH;
  }

  logSecurityEvent(eventType, inputPath, details) {
    if (!this.auditEnabled) return;

    console.debug(`[PATH_SECURITY] ${eventType}`, {
      inputPath,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}

// Legacy compatibility functions - these wrap the enhanced validator for existing code

/**
 * Create a default enhanced validator instance
 */
const defaultValidator = new EnhancedPathSecurityValidator();

/**
 * Singleton instance of EnhancedPathSecurityValidator for shared use across the application.
 * 
 * This singleton provides a centralized validator instance that maintains state across
 * validation calls, including:
 * - Unlocked directories (for game mechanics like door/key systems)
 * - Validation result cache for performance
 * - Consistent security policies
 * 
 * Usage Pattern:
 * 
 * 1. For simple validation (stateless):
 *    Use the validateAndResolvePath() function which creates its own validator instance.
 *    This is suitable for one-off validations that don't need to maintain state.
 * 
 * 2. For stateful validation (recommended for game mechanics):
 *    Import and use the pathValidator singleton directly.
 *    This is required when you need to:
 *    - Unlock/lock directories dynamically
 *    - Share unlocked directory state across different parts of the application
 *    - Benefit from validation result caching
 * 
 * When to use the singleton:
 * - Door/key game mechanics that unlock directories
 * - Game state management that needs to persist unlocked directories
 * - Any scenario where directory access permissions change at runtime
 * - When you need to query the current unlock state
 * 
 * When NOT to use the singleton:
 * - Simple one-off path validations
 * - When you need isolated validation state
 * - When you need different security policies per validation
 * 
 * @example
 * // Using the singleton for game mechanics
 * import { pathValidator } from './pathSecurityValidator.js';
 * 
 * // When player uses a key to unlock a door
 * const result = pathValidator.unlockDirectory('./doors/secret-room');
 * if (result.success) {
 *   console.log('Door unlocked!');
 * }
 * 
 * // Later, when accessing files in that directory
 * const validation = pathValidator.validatePath(
 *   './doors/secret-room/treasure.txt',
 *   process.cwd(),
 *   gameDataRoot,
 *   'READ',
 *   true // use blocklist mode
 * );
 * 
 * // Check unlock status
 * if (pathValidator.isDirectoryUnlocked('./doors/secret-room')) {
 *   console.log('Secret room is accessible');
 * }
 * 
 * // List all unlocked directories
 * const unlocked = pathValidator.listUnlockedDirectories();
 * console.log('Unlocked areas:', unlocked);
 * 
 * @type {EnhancedPathSecurityValidator}
 */
export const pathValidator = defaultValidator;

/**
 * Validates and resolves a path within the game scope
 * @param {string} inputPath - The input path to validate and resolve
 * @param {string} currentDir - The current working directory
 * @param {string} gameDataRoot - The root directory for game data (defaults to project root)
 * @param {boolean} useBlocklist - If true, uses blocklist validation (allows access except to blocked directories).
 *                                  If false, uses allowlist validation (only allows access within gameDataRoot scope).
 *                                  Defaults to true for file operations, should be false for directory navigation.
 * @returns {Object} Validation result with resolved path
 */
export function validateAndResolvePath(inputPath, currentDir, gameDataRoot = null, useBlocklist = true) {
  console.debug(`[PATH_SECURITY] Validating path: "${inputPath}", currentDir: "${currentDir}", useBlocklist: ${useBlocklist}`);

  try {
    // Set default game data root to configured directory if not provided
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    
    // Use enhanced validator
    const validator = new EnhancedPathSecurityValidator({ gameDataRoot: actualGameDataRoot });
    const result = validator.validatePath(inputPath, currentDir, actualGameDataRoot, 'READ', useBlocklist);
    
    if (result.isValid) {
      return {
        isValid: true,
        resolvedPath: result.details.canonicalPath,
        error: null,
        errorCode: null,
        isWithinScope: true
      };
    } else {
      return {
        isValid: false,
        resolvedPath: '',
        error: result.error || 'Path validation failed',
        errorCode: ERROR_CODES.PATH_TRAVERSAL_ATTEMPT,
        isWithinScope: false
      };
    }

  } catch (error) {
    const completionError = new FileCompletionError(
      `Path validation failed: ${error.message}`,
      ERROR_CODES.INTERNAL_ERROR,
      { 
        inputPath, 
        currentDir, 
        gameDataRoot,
        useBlocklist,
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
 * @param {string} targetto check
 * @param {string} gameDataRoot - The root directory for game data
 * @returns {boolean} True if path is within scope, false otherwise
 */
export function isWithinGameScope(targetPath, gameDataRoot) {
  try {
    // Use enhanced validator for scope checking
    const validator = new EnhancedPathSecurityValidator({ gameDataRoot });
    const result = validator.validateScope(targetPath, gameDataRoot);
    return result.isValid;
  } catch (error) {
    console.error(`[PATH_SECURITY] Scope check failed:`, ror);
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
    const uncMatch = inputPath.match(/^\\\\([^\\\/]+)\\([^\\\/]+)/);
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
  
  // Validate path characters if it's part of a valid drive letter
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
 * Detects path traashes
 * @param {string} inputPath - The path to check
 * @returns {boolean} True if path traversal is detected
 */
export function detectPathTraversal(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }
  
  // Use enhanced validator for traversal detection
  const result = defaultValidator.detectTraversalAttempts(inputPath);
  return !result.isValid;
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
  
  // First normalize to forward slashes for consistency
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
        targetPath,
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