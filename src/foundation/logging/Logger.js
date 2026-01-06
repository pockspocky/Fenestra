/**
 * Structured Logger Implementation
 * 
 * Provides structured logging with lazy evaluation, middleware support,
 * and multiple transport destinations. Replaces the global console override
 * with a proper module-specific logging system.
 */

export class Logger {
  constructor(name, config = {}) {
    this.name = name;
    this.level = config.level || 'info';
    this.transports = config.transports || [];
    this.middleware = config.middleware || [];
    this.metadata = config.metadata || {};
  }

  /**
   * Log a message with structured metadata
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string|Function} message - Message or lazy message function
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    if (!this._shouldLog(level)) {
      return;
    }

    // Lazy evaluation - only evaluate expensive operations if we're actually logging
    const resolvedMessage = typeof message === 'function' ? message() : message;
    
    const logEntry = this._createLogEntry(level, resolvedMessage, meta);
    
    // Apply middleware pipeline
    const processedEntry = this._applyMiddleware(logEntry);
    
    // Send to all transports
    this._sendToTransports(processedEntry);
  }

  /**
   * Debug level logging with lazy evaluation support
   * @param {string|Function} message - Message or lazy message function
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Info level logging with lazy evaluation support
   * @param {string|Function} message - Message or lazy message function
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Warning level logging with lazy evaluation support
   * @param {string|Function} message - Message or lazy message function
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Error level logging with lazy evaluation support
   * @param {string|Function} message - Message or lazy message function
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  /**
   * Add a transport to this logger
   * @param {Transport} transport - Transport instance
   */
  addTransport(transport) {
    this.transports.push(transport);
  }

  /**
   * Add middleware to this logger
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Update logger configuration
   * @param {Object} config - New configuration
   */
  configure(config) {
    if (config.level) this.level = config.level;
    if (config.transports) this.transports = config.transports;
    if (config.middleware) this.middleware = config.middleware;
    if (config.metadata) this.metadata = { ...this.metadata, ...config.metadata };
  }

  /**
   * Check if we should log at the given level
   * @private
   */
  _shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error', 'none'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex && this.level !== 'none';
  }

  /**
   * Create a structured log entry
   * @private
   */
  _createLogEntry(level, message, meta) {
    return {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      meta: { ...this.metadata, ...meta },
      pid: process.pid,
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * Apply middleware pipeline to log entry
   * @private
   */
  _applyMiddleware(logEntry) {
    return this.middleware.reduce((entry, middleware) => {
      try {
        return middleware(entry) || entry;
      } catch (error) {
        // Middleware errors should not break logging
        console.error('[LOGGER] Middleware error:', error);
        return entry;
      }
    }, logEntry);
  }

  /**
   * Send log entry to all configured transports
   * @private
   */
  _sendToTransports(logEntry) {
    for (const transport of this.transports) {
      try {
        if (transport.shouldLog && !transport.shouldLog(logEntry)) {
          continue;
        }
        transport.log(logEntry);
      } catch (error) {
        // Transport errors should not break logging - use fallback
        this._fallbackLog(logEntry, error);
      }
    }
  }

  /**
   * Fallback logging when transports fail
   * @private
   */
  _fallbackLog(logEntry, transportError) {
    try {
      console.error('[LOGGER] Transport failed, using fallback:', {
        originalEntry: logEntry,
        transportError: transportError.message
      });
    } catch (fallbackError) {
      // If even fallback fails, there's nothing more we can do
      // This prevents infinite error loops
    }
  }
}