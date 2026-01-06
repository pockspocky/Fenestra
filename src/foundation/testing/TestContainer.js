/**
 * Test Container for isolated dependency injection configurations
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

import '../../../logger.js';
import { Container } from '../di/Container.js';
import { mockFactory } from './MockFactory.js';

/**
 * Test-specific dependency injection container with isolated configurations
 */
export class TestContainer extends Container {
  constructor(options = {}) {
    super();
    
    this.testOptions = {
      isolateServices: true,
      mockExternalDependencies: true,
      enableTestLogging: true,
      ...options
    };
    
    this.testMocks = new Map();
    this.testServices = new Map();
    this.originalServices = new Map();
    
    if (this.testOptions.enableTestLogging) {
      this._setupTestLogging();
    }
  }

  /**
   * Register a service with test-specific configuration
   * @param {string} name - Service name
   * @param {Function|Object} implementation - Service implementation or factory
   * @param {Object} options - Registration options
   */
  registerTestService(name, implementation, options = {}) {
    const testOptions = {
      lifetime: 'transient', // Default to transient for testing
      mockDependencies: this.testOptions.mockExternalDependencies,
      ...options
    };
    
    // Store original service if it exists
    if (this.services.has(name)) {
      this.originalServices.set(name, this.services.get(name));
    }
    
    // Wrap implementation for test tracking
    const wrappedImplementation = this._wrapServiceForTesting(name, implementation, testOptions);
    
    this.register(name, wrappedImplementation, testOptions);
    this.testServices.set(name, { implementation: wrappedImplementation, options: testOptions });
    
    return this;
  }

  /**
   * Register a mock service
   * @param {string} name - Service name
   * @param {Object} mockImplementation - Mock implementation
   * @param {Object} options - Mock options
   */
  registerMock(name, mockImplementation, options = {}) {
    const mockOptions = {
      trackCalls: true,
      validateInterface: true,
      ...options
    };
    
    let mock = mockImplementation;
    
    // If it's a string, use the mock factory
    if (typeof mockImplementation === 'string') {
      mock = this._createMockFromFactory(mockImplementation, mockOptions);
    }
    
    // Wrap mock for additional test functionality
    if (mockOptions.trackCalls) {
      mock = this._wrapMockForTracking(name, mock);
    }
    
    this.testMocks.set(name, mock);
    this.register(name, mock, { lifetime: 'singleton' });
    
    return this;
  }

  /**
   * Create a test configuration with common mocks
   * @param {Object} config - Test configuration
   */
  setupTestConfiguration(config = {}) {
    const defaultConfig = {
      mockWindowAdapter: true,
      mockResourceAdapter: true,
      mockLogger: true,
      mockActionCallbacks: true,
      mockEventBus: true,
      mockStateManager: true,
      ...config
    };
    
    if (defaultConfig.mockWindowAdapter) {
      this.registerMock('windowAdapter', 'electron-window-adapter');
    }
    
    if (defaultConfig.mockResourceAdapter) {
      this.registerMock('resourceAdapter', 'electron-resource-adapter');
    }
    
    if (defaultConfig.mockLogger) {
      this.registerMock('logger', mockFactory.createMockLogger({ name: 'test-logger' }));
    }
    
    if (defaultConfig.mockActionCallbacks) {
      this.registerMock('actionCallbacks', 'action-callback-system');
    }
    
    if (defaultConfig.mockEventBus) {
      this.registerMock('eventBus', 'event-bus');
    }
    
    if (defaultConfig.mockStateManager) {
      this.registerMock('stateManager', 'state-manager');
    }
    
    return this;
  }

  /**
   * Get a test mock by name
   * @param {string} name - Mock name
   * @returns {Object|null} Mock object
   */
  getMock(name) {
    return this.testMocks.get(name) || null;
  }

  /**
   * Get all test mocks
   * @returns {Map} All test mocks
   */
  getAllMocks() {
    return new Map(this.testMocks);
  }

  /**
   * Reset all mocks to their initial state
   */
  resetMocks() {
    for (const mock of this.testMocks.values()) {
      if (mock._resetMock) {
        mock._resetMock();
      }
      
      // Reset mock functions
      Object.keys(mock).forEach(key => {
        if (mock[key] && mock[key]._isMockFunction) {
          mock[key].mockClear();
        }
      });
    }
    
    mockFactory.resetMocks();
  }

  /**
   * Verify mock interactions
   * @param {string} mockName - Mock name to verify
   * @param {Object} expectations - Expected interactions
   */
  verifyMock(mockName, expectations) {
    const mock = this.getMock(mockName);
    if (!mock) {
      throw new Error(`Mock '${mockName}' not found`);
    }
    
    const results = {
      mockName,
      passed: true,
      failures: []
    };
    
    // Verify method calls
    if (expectations.methodCalls) {
      for (const [method, expectedCalls] of Object.entries(expectations.methodCalls)) {
        if (!mock[method] || !mock[method]._isMockFunction) {
          results.failures.push(`Method '${method}' is not a mock function`);
          results.passed = false;
          continue;
        }
        
        const actualCalls = mock[method].calls.length;
        if (actualCalls !== expectedCalls) {
          results.failures.push(`Expected ${expectedCalls} calls to '${method}', got ${actualCalls}`);
          results.passed = false;
        }
      }
    }
    
    // Verify call arguments
    if (expectations.callArguments) {
      for (const [method, expectedArgs] of Object.entries(expectations.callArguments)) {
        if (mock[method] && mock[method]._isMockFunction) {
          const calls = mock[method].calls;
          if (calls.length > 0) {
            const lastCall = calls[calls.length - 1];
            if (!this._deepEqual(lastCall, expectedArgs)) {
              results.failures.push(`Expected call to '${method}' with args ${JSON.stringify(expectedArgs)}, got ${JSON.stringify(lastCall)}`);
              results.passed = false;
            }
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Create a snapshot of current mock states
   * @returns {Object} Mock state snapshot
   */
  createMockSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      mocks: {}
    };
    
    for (const [name, mock] of this.testMocks) {
      snapshot.mocks[name] = {
        type: mock._mockType || 'unknown',
        callHistory: mock._callHistory || [],
        mockCalls: this._extractMockCalls(mock)
      };
    }
    
    return snapshot;
  }

  /**
   * Restore services to their original state
   */
  restoreOriginalServices() {
    for (const [name, originalService] of this.originalServices) {
      this.register(name, originalService.implementation, originalService.options);
    }
    
    this.testServices.clear();
    this.testMocks.clear();
    this.originalServices.clear();
  }

  /**
   * Clean up test container
   */
  cleanup() {
    this.resetMocks();
    this.restoreOriginalServices();
    mockFactory.clearMocks();
    
    // Clear all services using the parent Container's clear method
    this.clear();
  }

  /**
   * Setup test-specific logging
   * @private
   */
  _setupTestLogging() {
    // Register a test logger that captures entries
    const testLogger = mockFactory.createMockLogger({ name: 'test-container' });
    this.register('logger', testLogger, { lifetime: 'singleton' });
  }

  /**
   * Wrap service for test tracking
   * @private
   */
  _wrapServiceForTesting(name, implementation, options) {
    if (typeof implementation === 'function') {
      // For factory functions, wrap the result
      return (...args) => {
        const service = implementation(...args);
        return this._addTestTracking(name, service);
      };
    } else {
      // For direct objects, add tracking
      return this._addTestTracking(name, implementation);
    }
  }

  /**
   * Add test tracking to a service
   * @private
   */
  _addTestTracking(name, service) {
    if (!service || typeof service !== 'object') {
      return service;
    }
    
    // Add test metadata
    service._testMetadata = {
      serviceName: name,
      createdAt: Date.now(),
      callCount: 0,
      lastAccessed: null
    };
    
    // Wrap methods for tracking
    Object.keys(service).forEach(key => {
      if (typeof service[key] === 'function' && !key.startsWith('_')) {
        const originalMethod = service[key];
        service[key] = (...args) => {
          service._testMetadata.callCount++;
          service._testMetadata.lastAccessed = Date.now();
          return originalMethod.apply(service, args);
        };
      }
    });
    
    return service;
  }

  /**
   * Create mock from factory
   * @private
   */
  _createMockFromFactory(mockType, options) {
    switch (mockType) {
      case 'electron-window-adapter':
        return mockFactory.createMockElectronWindowAdapter(options);
      case 'electron-resource-adapter':
        return mockFactory.createMockElectronResourceAdapter(options);
      case 'action-callback-system':
        return mockFactory.createMockActionCallbackSystem(options);
      case 'event-bus':
        return mockFactory.createMockEventBus(options);
      case 'state-manager':
        return mockFactory.createMockStateManager(options);
      default:
        throw new Error(`Unknown mock type: ${mockType}`);
    }
  }

  /**
   * Wrap mock for tracking
   * @private
   */
  _wrapMockForTracking(name, mock) {
    mock._testTracking = {
      name,
      createdAt: Date.now(),
      interactions: []
    };
    
    mock._resetMock = () => {
      mock._testTracking.interactions = [];
    };
    
    return mock;
  }

  /**
   * Extract mock calls for snapshot
   * @private
   */
  _extractMockCalls(mock) {
    const calls = {};
    
    Object.keys(mock).forEach(key => {
      if (mock[key] && mock[key]._isMockFunction) {
        calls[key] = {
          callCount: mock[key].calls.length,
          calls: mock[key].calls,
          results: mock[key].results
        };
      }
    });
    
    return calls;
  }

  /**
   * Deep equality check for test verification
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
 * Create a new test container with default configuration
 * @param {Object} options - Container options
 * @returns {TestContainer} New test container
 */
export function createTestContainer(options = {}) {
  return new TestContainer(options);
}