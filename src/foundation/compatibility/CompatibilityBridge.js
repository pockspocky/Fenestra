/**
 * Compatibility Bridge Implementation
 * 
 * Provides backward compatibility for existing console usage patterns while
 * integrating with the new structured logging system. Enables gradual migration
 * from legacy console usage to structured logging.
 */

import { getLogger } from '../logging/LoggerFactory.js';

export class CompatibilityBridge {
  constructor(options = {}) {
    this.options = {
      enableDeprecationWarnings: true,
      preserveOriginalConsole: true,
      structuredLogging: true,
      migrationMode: 'gradual', // 'gradual' | 'strict' | 'legacy'
      ...options
    };
    
    this.originalConsole = { ...console };
    this.legacyLogger = getLogger('legacy-console');
    this.deprecationWarnings = new Set();
    this.callCounts = new Map();
    
    this._setupConsoleOverride();
  }

  /**
   * Setup console override that bridges to structured logging
   * @private
   */
  _setupConsoleOverride() {
    if (!this.options.preserveOriginalConsole) {
      return;
    }

    const self = this;
    
    // Override console methods to bridge to structured logging
    global.console = {
      ...this.originalConsole,
      
      log: (...args) => {
        self._handleLegacyCall('log', args);
      },
      
      warn: (...args) => {
        self._handleLegacyCall('warn', args);
      },
      
      error: (...args) => {
        self._handleLegacyCall('error', args);
      },
      
      debug: (...args) => {
        self._handleLegacyCall('debug', args);
      },
      
      info: (...args) => {
        self._handleLegacyCall('info', args);
      }
    };
  }

  /**
   * Handle legacy console calls and bridge to structured logging
   * @private
   */
  _handleLegacyCall(level, args) {
    const callSite = this._getCallSite();
    const moduleName = this._extractModuleName(callSite);
    
    // Track usage for migration reporting
    this._trackUsage(moduleName, level);
    
    // Show deprecation warning if enabled
    if (this.options.enableDeprecationWarnings && this.options.migrationMode !== 'legacy') {
      this._showDeprecationWarning(moduleName, level, callSite);
    }
    
    // Format message for structured logging
    const formattedEntry = this._formatLegacyMessage(level, args, {
      module: moduleName,
      callSite,
      legacy: true
    });
    
    if (this.options.structuredLogging) {
      // Use the configured legacy logger instead of creating a new one
      const logger = this.legacyLogger || getLogger(moduleName || 'unknown-module');
      
      // Map console levels to logger methods
      let loggerMethod;
      switch (level) {
        case 'log':
          loggerMethod = 'info'; // console.log maps to logger.info
          break;
        case 'debug':
        case 'info':
        case 'warn':
        case 'error':
          loggerMethod = level;
          break;
        default:
          loggerMethod = 'info';
      }
      
      if (typeof logger[loggerMethod] === 'function') {
        logger[loggerMethod](formattedEntry.message, formattedEntry.metadata);
      } else {
        // Fallback to info level if the method doesn't exist
        logger.info(formattedEntry.message, formattedEntry.metadata);
      }
    } else {
      // Fallback to original console
      this.originalConsole[level](...args);
    }
  }

  /**
   * Format legacy console message for structured logging
   * @private
   */
  _formatLegacyMessage(level, args, context) {
    // Convert arguments to a structured format
    const message = args.length === 1 && typeof args[0] === 'string' 
      ? args[0]
      : args.map(arg => this._stringifyArg(arg)).join(' ');
    
    const metadata = {
      legacy: true,
      originalLevel: level,
      argumentCount: args.length,
      module: context.module,
      callSite: context.callSite,
      timestamp: Date.now()
    };
    
    // Extract structured data from arguments if possible
    const structuredArgs = args.filter(arg => 
      typeof arg === 'object' && arg !== null && !Array.isArray(arg)
    );
    
    if (structuredArgs.length > 0) {
      metadata.structuredData = structuredArgs;
    }
    
    return { message, metadata };
  }

  /**
   * Get call site information for deprecation warnings
   * @private
   */
  _getCallSite() {
    const stack = new Error().stack;
    const lines = stack.split('\n');
    
    // Find the first line that's not from this compatibility bridge
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('CompatibilityBridge.js') && 
          !line.includes('at console.')) {
        return this._parseStackLine(line);
      }
    }
    
    return { file: 'unknown', line: 0, function: 'unknown' };
  }

  /**
   * Parse a stack trace line to extract file, line, and function info
   * @private
   */
  _parseStackLine(line) {
    // Match patterns like "at functionName (file:line:column)" or "at file:line:column"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    
    if (match) {
      return {
        function: match[1] || 'anonymous',
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10)
      };
    }
    
    return { file: 'unknown', line: 0, function: 'unknown' };
  }

  /**
   * Extract module name from call site
   * @private
   */
  _extractModuleName(callSite) {
    if (!callSite.file) return 'unknown';
    
    // Extract module name from file path
    const parts = callSite.file.split('/');
    const filename = parts[parts.length - 1];
    
    // Remove extension and return as module name
    return filename.replace(/\.(js|mjs|ts)$/, '');
  }

  /**
   * Track usage for migration reporting
   * @private
   */
  _trackUsage(module, level) {
    const key = `${module}:${level}`;
    const current = this.callCounts.get(key) || 0;
    this.callCounts.set(key, current + 1);
  }

  /**
   * Show deprecation warning for legacy console usage
   * @private
   */
  _showDeprecationWarning(module, level, callSite) {
    const warningKey = `${module}:${callSite.file}:${callSite.line}`;
    
    // Only show each warning once per location
    if (this.deprecationWarnings.has(warningKey)) {
      return;
    }
    
    this.deprecationWarnings.add(warningKey);
    
    const message = [
      `[DEPRECATION] Legacy console.${level}() usage detected`,
      `  Location: ${callSite.file}:${callSite.line}`,
      `  Module: ${module}`,
      `  Migration: Use getLogger('${module}').${level}() instead`,
      `  Example: import { getLogger } from './src/foundation/logging/LoggerFactory.js';`,
      `           const logger = getLogger('${module}');`,
      `           logger.${level}('your message', { metadata });`
    ].join('\n');
    
    // Use original console to avoid recursion
    this.originalConsole.warn(message);
  }

  /**
   * Convert argument to string for logging
   * @private
   */
  _stringifyArg(arg) {
    if (typeof arg === 'string') {
      return arg;
    }
    
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (error) {
        return '[Object: circular reference or non-serializable]';
      }
    }
    
    return String(arg);
  }

  /**
   * Get migration statistics
   * @returns {Object} Usage statistics for migration planning
   */
  getMigrationStats() {
    const stats = {
      totalCalls: 0,
      moduleBreakdown: new Map(),
      levelBreakdown: new Map(),
      deprecationWarnings: this.deprecationWarnings.size
    };
    
    for (const [key, count] of this.callCounts) {
      const [module, level] = key.split(':');
      
      stats.totalCalls += count;
      
      // Module breakdown
      const moduleCount = stats.moduleBreakdown.get(module) || 0;
      stats.moduleBreakdown.set(module, moduleCount + count);
      
      // Level breakdown
      const levelCount = stats.levelBreakdown.get(level) || 0;
      stats.levelBreakdown.set(level, levelCount + count);
    }
    
    return {
      ...stats,
      moduleBreakdown: Object.fromEntries(stats.moduleBreakdown),
      levelBreakdown: Object.fromEntries(stats.levelBreakdown)
    };
  }

  /**
   * Generate migration report
   * @returns {string} Formatted migration report
   */
  generateMigrationReport() {
    const stats = this.getMigrationStats();
    
    const report = [
      '=== Legacy Console Usage Migration Report ===',
      `Total legacy console calls: ${stats.totalCalls}`,
      `Unique deprecation warnings shown: ${stats.deprecationWarnings}`,
      '',
      'Usage by Module:',
      ...Object.entries(stats.moduleBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([module, count]) => `  ${module}: ${count} calls`),
      '',
      'Usage by Level:',
      ...Object.entries(stats.levelBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([level, count]) => `  ${level}: ${count} calls`),
      '',
      'Migration Priority (highest usage first):',
      ...Object.entries(stats.moduleBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([module, count], index) => 
          `  ${index + 1}. ${module} (${count} calls)`
        )
    ];
    
    return report.join('\n');
  }

  /**
   * Configure the compatibility bridge
   * @param {Object} options - Configuration options
   */
  configure(options) {
    this.options = { ...this.options, ...options };
    
    // Re-setup console override if needed
    if (options.preserveOriginalConsole !== undefined) {
      this._setupConsoleOverride();
    }
  }

  /**
   * Restore original console (for testing or migration completion)
   */
  restoreOriginalConsole() {
    global.console = this.originalConsole;
  }

  /**
   * Enable strict migration mode (shows warnings for all legacy usage)
   */
  enableStrictMode() {
    this.configure({
      migrationMode: 'strict',
      enableDeprecationWarnings: true
    });
  }

  /**
   * Enable legacy mode (no warnings, preserves old behavior)
   */
  enableLegacyMode() {
    this.configure({
      migrationMode: 'legacy',
      enableDeprecationWarnings: false,
      structuredLogging: false
    });
  }

  /**
   * Clear usage statistics (useful for testing)
   */
  clearStats() {
    this.callCounts.clear();
    this.deprecationWarnings.clear();
  }
}

// Lazy initialization of default compatibility bridge
let _defaultCompatibilityBridge = null;

/**
 * Get or create the default compatibility bridge instance
 * @returns {CompatibilityBridge} Default compatibility bridge
 */
export function getDefaultCompatibilityBridge() {
  if (!_defaultCompatibilityBridge) {
    _defaultCompatibilityBridge = new CompatibilityBridge();
  }
  return _defaultCompatibilityBridge;
}

/**
 * Initialize compatibility bridge with configuration
 * @param {Object} options - Configuration options
 * @returns {CompatibilityBridge} Configured compatibility bridge
 */
export function initializeCompatibilityBridge(options = {}) {
  const bridge = new CompatibilityBridge(options);
  return bridge;
}

/**
 * Get migration statistics from default bridge
 * @returns {Object} Migration statistics
 */
export function getMigrationStats() {
  return getDefaultCompatibilityBridge().getMigrationStats();
}

/**
 * Generate migration report from default bridge
 * @returns {string} Migration report
 */
export function generateMigrationReport() {
  return getDefaultCompatibilityBridge().generateMigrationReport();
}