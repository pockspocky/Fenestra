/**
 * Comprehensive Error Handling System
 * 
 * Provides structured error context, recovery strategies, error aggregation,
 * and graceful degradation for critical errors throughout the application.
 */

import { getLogger } from '../logging/LoggerFactory.js';

export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableRecovery: true,
      enableAggregation: true,
      enableGracefulDegradation: true,
      maxRetries: 3,
      retryDelay: 1000,
      aggregationWindow: 5000, // 5 seconds
      ...options
    };
    
    this.logger = getLogger('error-handler');
    this.errorAggregator = new ErrorAggregator(this.options);
    this.recoveryStrategies = new Map();
    this.errorHistory = [];
    this.criticalErrorHandlers = new Set();
    
    this._setupGlobalErrorHandling();
  }

  /**
   * Setup global error handling for unhandled errors
   * @private
   */
  _setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleError(reason, {
        type: 'unhandled_rejection',
        promise,
        critical: true
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleError(error, {
        type: 'uncaught_exception',
        critical: true
      });
    });
  }

  /**
   * Handle an error with comprehensive context and recovery
   * @param {Error|string} error - The error to handle
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} Error handling result
   */
  async handleError(error, context = {}) {
    const errorContext = this._createErrorContext(error, context);
    
    // Log the error with full context
    this.logger.error('Error occurred', errorContext);
    
    // Add to error history
    this.errorHistory.push({
      ...errorContext,
      timestamp: Date.now()
    });
    
    // Aggregate similar errors
    if (this.options.enableAggregation) {
      this.errorAggregator.addError(errorContext);
    }
    
    // Attempt recovery if enabled
    let recoveryResult = null;
    if (this.options.enableRecovery) {
      recoveryResult = await this._attemptRecovery(errorContext);
    }
    
    // Handle critical errors
    if (errorContext.critical) {
      await this._handleCriticalError(errorContext, recoveryResult);
    }
    
    return {
      errorId: errorContext.errorId,
      handled: true,
      recovered: recoveryResult?.successful || false,
      recovery: recoveryResult,
      context: errorContext
    };
  }

  /**
   * Create comprehensive error context
   * @private
   */
  _createErrorContext(error, additionalContext) {
    const errorId = this._generateErrorId();
    const timestamp = Date.now();
    
    // Extract error information
    const errorInfo = this._extractErrorInfo(error);
    
    // Get operation context
    const operationContext = this._getOperationContext(additionalContext);
    
    // Get system context
    const systemContext = this._getSystemContext();
    
    // Determine if error is critical
    const critical = this._isCriticalError(error, additionalContext);
    
    return {
      errorId,
      timestamp,
      critical,
      error: errorInfo,
      operation: operationContext,
      system: systemContext,
      recovery: {
        attempted: [],
        successful: false,
        suggestions: this._generateRecoverySuggestions(error, additionalContext)
      },
      ...additionalContext
    };
  }

  /**
   * Extract error information from error object or string
   * @private
   */
  _extractErrorInfo(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
        cause: error.cause
      };
    }
    
    if (typeof error === 'string') {
      return {
        message: error,
        name: 'StringError',
        stack: new Error().stack
      };
    }
    
    return {
      message: String(error),
      name: 'UnknownError',
      stack: new Error().stack
    };
  }

  /**
   * Get operation context from additional context
   * @private
   */
  _getOperationContext(context) {
    return {
      name: context.operation || 'unknown',
      source: context.source || 'unknown',
      timestamp: context.timestamp || Date.now(),
      parameters: context.parameters || {},
      phase: context.phase || 'execution',
      retryCount: context.retryCount || 0
    };
  }

  /**
   * Get system context information
   * @private
   */
  _getSystemContext() {
    return {
      component: 'fenestra-core',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Determine if an error is critical
   * @private
   */
  _isCriticalError(error, context) {
    // Explicit critical flag
    if (context.critical === true) {
      return true;
    }
    
    // System-level errors
    if (context.type === 'uncaught_exception' || context.type === 'unhandled_rejection') {
      return true;
    }
    
    // Dependency injection failures
    if (error.message && error.message.includes('dependency')) {
      return true;
    }
    
    // Core system failures
    const criticalComponents = ['logging', 'container', 'window-manager', 'resource-manager'];
    if (context.source && criticalComponents.some(comp => context.source.includes(comp))) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate recovery suggestions based on error type
   * @private
   */
  _generateRecoverySuggestions(error, context) {
    const suggestions = [];
    
    // File system errors
    if (error.code === 'ENOENT') {
      suggestions.push('Check if the file or directory exists');
      suggestions.push('Verify file permissions');
      suggestions.push('Ensure the path is correct');
    }
    
    // Permission errors
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      suggestions.push('Check file/directory permissions');
      suggestions.push('Run with appropriate privileges');
      suggestions.push('Verify user has access to the resource');
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      suggestions.push('Check network connectivity');
      suggestions.push('Verify service is running');
      suggestions.push('Check firewall settings');
    }
    
    // Memory errors
    if (error.message && error.message.includes('memory')) {
      suggestions.push('Reduce memory usage');
      suggestions.push('Check for memory leaks');
      suggestions.push('Increase available memory');
    }
    
    // Dependency errors
    if (error.message && error.message.includes('dependency')) {
      suggestions.push('Check service registration');
      suggestions.push('Verify dependency configuration');
      suggestions.push('Check for circular dependencies');
    }
    
    return suggestions;
  }

  /**
   * Attempt error recovery using registered strategies
   * @private
   */
  async _attemptRecovery(errorContext) {
    const recoveryResult = {
      attempted: [],
      successful: false,
      strategy: null,
      error: null
    };
    
    // Find applicable recovery strategies
    const strategies = this._findRecoveryStrategies(errorContext);
    
    for (const strategy of strategies) {
      try {
        recoveryResult.attempted.push(strategy.name);
        
        this.logger.debug('Attempting error recovery', {
          errorId: errorContext.errorId,
          strategy: strategy.name
        });
        
        const result = await strategy.recover(errorContext);
        
        if (result.successful) {
          recoveryResult.successful = true;
          recoveryResult.strategy = strategy.name;
          
          this.logger.info('Error recovery successful', {
            errorId: errorContext.errorId,
            strategy: strategy.name
          });
          
          break;
        }
      } catch (recoveryError) {
        recoveryResult.error = recoveryError.message;
        
        this.logger.warn('Error recovery failed', {
          errorId: errorContext.errorId,
          strategy: strategy.name,
          recoveryError: recoveryError.message
        });
      }
    }
    
    return recoveryResult;
  }

  /**
   * Find applicable recovery strategies for an error
   * @private
   */
  _findRecoveryStrategies(errorContext) {
    const strategies = [];
    
    for (const [pattern, strategy] of this.recoveryStrategies) {
      if (this._matchesPattern(errorContext, pattern)) {
        strategies.push(strategy);
      }
    }
    
    // Sort by priority (higher priority first)
    return strategies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Check if error context matches a recovery pattern
   * @private
   */
  _matchesPattern(errorContext, pattern) {
    if (typeof pattern === 'function') {
      return pattern(errorContext);
    }
    
    if (typeof pattern === 'string') {
      return errorContext.error.message.includes(pattern) ||
             errorContext.operation.name.includes(pattern);
    }
    
    if (typeof pattern === 'object') {
      return Object.entries(pattern).every(([key, value]) => {
        const contextValue = this._getNestedValue(errorContext, key);
        return contextValue === value;
      });
    }
    
    return false;
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Handle critical errors with graceful degradation
   * @private
   */
  async _handleCriticalError(errorContext, recoveryResult) {
    this.logger.error('Critical error detected', {
      errorId: errorContext.errorId,
      recovered: recoveryResult?.successful || false
    });
    
    // Notify critical error handlers
    for (const handler of this.criticalErrorHandlers) {
      try {
        await handler(errorContext, recoveryResult);
      } catch (handlerError) {
        this.logger.error('Critical error handler failed', {
          handlerError: handlerError.message
        });
      }
    }
    
    // Implement graceful degradation if recovery failed
    if (!recoveryResult?.successful && this.options.enableGracefulDegradation) {
      await this._gracefulDegradation(errorContext);
    }
  }

  /**
   * Implement graceful degradation strategies
   * @private
   */
  async _gracefulDegradation(errorContext) {
    this.logger.warn('Implementing graceful degradation', {
      errorId: errorContext.errorId
    });
    
    // Disable non-critical features
    if (errorContext.operation.source === 'plugin-manager') {
      this.logger.info('Disabling plugin system due to critical error');
      // Plugin system would be disabled here
    }
    
    // Switch to fallback implementations
    if (errorContext.operation.source === 'resource-manager') {
      this.logger.info('Switching to fallback resource management');
      // Fallback resource management would be activated here
    }
    
    // Reduce functionality to core features only
    if (errorContext.system.memory.heapUsed > 1000000000) { // 1GB
      this.logger.info('Reducing functionality due to memory pressure');
      // Memory optimization would be implemented here
    }
  }

  /**
   * Generate unique error ID
   * @private
   */
  _generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Register a recovery strategy for specific error patterns
   * @param {string|Object|Function} pattern - Pattern to match errors
   * @param {Object} strategy - Recovery strategy with recover method
   */
  registerRecoveryStrategy(pattern, strategy) {
    if (!strategy.recover || typeof strategy.recover !== 'function') {
      throw new Error('Recovery strategy must have a recover method');
    }
    
    this.recoveryStrategies.set(pattern, {
      name: strategy.name || 'unnamed-strategy',
      priority: strategy.priority || 0,
      recover: strategy.recover
    });
  }

  /**
   * Register a critical error handler
   * @param {Function} handler - Handler function for critical errors
   */
  registerCriticalErrorHandler(handler) {
    this.criticalErrorHandlers.add(handler);
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics and aggregation data
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      criticalErrors: this.errorHistory.filter(e => e.critical).length,
      recoveredErrors: this.errorHistory.filter(e => e.recovery?.successful).length,
      recentErrors: this.errorHistory.filter(e => 
        Date.now() - e.timestamp < 300000 // Last 5 minutes
      ).length
    };
    
    if (this.options.enableAggregation) {
      stats.aggregation = this.errorAggregator.getStats();
    }
    
    return stats;
  }

  /**
   * Clear error history (useful for testing)
   */
  clearHistory() {
    this.errorHistory = [];
    if (this.errorAggregator) {
      this.errorAggregator.clear();
    }
  }
}

/**
 * Error Aggregator for detecting patterns and preventing spam
 */
class ErrorAggregator {
  constructor(options = {}) {
    this.options = options;
    this.errorGroups = new Map();
    this.aggregationWindow = options.aggregationWindow || 5000;
    
    // Clean up old aggregations periodically
    setInterval(() => this._cleanup(), this.aggregationWindow);
  }

  /**
   * Add error to aggregation tracking
   */
  addError(errorContext) {
    const groupKey = this._getGroupKey(errorContext);
    
    if (!this.errorGroups.has(groupKey)) {
      this.errorGroups.set(groupKey, {
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        examples: []
      });
    }
    
    const group = this.errorGroups.get(groupKey);
    group.count++;
    group.lastSeen = Date.now();
    
    // Keep a few examples
    if (group.examples.length < 3) {
      group.examples.push({
        errorId: errorContext.errorId,
        timestamp: errorContext.timestamp
      });
    }
  }

  /**
   * Generate group key for similar errors
   * @private
   */
  _getGroupKey(errorContext) {
    return `${errorContext.error.name}:${errorContext.operation.source}:${errorContext.error.message.substring(0, 50)}`;
  }

  /**
   * Clean up old error groups
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.aggregationWindow;
    
    for (const [key, group] of this.errorGroups) {
      if (group.lastSeen < cutoff) {
        this.errorGroups.delete(key);
      }
    }
  }

  /**
   * Get aggregation statistics
   */
  getStats() {
    const stats = {
      totalGroups: this.errorGroups.size,
      groups: []
    };
    
    for (const [key, group] of this.errorGroups) {
      stats.groups.push({
        key,
        count: group.count,
        duration: group.lastSeen - group.firstSeen,
        examples: group.examples
      });
    }
    
    // Sort by count (most frequent first)
    stats.groups.sort((a, b) => b.count - a.count);
    
    return stats;
  }

  /**
   * Clear aggregation data
   */
  clear() {
    this.errorGroups.clear();
  }
}

// Create and export default error handler instance
export const defaultErrorHandler = new ErrorHandler();

/**
 * Initialize error handler with configuration
 * @param {Object} options - Configuration options
 * @returns {ErrorHandler} Configured error handler
 */
export function initializeErrorHandler(options = {}) {
  return new ErrorHandler(options);
}

/**
 * Handle an error using the default error handler
 * @param {Error|string} error - The error to handle
 * @param {Object} context - Additional context information
 * @returns {Promise<Object>} Error handling result
 */
export function handleError(error, context = {}) {
  return defaultErrorHandler.handleError(error, context);
}

/**
 * Register a recovery strategy with the default error handler
 * @param {string|Object|Function} pattern - Pattern to match errors
 * @param {Object} strategy - Recovery strategy
 */
export function registerRecoveryStrategy(pattern, strategy) {
  return defaultErrorHandler.registerRecoveryStrategy(pattern, strategy);
}

/**
 * Register a critical error handler with the default error handler
 * @param {Function} handler - Handler function
 */
export function registerCriticalErrorHandler(handler) {
  return defaultErrorHandler.registerCriticalErrorHandler(handler);
}