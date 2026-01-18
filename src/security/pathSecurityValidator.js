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
 */
export class EnhancedPathSecurityValidator {
  constructor(options = {}) {
    this.gameDataRoot = options.gameDataRoot || getGameDataDirectory();
    this.securityPolicies = { ...SECURITY_POLICIES, ...options.policies };
    this.auditEnabled = options.auditEnabled !== false;
    this.cache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 1000;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    
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
   * @returns {Object} Comprehensive validation result
   */
  validatePath(inputPath, baseDir = null, allowedScope = null, operation = 'READ') {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `${inputPath}|${baseDir}|${allowedScope}|${operation}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        console.debug('[PATH_SECURITY] Cache hit for path validation', { inputPath, operation });
        return cached;
      }

      console.debug('[PATH_SECURITY] Starting enhanced path validation', {
        inputPath,
        baseDir,
        allowedScope,
        operation
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
      const scopeValidation = this.validateScope(canonicalPath, allowedScope || this.gameDataRoot);
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
        validationTime: Date.now() - startTime
      });

      // Cache successful validation
      this.setCachedResult(cacheKey, result);

      if (this.auditEnabled && this.securityPolicies[operation]?.logAccess) {
        this.logSecurityEvent('PATH_ACCESS_GRANTED', inputPath, {
          canonicalPath,
          operation,
          validationTime: result.details.validationTime
        });
      }

      console.debug('[PATH_SECURITY] Path validation successful', {
        inputPath,
        canonicalPath,
        operation,
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

  validateScope(canonicalPath, allowedScope) {
    try {
      const isWithin = isPathWithinScope(canonicalPath, allowedScope);
      
      if (!isWithin) {
        return {
          isValid: false,
          error: 'Path outside allowed scope',
          details: {
            canonicalPath,
            allowedScope,
            severity: ERROR_SEVERITY.HIGH
          }
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Scope validation failed',
        details: {
          canonicalPath,
          allowedScope,
          error: error.message,
          severity: ERROR_SEVERITY.MEDIUM
        }
      };
    }
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
 * Validates and resolves a path within the game scope
 * @param {string} inputPath - The input path to validate and resolve
 * @paring directory
 * @param {string} gameDataRoot - The root directory for game data (defaults to project root)
 * @returns {Object} Validation result with resolved path
 */
export function validateAndResolvePath(inputPath, currentDir, gameDataRoot = null) {
  console.debug(`[PATH_SECURITY] Validating path: "${inputPath}", currentDir: "${currentDir}"`);

  try {
    // Set default game data root to configured directory if not provided
    const actualGameDataRoot = gameDataRoot || getGameDataDirectory();
    
    // Use enhanced validator
    const validator = new EnhancedPathSecurityValidator({ gameDataRoot: actualGameDataRoot });
    const result = validator.validatePath(inputPath, currentDir, actualGameDataRoot, 'READ');
    
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