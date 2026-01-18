import '../../logger.js';
import path from 'node:path';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  ERROR_SEVERITY,
  logError 
} from '../utils/errorHandler.js';
import { EnhancedPathSecurityValidator } from './pathSecurityValidator.js';
import { getGameDataDirectory } from '../core/config.js';
import { securityAuditSystem, SECURITY_EVENT_TYPES, SEVERITY_LEVELS } from './auditSystem.js';

/**
 * IPC Security Manager
 * 
 * Provides comprehensive security for Inter-Process Communication (IPC) between
 * main and renderer processes. Implements schema-based validation, adaptive rate
 * limiting, input sanitization, and anomaly detection for suspicious IPC activity.
 * 
 * Features:
 * - Schema-based message validation
 * - Adaptive rate limiting per channel and client
 * - Comprehensive input sanitization
 * - Anomaly detection for suspicious patterns
 * - Security event logging and monitoring
 */

// IPC Security Configuration
const IPC_SECURITY_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    DEFAULT: { requests: 10, windowMs: 60000 }, // 10 requests per minute (more restrictive)
    'game/window/create': { requests: 5, windowMs: 60000 },
    'game/window/close': { requests: 10, windowMs: 60000 },
    'game/file/read': { requests: 8, windowMs: 60000 },
    'game/file/write': { requests: 6, windowMs: 60000 },
    'game/terminal/execute': { requests: 8, windowMs: 60000 }
  },
  
  // Input validation patterns
  BLOCKED_PATTERNS: [
    /\.\./,                    // Path traversal
    /<script[^>]*>/i,          // Script injection
    /javascript:/i,            // JavaScript protocol
    /data:/i,                  // Data protocol
    /vbscript:/i,              // VBScript protocol
    /on\w+\s*=/i,             // Event handlers
    /eval\s*\(/i,             // Eval function
    /Function\s*\(/i,         // Function constructor
    /setTimeout\s*\(/i,       // setTimeout
    /setInterval\s*\(/i,      // setInterval
    /\$\{.*\}/,               // Template literals
    /`.*`/,                   // Backticks
    /\x00/,                   // Null bytes
    /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/ // Control characters
  ],
  
  // Maximum payload sizes
  MAX_PAYLOAD_SIZE: 1024 * 1024, // 1MB
  MAX_STRING_LENGTH: 10000,
  MAX_ARRAY_LENGTH: 1000,
  MAX_OBJECT_DEPTH: 10,
  
  // Anomaly detection thresholds
  ANOMALY_THRESHOLDS: {
    RAPID_REQUESTS: 50,        // Requests in 10 seconds
    LARGE_PAYLOADS: 5,         // Large payloads in 1 minute
    VALIDATION_FAILURES: 10,   // Validation failures in 5 minutes
    SUSPICIOUS_PATTERNS: 3     // Suspicious patterns in 1 minute
  }
};

// IPC Message Schemas
const IPC_SCHEMAS = {
  'game/window/create': {
    type: 'object',
    required: ['id', 'options'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 100 },
      options: {
        type: 'object',
        properties: {
          width: { type: 'number', minimum: 100, maximum: 4000 },
          height: { type: 'number', minimum: 100, maximum: 3000 },
          title: { type: 'string', maxLength: 200 },
          x: { type: 'number' },
          y: { type: 'number' },
          resizable: { type: 'boolean' },
          transparent: { type: 'boolean' }
        }
      }
    }
  },
  
  'game/file/read': {
    type: 'object',
    required: ['filePath'],
    properties: {
      filePath: { type: 'string', minLength: 1, maxLength: 500 },
      encoding: { type: 'string', enum: ['utf8', 'base64', 'binary'] }
    }
  },
  
  'game/file/write': {
    type: 'object',
    required: ['filePath', 'content'],
    properties: {
      filePath: { type: 'string', minLength: 1, maxLength: 500 },
      content: { type: 'string', maxLength: 100000 },
      encoding: { type: 'string', enum: ['utf8', 'base64'] }
    }
  },
  
  'game/terminal/execute': {
    type: 'object',
    required: ['command'],
    properties: {
      command: { type: 'string', minLength: 1, maxLength: 200 },
      args: {
        type: 'array',
        maxItems: 10,
        items: { type: 'string', maxLength: 100 }
      }
    }
  },
  
  // Start menu handlers - these don't require payloads
  'start-menu/new-game': {
    type: 'object',
    properties: {}  // Empty object or no payload is valid
  },
  
  'start-menu/continue-game': {
    type: 'object',
    properties: {}  // Empty object or no payload is valid
  },
  
  'start-menu/check-save-exists': {
    type: 'object',
    properties: {}  // Empty object or no payload is valid
  },
  
  'start-menu/get-save-metadata': {
    type: 'object',
    properties: {}  // Empty object or no payload is valid
  }
};

/**
 * IPC Security Manager Class
 * Provides comprehensive security for IPC communications
 */
export class IPCSecurityManager {
  constructor(options = {}) {
    this.pathValidator = new EnhancedPathSecurityValidator({
      gameDataRoot: options.gameDataRoot || getGameDataDirectory()
    });
    
    // Rate limiting storage
    this.rateLimits = new Map();
    
    // Anomaly detection storage
    this.anomalyTracking = new Map();
    
    // Security event storage
    this.securityEvents = [];
    this.maxSecurityEvents = options.maxSecurityEvents || 1000;
    
    // Configuration
    this.auditEnabled = options.auditEnabled !== false;
    this.strictMode = options.strictMode !== false;
    
    console.debug('[IPC_SECURITY] IPC Security Manager initialized', {
      auditEnabled: this.auditEnabled,
      strictMode: this.strictMode,
      maxSecurityEvents: this.maxSecurityEvents
    });
  }

  /**
   * Validates an IPC message with comprehensive security checks
   * @param {string} channel - IPC channel name
   * @param {*} payload - Message payload
   * @param {string} clientId - Client identifier (webContents ID)
   * @returns {Object} Validation result
   */
  validateMessage(channel, payload, clientId = 'unknown') {
    const startTime = Date.now();
    
    try {
      console.log('[IPC_SECURITY] [DEBUG] Starting validation', {
        channel,
        clientId,
        payload,
        payloadType: typeof payload
      });

      // Layer 1: Rate limiting check
      console.log('[IPC_SECURITY] [DEBUG] Layer 1: Rate limiting check');
      const rateLimitResult = this.checkRateLimit(channel, clientId);
      console.log('[IPC_SECURITY] [DEBUG] Rate limit result:', rateLimitResult);
      if (!rateLimitResult.allowed) {
        console.log('[IPC_SECURITY] [DEBUG] Rate limit FAILED');
        this.logSecurityViolation('RATE_LIMIT_EXCEEDED', channel, {
          clientId,
          limit: rateLimitResult.limit,
          current: rateLimitResult.current,
          resetTime: rateLimitResult.resetTime
        });
        
        return this.createSecurityResult(false, 'Rate limit exceeded', {
          code: 'IPC_RATE_LIMIT',
          retryAfter: rateLimitResult.retryAfter
        });
      }
      console.log('[IPC_SECURITY] [DEBUG] Rate limit PASSED');

      // Layer 2: Payload size validation
      console.log('[IPC_SECURITY] [DEBUG] Layer 2: Payload size validation');
      const sizeValidation = this.validatePayloadSize(payload);
      console.log('[IPC_SECURITY] [DEBUG] Size validation result:', sizeValidation);
      if (!sizeValidation.isValid) {
        console.log('[IPC_SECURITY] [DEBUG] Size validation FAILED');
        this.logSecurityViolation('PAYLOAD_TOO_LARGE', channel, {
          clientId,
          size: sizeValidation.size,
          maxSize: IPC_SECURITY_CONFIG.MAX_PAYLOAD_SIZE
        });
        
        return this.createSecurityResult(false, sizeValidation.error, {
          code: 'IPC_PAYLOAD_SIZE'
        });
      }
      console.log('[IPC_SECURITY] [DEBUG] Size validation PASSED');

      // Layer 3: Schema validation
      console.log('[IPC_SECURITY] [DEBUG] Layer 3: Schema validation');
      const schemaValidation = this.validateSchema(channel, payload);
      console.log('[IPC_SECURITY] [DEBUG] Schema validation result:', schemaValidation);
      if (!schemaValidation.isValid) {
        console.log('[IPC_SECURITY] [DEBUG] Schema validation FAILED');
        this.logSecurityViolation('SCHEMA_VALIDATION_FAILED', channel, {
          clientId,
          errors: schemaValidation.errors
        });
        
        return this.createSecurityResult(false, schemaValidation.error, {
          code: 'IPC_SCHEMA_INVALID',
          details: schemaValidation.errors
        });
      }
      console.log('[IPC_SECURITY] [DEBUG] Schema validation PASSED');

      // Layer 4: Input sanitization
      console.log('[IPC_SECURITY] [DEBUG] Layer 4: Input sanitization');
      const sanitizedPayload = this.sanitizePayload(payload);
      const sanitizationChanges = this.detectSanitizationChanges(payload, sanitizedPayload);
      console.log('[IPC_SECURITY] [DEBUG] Sanitization changes:', sanitizationChanges);
      
      if (sanitizationChanges.length > 0) {
        console.log('[IPC_SECURITY] [DEBUG] Sanitization detected changes');
        this.logSecurityViolation('MALICIOUS_INPUT_DETECTED', channel, {
          clientId,
          changes: sanitizationChanges
        });
        
        if (this.strictMode) {
          console.log('[IPC_SECURITY] [DEBUG] Strict mode - REJECTING due to sanitization changes');
          return this.createSecurityResult(false, 'Malicious input detected', {
            code: 'IPC_MALICIOUS_INPUT',
            changes: sanitizationChanges
          });
        }
      }
      console.log('[IPC_SECURITY] [DEBUG] Sanitization PASSED');

      // Layer 5: Path validation for file operations
      console.log('[IPC_SECURITY] [DEBUG] Layer 5: Path validation check');
      if (this.isFileOperation(channel)) {
        console.log('[IPC_SECURITY] [DEBUG] Is file operation - validating paths');
        const pathValidation = this.validateFilePaths(sanitizedPayload);
        console.log('[IPC_SECURITY] [DEBUG] Path validation result:', pathValidation);
        if (!pathValidation.isValid) {
          console.log('[IPC_SECURITY] [DEBUG] Path validation FAILED');
          this.logSecurityViolation('INVALID_FILE_PATH', channel, {
            clientId,
            paths: pathValidation.invalidPaths,
            errors: pathValidation.errors
          });
          
          return this.createSecurityResult(false, pathValidation.error, {
            code: 'IPC_INVALID_PATH'
          });
        }
      } else {
        console.log('[IPC_SECURITY] [DEBUG] Not a file operation - skipping path validation');
      }
      console.log('[IPC_SECURITY] [DEBUG] Path validation PASSED');

      // Layer 6: Anomaly detection
      console.log('[IPC_SECURITY] [DEBUG] Layer 6: Anomaly detection');
      this.updateAnomalyTracking(channel, clientId, payload);
      const anomalyResult = this.detectSuspiciousActivity(channel, clientId);
      console.log('[IPC_SECURITY] [DEBUG] Anomaly detection result:', anomalyResult);
      
      if (anomalyResult.suspicious) {
        console.log('[IPC_SECURITY] [DEBUG] Suspicious activity detected');
        this.logSecurityViolation('SUSPICIOUS_ACTIVITY', channel, {
          clientId,
          anomalies: anomalyResult.anomalies,
          riskScore: anomalyResult.riskScore
        });
        
        if (anomalyResult.riskScore >= 0.8) {
          console.log('[IPC_SECURITY] [DEBUG] High risk score - REJECTING');
          return this.createSecurityResult(false, 'Suspicious activity detected', {
            code: 'IPC_SUSPICIOUS_ACTIVITY',
            riskScore: anomalyResult.riskScore
          });
        }
      }
      console.log('[IPC_SECURITY] [DEBUG] Anomaly detection PASSED');

      // Update rate limit counter
      console.log('[IPC_SECURITY] [DEBUG] Updating rate limit counter');
      this.updateRateLimit(channel, clientId);

      const validationTime = Date.now() - startTime;
      
      console.log('[IPC_SECURITY] [DEBUG] ALL VALIDATION PASSED - SUCCESS', {
        channel,
        clientId,
        validationTime,
        sanitizationChanges: sanitizationChanges.length
      });

      const result = this.createSecurityResult(true, null, {
        sanitizedPayload,
        validationTime,
        sanitizationChanges
      });
      
      console.log('[IPC_SECURITY] [DEBUG] Returning success result:', result);
      return result;

    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      console.log('[IPC_SECURITY] [DEBUG] EXCEPTION CAUGHT', {
        channel,
        clientId,
        error: error.message,
        stack: error.stack
      });
      
      this.logSecurityViolation('VALIDATION_ERROR', channel, {
        clientId,
        error: error.message,
        validationTime
      });

      const result = this.createSecurityResult(false, `Validation failed: ${error.message}`, {
        code: 'IPC_VALIDATION_ERROR',
        validationTime
      });
      
      console.log('[IPC_SECURITY] [DEBUG] Returning error result:', result);
      return result;
    }
  }

  /**
   * Checks rate limits for a specific channel and client
   * @param {string} channel - IPC channel name
   * @param {string} clientId - Client identifier
   * @returns {Object} Rate limit check result
   */
  checkRateLimit(channel, clientId) {
    const key = `${channel}:${clientId}`;
    const now = Date.now();
    
    // Get rate limit configuration for this channel
    const config = IPC_SECURITY_CONFIG.RATE_LIMITS[channel] || 
                   IPC_SECURITY_CONFIG.RATE_LIMITS.DEFAULT;
    
    let rateLimitData = this.rateLimits.get(key);
    
    if (!rateLimitData) {
      rateLimitData = {
        requests: [],
        violations: []
      };
      this.rateLimits.set(key, rateLimitData);
    }
    
    // Clean old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => now - timestamp < config.windowMs
    );
    
    // Clean old violations outside the window
    rateLimitData.violations = rateLimitData.violations.filter(
      timestamp => now - timestamp < config.windowMs
    );
    
    // Check if limit is exceeded
    if (rateLimitData.requests.length >= config.requests) {
      const oldestRequest = Math.min(...rateLimitData.requests);
      const retryAfter = config.windowMs - (now - oldestRequest);
      
      // Record violation
      rateLimitData.violations.push(now);
      
      return {
        allowed: false,
        limit: config.requests,
        current: rateLimitData.requests.length,
        resetTime: oldestRequest + config.windowMs,
        retryAfter: Math.max(0, retryAfter)
      };
    }
    
    return {
      allowed: true,
      limit: config.requests,
      current: rateLimitData.requests.length,
      remaining: config.requests - rateLimitData.requests.length
    };
  }

  /**
   * Updates rate limit counter after successful validation
   * @param {string} channel - IPC channel name
   * @param {string} clientId - Client identifier
   */
  updateRateLimit(channel, clientId) {
    const key = `${channel}:${clientId}`;
    const now = Date.now();
    
    let rateLimitData = this.rateLimits.get(key);
    if (!rateLimitData) {
      rateLimitData = {
        requests: [],
        violations: []
      };
      this.rateLimits.set(key, rateLimitData);
    }
    
    rateLimitData.requests.push(now);
  }

  /**
   * Validates payload size to prevent memory exhaustion
   * @param {*} payload - Payload to validate
   * @returns {Object} Size validation result
   */
  validatePayloadSize(payload) {
    try {
      // Handle undefined/null payloads
      if (payload === undefined || payload === null) {
        return { isValid: true, size: 0 };
      }
      
      const serialized = JSON.stringify(payload);
      const size = Buffer.byteLength(serialized, 'utf8');
      
      if (size > IPC_SECURITY_CONFIG.MAX_PAYLOAD_SIZE) {
        return {
          isValid: false,
          error: `Payload too large: ${size} bytes exceeds ${IPC_SECURITY_CONFIG.MAX_PAYLOAD_SIZE} bytes`,
          size,
          maxSize: IPC_SECURITY_CONFIG.MAX_PAYLOAD_SIZE
        };
      }
      
      return { isValid: true, size };
    } catch (error) {
      return {
        isValid: false,
        error: `Payload serialization failed: ${error.message}`,
        size: 0
      };
    }
  }

  /**
   * Validates payload against registered schema
   * @param {string} channel - IPC channel name
   * @param {*} payload - Payload to validate
   * @returns {Object} Schema validation result
   */
  validateSchema(channel, payload) {
    const schema = IPC_SCHEMAS[channel];
    
    if (!schema) {
      // No schema defined - allow but log
      console.debug('[IPC_SECURITY] No schema defined for channel', { channel });
      return { isValid: true };
    }
    
    // Handle undefined/null payloads for schemas that allow empty objects
    if ((payload === undefined || payload === null) && schema.type === 'object') {
      // If schema has no required properties, treat undefined as empty object
      if (!schema.required || schema.required.length === 0) {
        console.debug('[IPC_SECURITY] Treating undefined payload as empty object for channel', { channel });
        return { isValid: true };
      }
    }
    
    // Convert undefined to empty object for validation if schema expects object
    const payloadToValidate = (payload === undefined && schema.type === 'object') ? {} : payload;
    
    try {
      const validation = this.validateAgainstSchema(payloadToValidate, schema);
      
      if (!validation.isValid) {
        return {
          isValid: false,
          error: `Schema validation failed: ${validation.errors.join(', ')}`,
          errors: validation.errors
        };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Schema validation error: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  /**
   * Sanitizes payload to remove malicious content
   * @param {*} payload - Payload to sanitize
   * @returns {*} Sanitized payload
   */
  sanitizePayload(payload) {
    if (payload === null || payload === undefined) {
      return payload;
    }
    
    if (typeof payload === 'string') {
      return this.sanitizeString(payload);
    }
    
    if (Array.isArray(payload)) {
      return payload.map(item => this.sanitizePayload(item));
    }
    
    if (typeof payload === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(payload)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizePayload(value);
      }
      return sanitized;
    }
    
    return payload;
  }

  /**
   * Sanitizes string content
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    let sanitized = str;
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove or escape dangerous patterns
    for (const pattern of IPC_SECURITY_CONFIG.BLOCKED_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
    
    // Limit string length
    if (sanitized.length > IPC_SECURITY_CONFIG.MAX_STRING_LENGTH) {
      sanitized = sanitized.substring(0, IPC_SECURITY_CONFIG.MAX_STRING_LENGTH);
    }
    
    return sanitized;
  }

  /**
   * Detects changes made during sanitization
   * @param {*} original - Original payload
   * @param {*} sanitized - Sanitized payload
   * @returns {Array} Array of detected changes
   */
  detectSanitizationChanges(original, sanitized) {
    const changes = [];
    
    try {
      const originalStr = JSON.stringify(original);
      const sanitizedStr = JSON.stringify(sanitized);
      
      if (originalStr !== sanitizedStr) {
        // Detect specific types of changes
        for (const pattern of IPC_SECURITY_CONFIG.BLOCKED_PATTERNS) {
          if (pattern.test(originalStr)) {
            changes.push(`Blocked pattern detected: ${pattern.source}`);
          }
        }
        
        if (originalStr.length !== sanitizedStr.length) {
          changes.push(`Length changed: ${originalStr.length} -> ${sanitizedStr.length}`);
        }
      }
    } catch (error) {
      changes.push(`Comparison failed: ${error.message}`);
    }
    
    return changes;
  }

  /**
   * Validates file paths in payload for file operations
   * @param {*} payload - Payload containing file paths
   * @returns {Object} Path validation result
   */
  validateFilePaths(payload) {
    const invalidPaths = [];
    const errors = [];
    
    try {
      this.extractAndValidatePaths(payload, invalidPaths, errors);
      
      if (invalidPaths.length > 0) {
        return {
          isValid: false,
          error: `Invalid file paths detected: ${invalidPaths.join(', ')}`,
          invalidPaths,
          errors
        };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Path validation failed: ${error.message}`,
        invalidPaths: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Recursively extracts and validates paths from payload
   * @param {*} obj - Object to search for paths
   * @param {Array} invalidPaths - Array to collect invalid paths
   * @param {Array} errors - Array to collect errors
   */
  extractAndValidatePaths(obj, invalidPaths, errors) {
    if (typeof obj === 'string' && this.looksLikePath(obj)) {
      // Check if path is within renderer directory (application assets)
      const rendererDir = path.join(process.cwd(), 'renderer');
      const resolvedPath = path.resolve(obj);
      const resolvedRendererDir = path.resolve(rendererDir);
      
      // Allow paths within renderer directory (application assets)
      if (resolvedPath.startsWith(resolvedRendererDir)) {
        // Renderer paths are allowed - they're part of the application
        return;
      }
      
      // For non-renderer paths, validate against game data directory
      const validation = this.pathValidator.validatePath(obj, null, null, 'READ');
      if (!validation.isValid) {
        invalidPaths.push(obj);
        errors.push(validation.error);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractAndValidatePaths(item, invalidPaths, errors);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        // Check if key suggests this is a path
        if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
          this.extractAndValidatePaths(value, invalidPaths, errors);
        } else {
          this.extractAndValidatePaths(value, invalidPaths, errors);
        }
      }
    }
  }

  /**
   * Determines if a string looks like a file path
   * @param {string} str - String to check
   * @returns {boolean} True if string looks like a path
   */
  looksLikePath(str) {
    if (typeof str !== 'string' || str.length < 2) {
      return false;
    }
    
    // Check for common path patterns
    return /[\/\\]/.test(str) || 
           /^[a-zA-Z]:/.test(str) || 
           str.startsWith('./') || 
           str.startsWith('../') ||
           str.startsWith('~');
  }

  /**
   * Checks if channel is a file operation
   * @param {string} channel - IPC channel name
   * @returns {boolean} True if channel involves file operations
   */
  isFileOperation(channel) {
    const fileChannels = [
      'game/file/read',
      'game/file/write',
      'game/file/delete',
      'game/directory/list',
      'game/window/save',
      'game/window/load'
    ];
    
    return fileChannels.includes(channel) || 
           channel.includes('file') || 
           channel.includes('save') || 
           channel.includes('load');
  }

  /**
   * Updates anomaly tracking for suspicious activity detection
   * @param {string} channel - IPC channel name
   * @param {string} clientId - Client identifier
   * @param {*} payload - Message payload
   */
  updateAnomalyTracking(channel, clientId, payload) {
    const key = `${channel}:${clientId}`;
    const now = Date.now();
    
    let tracking = this.anomalyTracking.get(key);
    if (!tracking) {
      tracking = {
        requestTimes: [],
        payloadSizes: [],
        validationFailures: [],
        suspiciousPatterns: []
      };
      this.anomalyTracking.set(key, tracking);
    }
    
    // Track request timing
    tracking.requestTimes.push(now);
    
    // Track payload size
    try {
      const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      tracking.payloadSizes.push({ timestamp: now, size });
    } catch (error) {
      // Ignore serialization errors
    }
    
    // Clean old data (keep last 10 minutes)
    const tenMinutesAgo = now - 600000;
    tracking.requestTimes = tracking.requestTimes.filter(t => t > tenMinutesAgo);
    tracking.payloadSizes = tracking.payloadSizes.filter(p => p.timestamp > tenMinutesAgo);
    tracking.validationFailures = tracking.validationFailures.filter(f => f.timestamp > tenMinutesAgo);
    tracking.suspiciousPatterns = tracking.suspiciousPatterns.filter(p => p.timestamp > tenMinutesAgo);
  }

  /**
   * Detects suspicious activity patterns
   * @param {string} channel - IPC channel name
   * @param {string} clientId - Client identifier
   * @returns {Object} Anomaly detection result
   */
  detectSuspiciousActivity(channel, clientId) {
    const key = `${channel}:${clientId}`;
    const tracking = this.anomalyTracking.get(key);
    
    if (!tracking) {
      return { suspicious: false, anomalies: [], riskScore: 0 };
    }
    
    const now = Date.now();
    const anomalies = [];
    let riskScore = 0;
    
    // Check for rapid requests (last 10 seconds)
    const recentRequests = tracking.requestTimes.filter(t => now - t < 10000);
    if (recentRequests.length > IPC_SECURITY_CONFIG.ANOMALY_THRESHOLDS.RAPID_REQUESTS) {
      anomalies.push('Rapid request pattern detected');
      riskScore += 0.3;
    }
    
    // Check for large payloads (last 1 minute)
    const recentLargePayloads = tracking.payloadSizes.filter(
      p => now - p.timestamp < 60000 && p.size > IPC_SECURITY_CONFIG.MAX_PAYLOAD_SIZE * 0.8
    );
    if (recentLargePayloads.length > IPC_SECURITY_CONFIG.ANOMALY_THRESHOLDS.LARGE_PAYLOADS) {
      anomalies.push('Large payload pattern detected');
      riskScore += 0.2;
    }
    
    // Check for validation failures (last 5 minutes)
    const recentFailures = tracking.validationFailures.filter(f => now - f.timestamp < 300000);
    if (recentFailures.length > IPC_SECURITY_CONFIG.ANOMALY_THRESHOLDS.VALIDATION_FAILURES) {
      anomalies.push('High validation failure rate');
      riskScore += 0.4;
    }
    
    // Check for suspicious patterns (last 1 minute)
    const recentPatterns = tracking.suspiciousPatterns.filter(p => now - p.timestamp < 60000);
    if (recentPatterns.length > IPC_SECURITY_CONFIG.ANOMALY_THRESHOLDS.SUSPICIOUS_PATTERNS) {
      anomalies.push('Suspicious input patterns detected');
      riskScore += 0.5;
    }
    
    return {
      suspicious: anomalies.length > 0,
      anomalies,
      riskScore: Math.min(riskScore, 1.0)
    };
  }

  /**
   * Validates object against JSON schema
   * @param {*} obj - Object to validate
   * @param {Object} schema - JSON schema
   * @returns {Object} Validation result
   */
  validateAgainstSchema(obj, schema) {
    const errors = [];
    
    try {
      this.validateSchemaRecursive(obj, schema, '', errors);
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Schema validation error: ${error.message}`]
      };
    }
  }

  /**
   * Recursively validates object against schema
   * @param {*} obj - Object to validate
   * @param {Object} schema - Schema to validate against
   * @param {string} path - Current path in object
   * @param {Array} errors - Array to collect errors
   */
  validateSchemaRecursive(obj, schema, path, errors) {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(obj) ? 'array' : typeof obj;
      if (actualType !== schema.type) {
        errors.push(`${path}: Expected ${schema.type}, got ${actualType}`);
        return;
      }
    }
    
    // Required properties validation
    if (schema.required && typeof obj === 'object' && obj !== null) {
      for (const required of schema.required) {
        if (!(required in obj)) {
          errors.push(`${path}: Missing required property '${required}'`);
        }
      }
    }
    
    // Properties validation
    if (schema.properties && typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          this.validateSchemaRecursive(value, propSchema, `${path}.${key}`, errors);
        }
      }
    }
    
    // String validations
    if (typeof obj === 'string') {
      if (schema.minLength && obj.length < schema.minLength) {
        errors.push(`${path}: String too short (${obj.length} < ${schema.minLength})`);
      }
      if (schema.maxLength && obj.length > schema.maxLength) {
        errors.push(`${path}: String too long (${obj.length} > ${schema.maxLength})`);
      }
      if (schema.enum && !schema.enum.includes(obj)) {
        errors.push(`${path}: Value not in enum: ${obj}`);
      }
    }
    
    // Number validations
    if (typeof obj === 'number') {
      if (schema.minimum !== undefined && obj < schema.minimum) {
        errors.push(`${path}: Number too small (${obj} < ${schema.minimum})`);
      }
      if (schema.maximum !== undefined && obj > schema.maximum) {
        errors.push(`${path}: Number too large (${obj} > ${schema.maximum})`);
      }
    }
    
    // Array validations
    if (Array.isArray(obj)) {
      if (schema.maxItems && obj.length > schema.maxItems) {
        errors.push(`${path}: Array too long (${obj.length} > ${schema.maxItems})`);
      }
      if (schema.items) {
        obj.forEach((item, index) => {
          this.validateSchemaRecursive(item, schema.items, `${path}[${index}]`, errors);
        });
      }
    }
  }

  /**
   * Logs security violations for audit purposes
   * @param {string} violationType - Type of security violation
   * @param {string} channel - IPC channel where violation occurred
   * @param {Object} details - Additional violation details
   */
  logSecurityViolation(violationType, channel, details) {
    if (!this.auditEnabled) return;

    const violation = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: violationType,
      channel,
      severity: this.getViolationSeverity(violationType),
      details,
      source: 'IPCSecurityManager'
    };

    // Add to security events
    this.securityEvents.push(violation);
    
    // Maintain event limit
    if (this.securityEvents.length > this.maxSecurityEvents) {
      this.securityEvents.shift();
    }

    // Log to audit system
    try {
      const auditEventType = this.mapViolationToAuditEventType(violationType);
      const auditSeverity = this.mapSeverityToAuditSeverity(violation.severity);
      
      securityAuditSystem.logSecurityEvent(auditEventType, auditSeverity, {
        component: 'IPCSecurityManager',
        function: 'validateMessage',
        ipcChannel: channel,
        violationType,
        mitigationAction: 'message_rejected',
        inputData: details.payload ? JSON.stringify(details.payload).substring(0, 200) : 'N/A',
        ...details
      }, {
        clientId: details.clientId,
        sessionId: details.sessionId
      });
    } catch (auditError) {
      console.error('[IPC_SECURITY] Failed to log to audit system', {
        violationType,
        channel,
        error: auditError.message
      });
    }

    // Log with appropriate level
    const logLevel = violation.severity === 'critical' ? 'error' : 
                    violation.severity === 'high' ? 'warn' : 'debug';
    
    console[logLevel](`[IPC_SECURITY] Security violation: ${violationType}`, {
      channel,
      details,
      violationId: violation.id
    });

    // Create and log error for critical violations
    if (violation.severity === 'critical' || violation.severity === 'high') {
      const error = new FileCompletionError(
        `IPC Security violation: ${violationType}`,
        ERROR_CODES.ACCESS_DENIED,
        {
          violationType,
          channel,
          severity: violation.severity,
          ...details
        }
      );
      
      logError(error, { 
        component: 'IPCSecurityManager',
        violationType,
        channel
      });
    }
  }

  /**
   * Determines severity level for violation type
   * @param {string} violationType - Type of violation
   * @returns {string} Severity level
   */
  getViolationSeverity(violationType) {
    const severityMap = {
      'RATE_LIMIT_EXCEEDED': 'medium',
      'PAYLOAD_TOO_LARGE': 'medium',
      'SCHEMA_VALIDATION_FAILED': 'medium',
      'MALICIOUS_INPUT_DETECTED': 'high',
      'INVALID_FILE_PATH': 'high',
      'SUSPICIOUS_ACTIVITY': 'high',
      'VALIDATION_ERROR': 'low'
    };
    
    return severityMap[violationType] || 'medium';
  }

  /**
   * Maps IPC violation type to audit system event type
   * @param {string} violationType - IPC violation type
   * @returns {string} Audit system event type
   */
  mapViolationToAuditEventType(violationType) {
    const eventTypeMap = {
      'RATE_LIMIT_EXCEEDED': SECURITY_EVENT_TYPES.RATE_LIMIT,
      'PAYLOAD_TOO_LARGE': SECURITY_EVENT_TYPES.IPC_VIOLATION,
      'SCHEMA_VALIDATION_FAILED': SECURITY_EVENT_TYPES.SCHEMA_VIOLATION,
      'MALICIOUS_INPUT_DETECTED': SECURITY_EVENT_TYPES.INJECTION_ATTEMPT,
      'INVALID_FILE_PATH': SECURITY_EVENT_TYPES.PATH_TRAVERSAL,
      'SUSPICIOUS_ACTIVITY': SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
      'VALIDATION_ERROR': SECURITY_EVENT_TYPES.IPC_VIOLATION
    };
    
    return eventTypeMap[violationType] || SECURITY_EVENT_TYPES.IPC_VIOLATION;
  }

  /**
   * Maps IPC severity to audit system severity
   * @param {string} ipcSeverity - IPC severity level
   * @returns {string} Audit system severity level
   */
  mapSeverityToAuditSeverity(ipcSeverity) {
    const severityMap = {
      'low': SEVERITY_LEVELS.LOW,
      'medium': SEVERITY_LEVELS.MEDIUM,
      'high': SEVERITY_LEVELS.HIGH,
      'critical': SEVERITY_LEVELS.CRITICAL
    };
    
    return severityMap[ipcSeverity] || SEVERITY_LEVELS.MEDIUM;
  }

  /**
   * Creates standardized security result object
   * @param {boolean} success - Whether validation succeeded
   * @param {string} error - Error message if validation failed
   * @param {Object} details - Additional result details
   * @returns {Object} Security result
   */
  createSecurityResult(success, error = null, details = {}) {
    return {
      success,
      error,
      timestamp: new Date().toISOString(),
      source: 'IPCSecurityManager',
      ...details
    };
  }

  /**
   * Registers a new IPC schema for validation
   * @param {string} channel - IPC channel name
   * @param {Object} schema - JSON schema for validation
   */
  registerSchema(channel, schema) {
    IPC_SCHEMAS[channel] = schema;
    
    console.debug('[IPC_SECURITY] Schema registered for channel', {
      channel,
      schemaType: schema.type
    });
  }

  /**
   * Gets security statistics and metrics
   * @returns {Object} Security statistics
   */
  getSecurityStats() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentEvents = this.securityEvents.filter(
      event => new Date(event.timestamp).getTime() > oneHourAgo
    );
    
    const violationCounts = {};
    recentEvents.forEach(event => {
      violationCounts[event.type] = (violationCounts[event.type] || 0) + 1;
    });
    
    return {
      totalEvents: this.securityEvents.length,
      recentEvents: recentEvents.length,
      violationCounts,
      rateLimitEntries: this.rateLimits.size,
      anomalyTrackingEntries: this.anomalyTracking.size,
      registeredSchemas: Object.keys(IPC_SCHEMAS).length
    };
  }

  /**
   * Clears security event history
   */
  clearSecurityEvents() {
    this.securityEvents.length = 0;
    console.debug('[IPC_SECURITY] Security event history cleared');
  }

  /**
   * Clears rate limit data for testing purposes
   */
  clearRateLimits() {
    this.rateLimits.clear();
    console.debug('[IPC_SECURITY] Rate limit data cleared');
  }

  /**
   * Clears anomaly tracking data
   */
  clearAnomalyTracking() {
    this.anomalyTracking.clear();
    console.debug('[IPC_SECURITY] Anomaly tracking data cleared');
  }

  /**
   * Exports security events for analysis
   * @param {Object} options - Export options
   * @returns {Array} Security events
   */
  exportSecurityEvents(options = {}) {
    const { 
      startTime, 
      endTime, 
      violationType, 
      severity,
      limit = 1000 
    } = options;
    
    let events = [...this.securityEvents];
    
    // Apply filters
    if (startTime) {
      events = events.filter(e => new Date(e.timestamp) >= new Date(startTime));
    }
    
    if (endTime) {
      events = events.filter(e => new Date(e.timestamp) <= new Date(endTime));
    }
    
    if (violationType) {
      events = events.filter(e => e.type === violationType);
    }
    
    if (severity) {
      events = events.filter(e => e.severity === severity);
    }
    
    // Apply limit
    if (limit && events.length > limit) {
      events = events.slice(-limit);
    }
    
    return events;
  }
}

// Create default instance
export const ipcSecurityManager = new IPCSecurityManager();

/**
 * Wraps an IPC handler with security validation
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Original IPC handler
 * @returns {Function} Wrapped handler with security
 */
export function secureIpcHandler(channel, handler) {
  return async (event, payload) => {
    const clientId = event.sender.id.toString();
    
    console.log('[IPC_SECURITY] [DEBUG] secureIpcHandler called', {
      channel,
      clientId,
      payload,
      payloadType: typeof payload
    });
    
    // Validate message security
    const validation = ipcSecurityManager.validateMessage(channel, payload, clientId);
    
    console.log('[IPC_SECURITY] [DEBUG] Validation result from validateMessage:', validation);
    
    if (!validation.success) {
      console.warn(`[IPC_SECURITY] Blocked insecure IPC message on ${channel}`, {
        clientId,
        error: validation.error,
        code: validation.code
      });
      
      console.log('[IPC_SECURITY] [DEBUG] Returning error response');
      
      // Return security error response
      return {
        success: false,
        error: validation.error,
        code: validation.code,
        retryAfter: validation.retryAfter
      };
    }
    
    console.log('[IPC_SECURITY] [DEBUG] Validation passed - calling original handler');
    
    try {
      // Call original handler with sanitized payload
      const result = await handler(event, validation.sanitizedPayload || payload);
      
      console.log('[IPC_SECURITY] [DEBUG] Handler completed successfully');
      
      // Log successful IPC call if audit enabled
      if (ipcSecurityManager.auditEnabled) {
        console.debug(`[IPC_SECURITY] Secure IPC call completed`, {
          channel,
          clientId,
          validationTime: validation.validationTime
        });
      }
      
      return result;
    } catch (error) {
      console.log('[IPC_SECURITY] [DEBUG] Handler threw error:', error);
      
      // Log handler errors securely (without sensitive data)
      ipcSecurityManager.logSecurityViolation('HANDLER_ERROR', channel, {
        clientId,
        error: error.message,
        code: error.code
      });
      
      throw error;
    }
  };
}