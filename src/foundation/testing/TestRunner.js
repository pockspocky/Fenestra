/**
 * Test Runner for Foundation Testing Infrastructure
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

import '../../../logger.js';
import { createTestContainer, createMemoryTransport, mockFactory } from './index.js';

/**
 * Test runner for executing and managing foundation tests
 */
export class TestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      timeout: 30000,
      parallel: false,
      ...options
    };
    
    this.tests = new Map();
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Register a test suite
   * @param {string} name - Test suite name
   * @param {Function} testFunction - Test function
   * @param {Object} options - Test options
   */
  registerTest(name, testFunction, options = {}) {
    this.tests.set(name, {
      name,
      testFunction,
      options: {
        timeout: this.options.timeout,
        setup: null,
        teardown: null,
        ...options
      }
    });
  }

  /**
   * Register multiple tests from an object
   * @param {Object} testSuite - Object containing test functions
   * @param {Object} options - Default options for all tests
   */
  registerTestSuite(testSuite, options = {}) {
    for (const [name, testFunction] of Object.entries(testSuite)) {
      if (typeof testFunction === 'function') {
        this.registerTest(name, testFunction, options);
      }
    }
  }

  /**
   * Run all registered tests
   * @returns {Object} Test results summary
   */
  async runAll() {
    this.startTime = Date.now();
    this.results = [];
    
    console.log(`Running ${this.tests.size} test(s)...\n`);
    
    if (this.options.parallel) {
      await this._runTestsParallel();
    } else {
      await this._runTestsSequential();
    }
    
    this.endTime = Date.now();
    
    return this._generateSummary();
  }

  /**
   * Run a specific test by name
   * @param {string} testName - Name of test to run
   * @returns {Object} Test result
   */
  async runTest(testName) {
    const test = this.tests.get(testName);
    if (!test) {
      throw new Error(`Test '${testName}' not found`);
    }
    
    return this._executeTest(test);
  }

  /**
   * Get test results
   * @returns {Array} Array of test results
   */
  getResults() {
    return [...this.results];
  }

  /**
   * Clear all registered tests and results
   */
  clear() {
    this.tests.clear();
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Run tests sequentially
   * @private
   */
  async _runTestsSequential() {
    for (const test of this.tests.values()) {
      const result = await this._executeTest(test);
      this.results.push(result);
      
      if (this.options.verbose) {
        this._logTestResult(result);
      }
    }
  }

  /**
   * Run tests in parallel
   * @private
   */
  async _runTestsParallel() {
    const testPromises = Array.from(this.tests.values()).map(test => 
      this._executeTest(test)
    );
    
    this.results = await Promise.all(testPromises);
    
    if (this.options.verbose) {
      this.results.forEach(result => this._logTestResult(result));
    }
  }

  /**
   * Execute a single test
   * @private
   */
  async _executeTest(test) {
    const result = {
      name: test.name,
      passed: false,
      error: null,
      duration: 0,
      startTime: Date.now(),
      endTime: null,
      output: [],
      metadata: {}
    };
    
    let testContainer = null;
    
    try {
      // Setup test environment
      testContainer = createTestContainer();
      testContainer.setupTestConfiguration();
      
      // Run setup if provided
      if (test.options.setup) {
        await test.options.setup(testContainer);
      }
      
      // Execute test with timeout
      await this._withTimeout(
        () => test.testFunction(testContainer),
        test.options.timeout
      );
      
      result.passed = true;
      
    } catch (error) {
      result.error = {
        message: error.message,
        stack: error.stack,
        name: error.constructor.name
      };
    } finally {
      // Run teardown if provided
      if (test.options.teardown) {
        try {
          await test.options.teardown(testContainer);
        } catch (teardownError) {
          if (!result.error) {
            result.error = {
              message: `Teardown failed: ${teardownError.message}`,
              stack: teardownError.stack,
              name: teardownError.constructor.name
            };
            result.passed = false;
          }
        }
      }
      
      // Cleanup test container
      if (testContainer) {
        testContainer.cleanup();
      }
      
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
    }
    
    return result;
  }

  /**
   * Execute function with timeout
   * @private
   */
  async _withTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Log test result
   * @private
   */
  _logTestResult(result) {
    const status = result.passed ? '✓' : '❌';
    const duration = `${result.duration}ms`;
    
    console.log(`${status} ${result.name} (${duration})`);
    
    if (!result.passed && result.error) {
      console.log(`  Error: ${result.error.message}`);
      if (this.options.verbose && result.error.stack) {
        console.log(`  Stack: ${result.error.stack}`);
      }
    }
  }

  /**
   * Generate test summary
   * @private
   */
  _generateSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;
    const totalDuration = this.endTime - this.startTime;
    
    const summary = {
      total: this.results.length,
      passed,
      failed,
      duration: totalDuration,
      passRate: this.results.length > 0 ? (passed / this.results.length) * 100 : 0,
      results: this.results
    };
    
    // Log summary
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Pass Rate: ${summary.passRate.toFixed(1)}%`);
    console.log(`Duration: ${summary.duration}ms`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error.message}`));
    }
    
    return summary;
  }
}

/**
 * Create a new test runner
 * @param {Object} options - Runner options
 * @returns {TestRunner} New test runner instance
 */
export function createTestRunner(options = {}) {
  return new TestRunner(options);
}

/**
 * Quick test function for simple assertions
 * @param {string} description - Test description
 * @param {Function} testFn - Test function
 * @returns {Promise} Test result
 */
export async function test(description, testFn) {
  const runner = createTestRunner({ verbose: true });
  runner.registerTest(description, testFn);
  const summary = await runner.runAll();
  return summary.results[0];
}

/**
 * Test suite helper for organizing related tests
 * @param {string} suiteName - Suite name
 * @param {Function} suiteDefinition - Function that defines tests
 * @returns {Promise} Suite results
 */
export async function testSuite(suiteName, suiteDefinition) {
  console.log(`\n=== Test Suite: ${suiteName} ===`);
  
  const runner = createTestRunner({ verbose: true });
  
  // Provide test registration functions to suite
  const suite = {
    test: (name, fn, options) => runner.registerTest(name, fn, options),
    beforeEach: (fn) => runner.registerTest('beforeEach', fn, { setup: fn }),
    afterEach: (fn) => runner.registerTest('afterEach', fn, { teardown: fn })
  };
  
  // Execute suite definition
  await suiteDefinition(suite);
  
  // Run all tests in suite
  return runner.runAll();
}

/**
 * Assertion helpers for tests
 */
export const assert = {
  /**
   * Assert that condition is true
   */
  isTrue(condition, message = 'Expected condition to be true') {
    if (!condition) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that condition is false
   */
  isFalse(condition, message = 'Expected condition to be false') {
    if (condition) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that values are equal
   */
  equal(actual, expected, message = `Expected ${actual} to equal ${expected}`) {
    if (actual !== expected) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that values are not equal
   */
  notEqual(actual, expected, message = `Expected ${actual} to not equal ${expected}`) {
    if (actual === expected) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that value is null or undefined
   */
  isNull(value, message = 'Expected value to be null or undefined') {
    if (value != null) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that value is not null or undefined
   */
  isNotNull(value, message = 'Expected value to not be null or undefined') {
    if (value == null) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that function throws an error
   */
  async throws(fn, expectedError, message = 'Expected function to throw') {
    let threw = false;
    try {
      await fn();
    } catch (error) {
      threw = true;
      if (expectedError && !error.message.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}", got "${error.message}"`);
      }
    }
    
    if (!threw) {
      throw new Error(message);
    }
  },
  
  /**
   * Assert that arrays are equal
   */
  arrayEqual(actual, expected, message = 'Expected arrays to be equal') {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      throw new Error('Both values must be arrays');
    }
    
    if (actual.length !== expected.length) {
      throw new Error(`${message}: different lengths (${actual.length} vs ${expected.length})`);
    }
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(`${message}: difference at index ${i} (${actual[i]} vs ${expected[i]})`);
      }
    }
  }
};