/**
 * Test-specific logging transports for assertion verification
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

import '../../../logger.js';

/**
 * Memory transport that captures log entries for testing
 */
export class MemoryTransport {
  constructor(options = {}) {
    this.options = {
      level: 'debug',
      maxEntries: 1000,
      format: 'json',
      ...options
    };
    
    this.entries = [];
    this.stats = {
      totalEntries: 0,
      entriesByLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      }
    };
  }

  /**
   * Log an entry to memory
   * @param {Object} entry - Log entry
   */
  log(entry) {
    // Check if entry meets level requirements
    if (!this._shouldLog(entry.level)) {
      return;
    }
    
    // Format entry
    const formattedEntry = this._formatEntry(entry);
    
    // Add to memory with timestamp
    const memoryEntry = {
      ...formattedEntry,
      capturedAt: Date.now(),
      transportId: this.options.transportId || 'memory'
    };
    
    this.entries.push(memoryEntry);
    
    // Update statistics
    this.stats.totalEntries++;
    if (this.stats.entriesByLevel[entry.level] !== undefined) {
      this.stats.entriesByLevel[entry.level]++;
    }
    
    // Maintain max entries limit
    if (this.entries.length > this.options.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Get all captured entries
   * @returns {Array} All log entries
   */
  getEntries() {
    return [...this.entries];
  }

  /**
   * Get entries by level
   * @param {string} level - Log level
   * @returns {Array} Filtered entries
   */
  getEntriesByLevel(level) {
    return this.entries.filter(entry => entry.level === level);
  }

  /**
   * Get entries by logger name
   * @param {string} loggerName - Logger name
   * @returns {Array} Filtered entries
   */
  getEntriesByLogger(loggerName) {
    return this.entries.filter(entry => entry.logger === loggerName);
  }

  /**
   * Get entries within time range
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Filtered entries
   */
  getEntriesInTimeRange(startTime, endTime) {
    return this.entries.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Search entries by message content
   * @param {string|RegExp} pattern - Search pattern
   * @returns {Array} Matching entries
   */
  searchEntries(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    return this.entries.filter(entry => regex.test(entry.message));
  }

  /**
   * Get statistics
   * @returns {Object} Transport statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentEntries: this.entries.length,
      oldestEntry: this.entries.length > 0 ? this.entries[0].timestamp : null,
      newestEntry: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : null
    };
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries = [];
    this.stats = {
      totalEntries: 0,
      entriesByLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      }
    };
  }

  /**
   * Assert that entries match expectations
   * @param {Object} expectations - Expected log patterns
   * @returns {Object} Assertion results
   */
  assertEntries(expectations) {
    const results = {
      passed: true,
      failures: [],
      summary: {}
    };
    
    // Check entry count
    if (expectations.count !== undefined) {
      if (this.entries.length !== expectations.count) {
        results.failures.push(`Expected ${expectations.count} entries, got ${this.entries.length}`);
        results.passed = false;
      }
    }
    
    // Check minimum entry count
    if (expectations.minCount !== undefined) {
      if (this.entries.length < expectations.minCount) {
        results.failures.push(`Expected at least ${expectations.minCount} entries, got ${this.entries.length}`);
        results.passed = false;
      }
    }
    
    // Check entries by level
    if (expectations.levels) {
      for (const [level, expectedCount] of Object.entries(expectations.levels)) {
        const actualCount = this.getEntriesByLevel(level).length;
        if (actualCount !== expectedCount) {
          results.failures.push(`Expected ${expectedCount} ${level} entries, got ${actualCount}`);
          results.passed = false;
        }
      }
    }
    
    // Check for required messages
    if (expectations.messages) {
      for (const expectedMessage of expectations.messages) {
        const found = this.entries.some(entry => 
          entry.message.includes(expectedMessage) || 
          (expectedMessage instanceof RegExp && expectedMessage.test(entry.message))
        );
        if (!found) {
          results.failures.push(`Expected message not found: ${expectedMessage}`);
          results.passed = false;
        }
      }
    }
    
    // Check for forbidden messages
    if (expectations.forbiddenMessages) {
      for (const forbiddenMessage of expectations.forbiddenMessages) {
        const found = this.entries.some(entry => 
          entry.message.includes(forbiddenMessage) ||
          (forbiddenMessage instanceof RegExp && forbiddenMessage.test(entry.message))
        );
        if (found) {
          results.failures.push(`Forbidden message found: ${forbiddenMessage}`);
          results.passed = false;
        }
      }
    }
    
    // Check logger names
    if (expectations.loggers) {
      for (const expectedLogger of expectations.loggers) {
        const found = this.entries.some(entry => entry.logger === expectedLogger);
        if (!found) {
          results.failures.push(`Expected logger not found: ${expectedLogger}`);
          results.passed = false;
        }
      }
    }
    
    results.summary = {
      totalEntries: this.entries.length,
      entriesByLevel: { ...this.stats.entriesByLevel },
      uniqueLoggers: [...new Set(this.entries.map(e => e.logger))]
    };
    
    return results;
  }

  /**
   * Check if entry should be logged based on level
   * @private
   */
  _shouldLog(entryLevel) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const transportLevelIndex = levels.indexOf(this.options.level);
    const entryLevelIndex = levels.indexOf(entryLevel);
    
    return entryLevelIndex >= transportLevelIndex;
  }

  /**
   * Format log entry
   * @private
   */
  _formatEntry(entry) {
    if (this.options.format === 'json') {
      return {
        timestamp: entry.timestamp,
        level: entry.level,
        logger: entry.logger,
        message: entry.message,
        meta: entry.meta || {},
        pid: entry.pid,
        version: entry.version
      };
    } else {
      // Pretty format for human reading
      return {
        ...entry,
        formatted: `[${new Date(entry.timestamp).toISOString()}] ${entry.level.toUpperCase()} ${entry.logger}: ${entry.message}`
      };
    }
  }
}

/**
 * Spy transport that wraps another transport and tracks its usage
 */
export class SpyTransport {
  constructor(wrappedTransport, options = {}) {
    this.wrappedTransport = wrappedTransport;
    this.options = options;
    
    this.spy = {
      callCount: 0,
      calls: [],
      lastCall: null
    };
  }

  /**
   * Log entry and track the call
   * @param {Object} entry - Log entry
   */
  log(entry) {
    this.spy.callCount++;
    this.spy.lastCall = {
      entry: { ...entry },
      timestamp: Date.now()
    };
    this.spy.calls.push(this.spy.lastCall);
    
    // Forward to wrapped transport
    if (this.wrappedTransport && this.wrappedTransport.log) {
      return this.wrappedTransport.log(entry);
    }
  }

  /**
   * Get spy statistics
   * @returns {Object} Spy data
   */
  getSpyData() {
    return {
      callCount: this.spy.callCount,
      calls: [...this.spy.calls],
      lastCall: this.spy.lastCall ? { ...this.spy.lastCall } : null,
      wrappedTransportType: this.wrappedTransport ? this.wrappedTransport.constructor.name : null
    };
  }

  /**
   * Reset spy data
   */
  resetSpy() {
    this.spy.callCount = 0;
    this.spy.calls = [];
    this.spy.lastCall = null;
  }

  /**
   * Assert spy behavior
   * @param {Object} expectations - Expected spy behavior
   * @returns {Object} Assertion results
   */
  assertSpy(expectations) {
    const results = {
      passed: true,
      failures: []
    };
    
    if (expectations.callCount !== undefined) {
      if (this.spy.callCount !== expectations.callCount) {
        results.failures.push(`Expected ${expectations.callCount} calls, got ${this.spy.callCount}`);
        results.passed = false;
      }
    }
    
    if (expectations.minCalls !== undefined) {
      if (this.spy.callCount < expectations.minCalls) {
        results.failures.push(`Expected at least ${expectations.minCalls} calls, got ${this.spy.callCount}`);
        results.passed = false;
      }
    }
    
    if (expectations.wasCalled !== undefined) {
      const wasCalled = this.spy.callCount > 0;
      if (wasCalled !== expectations.wasCalled) {
        results.failures.push(`Expected wasCalled to be ${expectations.wasCalled}, got ${wasCalled}`);
        results.passed = false;
      }
    }
    
    return results;
  }

  // Delegate other methods to wrapped transport
  getEntries() {
    return this.wrappedTransport?.getEntries?.() || [];
  }
  
  clear() {
    this.resetSpy();
    return this.wrappedTransport?.clear?.();
  }
}

/**
 * Null transport that discards all log entries (for performance testing)
 */
export class NullTransport {
  constructor(options = {}) {
    this.options = options;
    this.stats = {
      entriesReceived: 0,
      lastEntryTime: null
    };
  }

  log(entry) {
    this.stats.entriesReceived++;
    this.stats.lastEntryTime = Date.now();
    // Intentionally do nothing with the entry
  }

  getStats() {
    return { ...this.stats };
  }

  clear() {
    this.stats.entriesReceived = 0;
    this.stats.lastEntryTime = null;
  }
}

/**
 * Create a memory transport for testing
 * @param {Object} options - Transport options
 * @returns {MemoryTransport} Memory transport instance
 */
export function createMemoryTransport(options = {}) {
  return new MemoryTransport(options);
}

/**
 * Create a spy transport that wraps another transport
 * @param {Object} wrappedTransport - Transport to wrap
 * @param {Object} options - Spy options
 * @returns {SpyTransport} Spy transport instance
 */
export function createSpyTransport(wrappedTransport, options = {}) {
  return new SpyTransport(wrappedTransport, options);
}

/**
 * Create a null transport for performance testing
 * @param {Object} options - Transport options
 * @returns {NullTransport} Null transport instance
 */
export function createNullTransport(options = {}) {
  return new NullTransport(options);
}