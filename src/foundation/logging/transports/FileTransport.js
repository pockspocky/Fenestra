/**
 * File Transport Implementation
 * 
 * Outputs log entries to files with configurable formatting and rotation.
 * Supports both JSON and pretty-printed formats with file rotation.
 */

import fs from 'fs/promises';
import path from 'path';

export class FileTransport {
  constructor(options = {}) {
    this.level = options.level || 'debug';
    this.format = options.format || 'json';
    this.filename = options.filename || 'application.log';
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles || 5;
    this.timestamp = options.timestamp !== false; // Default to true
    
    this._ensureLogDirectory();
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
   * Log an entry to the file
   * @param {Object} logEntry - Structured log entry
   */
  async log(logEntry) {
    try {
      const formatted = this._formatEntry(logEntry);
      
      // Check if rotation is needed
      await this._rotateIfNeeded();
      
      // Append to log file
      await fs.appendFile(this.filename, formatted + '\n', 'utf8');
    } catch (error) {
      // If file logging fails, we can't use the logger to log the error
      // as it might cause infinite recursion. Use console as fallback.
      console.error('[FileTransport] Failed to write log entry:', error.message);
    }
  }

  /**
   * Update transport configuration
   * @param {Object} options - New configuration options
   */
  configure(options) {
    if (options.level) this.level = options.level;
    if (options.format) this.format = options.format;
    if (options.filename) this.filename = options.filename;
    if (options.maxSize) this.maxSize = options.maxSize;
    if (options.maxFiles) this.maxFiles = options.maxFiles;
    if (options.timestamp !== undefined) this.timestamp = options.timestamp;
  }

  /**
   * Ensure the log directory exists
   * @private
   */
  async _ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.filename);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('[FileTransport] Failed to create log directory:', error.message);
    }
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
   * Format log entry in pretty format for file output
   * @private
   */
  _formatPretty(logEntry) {
    const parts = [];
    
    // Timestamp
    if (this.timestamp) {
      parts.push(`[${logEntry.timestamp}]`);
    }
    
    // Level
    parts.push(`[${logEntry.level.toUpperCase()}]`);
    
    // Logger name
    parts.push(`[${logEntry.logger}]`);
    
    // Message
    parts.push(logEntry.message);
    
    // Metadata (if present and not empty)
    if (logEntry.meta && Object.keys(logEntry.meta).length > 0) {
      parts.push(JSON.stringify(logEntry.meta));
    }
    
    return parts.join(' ');
  }

  /**
   * Rotate log file if it exceeds maximum size
   * @private
   */
  async _rotateIfNeeded() {
    try {
      const stats = await fs.stat(this.filename);
      
      if (stats.size >= this.maxSize) {
        await this._rotateFiles();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
      if (error.code !== 'ENOENT') {
        console.error('[FileTransport] Failed to check file size:', error.message);
      }
    }
  }

  /**
   * Perform log file rotation
   * @private
   */
  async _rotateFiles() {
    try {
      const ext = path.extname(this.filename);
      const basename = path.basename(this.filename, ext);
      const dirname = path.dirname(this.filename);
      
      // Remove oldest file if we're at the limit
      const oldestFile = path.join(dirname, `${basename}.${this.maxFiles - 1}${ext}`);
      try {
        await fs.unlink(oldestFile);
      } catch (error) {
        // File might not exist, that's okay
      }
      
      // Rotate existing files
      for (let i = this.maxFiles - 2; i >= 0; i--) {
        const currentFile = i === 0 
          ? this.filename 
          : path.join(dirname, `${basename}.${i}${ext}`);
        const nextFile = path.join(dirname, `${basename}.${i + 1}${ext}`);
        
        try {
          await fs.rename(currentFile, nextFile);
        } catch (error) {
          // File might not exist, that's okay
        }
      }
    } catch (error) {
      console.error('[FileTransport] Failed to rotate log files:', error.message);
    }
  }
}