/**
 * Test utilities for common testing patterns
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

import '../../../logger.js';
import { createMemoryTransport, createSpyTransport } from './TestTransports.js';

/**
 * Utility for verifying callback execution patterns
 */
export class CallbackVerifier {
  constructor() {
    this.executions = [];
    this.expectations = [];
  }

  /**
   * Record a callback execution
   * @param {string} callbackId - Callback identifier
   * @param {Object} context - Execution context
   */
  recordExecution(callbackId, context) {
    this.executions.push({
      callbackId,
      context: { ...context },
      timestamp: Date.now(),
      executionOrder: this.executions.length
    });
  }

  /**
   * Expect a callback to be executed
   * @param {string} callbackId - Callback identifier
   * @param {Object} expectedContext - Expected context (partial match)
   * @param {Object} options - Verification options
   */
  expectExecution(callbackId, expectedContext = {}, options = {}) {
    this.expectations.push({
      type: 'execution',
      callbackId,
      expectedContext,
      options: {
        times: 1,
        timeout: 5000,
        ...options
      }
    });
  }

  /**
   * Expect callbacks to execute in specific order
   * @param {Array} callbackIds - Ordered callback identifiers
   */
  expectExecutionOrder(callbackIds) {
    this.expectations.push({
      type: 'order',
      callbackIds,
      options: {}
    });
  }

  /**
   * Expect a callback to not be executed
   * @param {string} callbackId - Callback identifier
   */
  expectNoExecution(callbackId) {
    this.expectations.push({
      type: 'no-execution',
      callbackId,
      options: {}
    });
  }

  /**
   * Verify all expectations
   * @returns {Object} Verification results
   */
  verify() {
    const results = {
      passed: true,
      failures: [],
      summary: {
        totalExecutions: this.executions.length,
        totalExpectations: this.expectations.length,
        verifiedExpectations: 0
      }
    };

    for (const expectation of this.expectations) {
      const result = this._verifyExpectation(expectation);
      if (!result.passed) {
        results.passed = false;
        results.failures.push(...result.failures);
      } else {
        results.summary.verifiedExpectations++;
      }
    }

    return results;
  }

  /**
   * Get execution history for a callback
   * @param {string} callbackId - Callback identifier
   * @returns {Array} Execution history
   */
  getExecutionHistory(callbackId) {
    return this.executions.filter(exec => exec.callbackId === callbackId);
  }

  /**
   * Clear all recorded executions and expectations
   */
  clear() {
    this.executions = [];
    this.expectations = [];
  }

  /**
   * Verify a single expectation
   * @private
   */
  _verifyExpectation(expectation) {
    switch (expectation.type) {
      case 'execution':
        return this._verifyExecution(expectation);
      case 'order':
        return this._verifyOrder(expectation);
      case 'no-execution':
        return this._verifyNoExecution(expectation);
      default:
        return { passed: false, failures: [`Unknown expectation type: ${expectation.type}`] };
    }
  }

  /**
   * Verify execution expectation
   * @private
   */
  _verifyExecution(expectation) {
    const executions = this.getExecutionHistory(expectation.callbackId);
    const expectedTimes = expectation.options.times;
    
    if (executions.length !== expectedTimes) {
      return {
        passed: false,
        failures: [`Expected callback '${expectation.callbackId}' to execute ${expectedTimes} times, got ${executions.length}`]
      };
    }

    // Verify context if provided
    if (Object.keys(expectation.expectedContext).length > 0) {
      for (const execution of executions) {
        if (!this._contextMatches(execution.context, expectation.expectedContext)) {
          return {
            passed: false,
            failures: [`Callback '${expectation.callbackId}' context mismatch. Expected: ${JSON.stringify(expectation.expectedContext)}, Got: ${JSON.stringify(execution.context)}`]
          };
        }
      }
    }

    return { passed: true, failures: [] };
  }

  /**
   * Verify execution order expectation
   * @private
   */
  _verifyOrder(expectation) {
    const { callbackIds } = expectation;
    const relevantExecutions = this.executions.filter(exec => 
      callbackIds.includes(exec.callbackId)
    );

    if (relevantExecutions.length < callbackIds.length) {
      return {
        passed: false,
        failures: [`Expected all callbacks to execute: ${callbackIds.join(', ')}`]
      };
    }

    // Check order
    const actualOrder = relevantExecutions
      .sort((a, b) => a.executionOrder - b.executionOrder)
      .map(exec => exec.callbackId);

    for (let i = 0; i < callbackIds.length; i++) {
      if (actualOrder[i] !== callbackIds[i]) {
        return {
          passed: false,
          failures: [`Expected execution order: ${callbackIds.join(' → ')}, Got: ${actualOrder.join(' → ')}`]
        };
      }
    }

    return { passed: true, failures: [] };
  }

  /**
   * Verify no-execution expectation
   * @private
   */
  _verifyNoExecution(expectation) {
    const executions = this.getExecutionHistory(expectation.callbackId);
    
    if (executions.length > 0) {
      return {
        passed: false,
        failures: [`Expected callback '${expectation.callbackId}' to not execute, but it executed ${executions.length} times`]
      };
    }

    return { passed: true, failures: [] };
  }

  /**
   * Check if context matches expected values
   * @private
   */
  _contextMatches(actual, expected) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (actual[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Utility for making state assertions
 */
export class StateAssertion {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.snapshots = [];
  }

  /**
   * Take a snapshot of current state
   * @param {string} label - Snapshot label
   */
  snapshot(label = `snapshot-${Date.now()}`) {
    const snapshot = {
      label,
      timestamp: Date.now(),
      state: this._captureState()
    };
    
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Assert that state path has expected value
   * @param {string} path - State path
   * @param {*} expectedValue - Expected value
   * @returns {Object} Assertion result
   */
  assertValue(path, expectedValue) {
    const actualValue = this.stateManager.get(path);
    const passed = this._deepEqual(actualValue, expectedValue);
    
    return {
      passed,
      path,
      expectedValue,
      actualValue,
      message: passed ? 
        `State path '${path}' has expected value` :
        `State path '${path}' expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
    };
  }

  /**
   * Assert that state path exists
   * @param {string} path - State path
   * @returns {Object} Assertion result
   */
  assertExists(path) {
    const exists = this.stateManager.has(path);
    
    return {
      passed: exists,
      path,
      message: exists ?
        `State path '${path}' exists` :
        `State path '${path}' does not exist`
    };
  }

  /**
   * Assert that state path does not exist
   * @param {string} path - State path
   * @returns {Object} Assertion result
   */
  assertNotExists(path) {
    const exists = this.stateManager.has(path);
    
    return {
      passed: !exists,
      path,
      message: !exists ?
        `State path '${path}' does not exist` :
        `State path '${path}' exists but was expected not to`
    };
  }

  /**
   * Assert that state changed between snapshots
   * @param {string} fromSnapshot - Source snapshot label
   * @param {string} toSnapshot - Target snapshot label
   * @param {string} path - State path to check
   * @returns {Object} Assertion result
   */
  assertChanged(fromSnapshot, toSnapshot, path) {
    const from = this.snapshots.find(s => s.label === fromSnapshot);
    const to = this.snapshots.find(s => s.label === toSnapshot);
    
    if (!from || !to) {
      return {
        passed: false,
        message: `Snapshot not found: ${!from ? fromSnapshot : toSnapshot}`
      };
    }
    
    const fromValue = this._getValueFromSnapshot(from, path);
    const toValue = this._getValueFromSnapshot(to, path);
    const changed = !this._deepEqual(fromValue, toValue);
    
    return {
      passed: changed,
      path,
      fromValue,
      toValue,
      message: changed ?
        `State path '${path}' changed from ${JSON.stringify(fromValue)} to ${JSON.stringify(toValue)}` :
        `State path '${path}' did not change (value: ${JSON.stringify(fromValue)})`
    };
  }

  /**
   * Assert multiple state conditions
   * @param {Array} assertions - Array of assertion functions
   * @returns {Object} Combined assertion result
   */
  assertAll(assertions) {
    const results = assertions.map(assertion => assertion());
    const passed = results.every(result => result.passed);
    const failures = results.filter(result => !result.passed);
    
    return {
      passed,
      results,
      failures,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: failures.length
      }
    };
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots() {
    this.snapshots = [];
  }

  /**
   * Capture current state
   * @private
   */
  _captureState() {
    // This would need to be implemented based on the actual StateManager interface
    // For now, return a placeholder
    return {
      captured: true,
      timestamp: Date.now()
    };
  }

  /**
   * Get value from snapshot
   * @private
   */
  _getValueFromSnapshot(snapshot, path) {
    // This would need to be implemented based on the snapshot structure
    return snapshot.state[path];
  }

  /**
   * Deep equality check
   * @private
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this._deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  }
}

/**
 * Utility for testing async operations with timeouts and retries
 */
export class AsyncTestHelper {
  constructor(options = {}) {
    this.options = {
      defaultTimeout: 5000,
      defaultRetryInterval: 100,
      maxRetries: 50,
      ...options
    };
  }

  /**
   * Wait for a condition to become true
   * @param {Function} condition - Condition function
   * @param {Object} options - Wait options
   * @returns {Promise} Resolves when condition is true
   */
  async waitFor(condition, options = {}) {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    let attempts = 0;
    
    while (attempts < opts.maxRetries) {
      try {
        const result = await condition();
        if (result) {
          return result;
        }
      } catch (error) {
        // Condition threw an error, continue waiting
      }
      
      attempts++;
      
      if (Date.now() - startTime > opts.defaultTimeout) {
        throw new Error(`Timeout waiting for condition after ${opts.defaultTimeout}ms (${attempts} attempts)`);
      }
      
      await this.sleep(opts.defaultRetryInterval);
    }
    
    throw new Error(`Max retries (${opts.maxRetries}) exceeded waiting for condition`);
  }

  /**
   * Wait for multiple conditions to all become true
   * @param {Array} conditions - Array of condition functions
   * @param {Object} options - Wait options
   * @returns {Promise} Resolves when all conditions are true
   */
  async waitForAll(conditions, options = {}) {
    const results = await Promise.all(
      conditions.map(condition => this.waitFor(condition, options))
    );
    return results;
  }

  /**
   * Wait for any of the conditions to become true
   * @param {Array} conditions - Array of condition functions
   * @param {Object} options - Wait options
   * @returns {Promise} Resolves when any condition is true
   */
  async waitForAny(conditions, options = {}) {
    const promises = conditions.map(condition => this.waitFor(condition, options));
    return Promise.race(promises);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Function result or timeout error
   */
  async withTimeout(fn, timeout = this.options.defaultTimeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Retry an operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Operation result
   */
  async retry(operation, options = {}) {
    const opts = {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 5000,
      backoffFactor: 2,
      ...options
    };
    
    let lastError;
    
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === opts.maxAttempts) {
          break;
        }
        
        const delay = Math.min(
          opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
          opts.maxDelay
        );
        
        await this.sleep(delay);
      }
    }
    
    throw new Error(`Operation failed after ${opts.maxAttempts} attempts. Last error: ${lastError.message}`);
  }
}

/**
 * Create a callback verifier
 * @returns {CallbackVerifier} New callback verifier
 */
export function createCallbackVerifier() {
  return new CallbackVerifier();
}

/**
 * Create a state assertion helper
 * @param {Object} stateManager - State manager instance
 * @returns {StateAssertion} New state assertion helper
 */
export function createStateAssertion(stateManager) {
  return new StateAssertion(stateManager);
}

/**
 * Create an async test helper
 * @param {Object} options - Helper options
 * @returns {AsyncTestHelper} New async test helper
 */
export function createAsyncTestHelper(options = {}) {
  return new AsyncTestHelper(options);
}

/**
 * Create a test logger with memory transport
 * @param {Object} options - Logger options
 * @returns {Object} Logger with memory transport
 */
export function createTestLogger(options = {}) {
  const memoryTransport = createMemoryTransport(options.transport);
  
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      name: options.name || 'test-logger'
    },
    transport: memoryTransport,
    getEntries: () => memoryTransport.getEntries(),
    assertEntries: (expectations) => memoryTransport.assertEntries(expectations),
    clear: () => memoryTransport.clear()
  };
}