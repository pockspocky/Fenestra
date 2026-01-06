/**
 * Console Transport Implementation
 * 
 * Outputs log entries to the console with configurable formatting.
 * Supports both JSON and pretty-printed formats.
 */

export class ConsoleTransport {
  constructor(options = {}) {
    this.level = options.level || 'debug';
    this.format = options.format || 'pretty';
    this.colors = options.colors !== false; // Default to true
    this.timestamp = options.timestamp !== false; // Default to true
  }

  /**
   * Check if this transport should log the given entry
   * @param {Object} logEntry - Log entry to check
   * @returns {boolean} Whether to log this entry
   */
  shouldLog(logEntry) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const transportLevelIndex = levels.indexOf(this.level);
    const entryLevelIndex = levels.indexOf(logEntry.level);
    
    return entryLevelIndex >= transportLevelIndex;
  }

  /**
   * Log an entry to the console
   * @param {Object} logEntry - Structured log entry
   */
  log(logEntry) {
    const formatted = this._formatEntry(logEntry);
    const consoleMethod = this._getConsoleMethod(logEntry.level);
    
    consoleMethod(formatted);
  }

  /**
   * Update transport configuration
   * @param {Object} options - New configuration options
   */
  configure(options) {
    if (options.level) this.level = options.level;
    if (options.format) this.format = options.format;
    if (options.colors !== undefined) this.colors = options.colors;
    if (options.timestamp !== undefined) this.timestamp = options.timestamp;
  }

  /**
   * Format log entry based on configured format
   * @private
   */
  _formatEntry(logEntry) {
    if (this.format === 'json') {
      return JSON.stringify(logEntry);
    }
    
    return this._formatPretty(logEntry);
  }

  /**
   * Format log entry in pretty format
   * @private
   */
  _formatPretty(logEntry) {
    const parts = [];
    
    // Timestamp
    if (this.timestamp) {
      const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
      parts.push(this._colorize(`[${timestamp}]`, 'gray'));
    }
    
    // Level
    const levelStr = `[${logEntry.level.toUpperCase()}]`;
    parts.push(this._colorize(levelStr, this._getLevelColor(logEntry.level)));
    
    // Logger name
    parts.push(this._colorize(`[${logEntry.logger}]`, 'cyan'));
    
    // Message
    parts.push(logEntry.message);
    
    // Metadata (if present and not empty)
    if (logEntry.meta && Object.keys(logEntry.meta).length > 0) {
      parts.push(this._colorize(JSON.stringify(logEntry.meta), 'gray'));
    }
    
    return parts.join(' ');
  }

  /**
   * Apply color to text if colors are enabled
   * @private
   */
  _colorize(text, color) {
    if (!this.colors) {
      return text;
    }
    
    const colors = {
      gray: '\x1b[90m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      reset: '\x1b[0m'
    };
    
    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  /**
   * Get color for log level
   * @private
   */
  _getLevelColor(level) {
    const levelColors = {
      debug: 'gray',
      info: 'blue',
      warn: 'yellow',
      error: 'red'
    };
    
    return levelColors[level] || 'gray';
  }

  /**
   * Get appropriate console method for log level
   * @private
   */
  _getConsoleMethod(level) {
    // Use the original console methods to avoid any overrides
    const originalConsole = console;
    
    switch (level) {
      case 'debug':
        return originalConsole.debug.bind(originalConsole);
      case 'info':
        return originalConsole.info.bind(originalConsole);
      case 'warn':
        return originalConsole.warn.bind(originalConsole);
      case 'error':
        return originalConsole.error.bind(originalConsole);
      default:
        return originalConsole.log.bind(originalConsole);
    }
  }
}