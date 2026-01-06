/**
 * Mock Factory for creating standardized mocks for platform adapters and external dependencies
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

import '../../../logger.js';

/**
 * Factory for creating mock platform adapters and external dependencies
 */
export class MockFactory {
  constructor() {
    this.createdMocks = new Map();
  }

  /**
   * Create a mock Electron window adapter
   * @param {Object} options - Mock configuration options
   * @returns {Object} Mock ElectronWindowAdapter
   */
  createMockElectronWindowAdapter(options = {}) {
    const mockId = 'electron-window-adapter';
    
    const mock = {
      // Window creation
      createWindow: this._createMockFunction(async (config) => {
        const mockWindow = this.createMockBrowserWindow(config);
        return mockWindow;
      }),
      
      // Window management
      destroyWindow: this._createMockFunction(async () => true),
      showWindow: this._createMockFunction(async () => true),
      hideWindow: this._createMockFunction(async () => true),
      moveWindow: this._createMockFunction(async () => true),
      resizeWindow: this._createMockFunction(async () => true),
      
      // Window queries
      getWindowBounds: this._createMockFunction(() => ({ x: 0, y: 0, width: 800, height: 600 })),
      isWindowVisible: this._createMockFunction(() => true),
      
      // Configuration
      validateConfig: this._createMockFunction(() => ({ isValid: true })),
      
      // Lifecycle
      initialize: this._createMockFunction(async () => true),
      cleanup: this._createMockFunction(async () => true),
      
      // Mock metadata
      _mockType: 'ElectronWindowAdapter',
      _mockId: mockId,
      _callHistory: [],
      
      // Override defaults with provided options
      ...options
    };
    
    // Track all method calls
    this._wrapMethodsForTracking(mock);
    this.createdMocks.set(mockId, mock);
    
    return mock;
  }

  /**
   * Create a mock Electron resource adapter
   * @param {Object} options - Mock configuration options
   * @returns {Object} Mock ElectronResourceAdapter
   */
  createMockElectronResourceAdapter(options = {}) {
    const mockId = 'electron-resource-adapter';
    
    const mock = {
      // File operations
      readFile: this._createMockFunction(async () => 'mock file content'),
      writeFile: this._createMockFunction(async () => true),
      deleteFile: this._createMockFunction(async () => true),
      exists: this._createMockFunction(async () => true),
      
      // Directory operations
      createDirectory: this._createMockFunction(async () => true),
      listDirectory: this._createMockFunction(async () => ['file1.txt', 'file2.txt']),
      
      // Path operations
      resolvePath: this._createMockFunction((path) => `/resolved/${path}`),
      validatePath: this._createMockFunction(() => ({ isValid: true })),
      
      // Watch operations
      watchFile: this._createMockFunction(() => ({ unwatch: this._createMockFunction() })),
      watchDirectory: this._createMockFunction(() => ({ unwatch: this._createMockFunction() })),
      
      // Cache operations
      clearCache: this._createMockFunction(async () => true),
      getCacheStats: this._createMockFunction(() => ({ size: 0, hits: 0, misses: 0 })),
      
      // Lifecycle
      initialize: this._createMockFunction(async () => true),
      cleanup: this._createMockFunction(async () => true),
      
      // Mock metadata
      _mockType: 'ElectronResourceAdapter',
      _mockId: mockId,
      _callHistory: [],
      
      // Override defaults with provided options
      ...options
    };
    
    this._wrapMethodsForTracking(mock);
    this.createdMocks.set(mockId, mock);
    
    return mock;
  }

  /**
   * Create a mock BrowserWindow
   * @param {Object} config - Window configuration
   * @returns {Object} Mock BrowserWindow
   */
  createMockBrowserWindow(config = {}) {
    const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const mock = {
      id: windowId,
      
      // Window properties
      getBounds: this._createMockFunction(() => ({ x: 0, y: 0, width: 800, height: 600 })),
      setBounds: this._createMockFunction(),
      getSize: this._createMockFunction(() => [800, 600]),
      setSize: this._createMockFunction(),
      getPosition: this._createMockFunction(() => [0, 0]),
      setPosition: this._createMockFunction(),
      
      // Visibility
      show: this._createMockFunction(),
      hide: this._createMockFunction(),
      isVisible: this._createMockFunction(() => true),
      
      // Content
      loadFile: this._createMockFunction(async () => true),
      loadURL: this._createMockFunction(async () => true),
      
      // Events
      on: this._createMockFunction(),
      once: this._createMockFunction(),
      removeListener: this._createMockFunction(),
      removeAllListeners: this._createMockFunction(),
      
      // Lifecycle
      close: this._createMockFunction(),
      destroy: this._createMockFunction(),
      isDestroyed: this._createMockFunction(() => false),
      
      // Web contents
      webContents: {
        send: this._createMockFunction(),
        on: this._createMockFunction(),
        once: this._createMockFunction(),
        removeListener: this._createMockFunction()
      },
      
      // Mock metadata
      _mockType: 'BrowserWindow',
      _mockId: windowId,
      _config: config
    };
    
    return mock;
  }

  /**
   * Create a mock logger for testing
   * @param {Object} options - Logger configuration
   * @returns {Object} Mock Logger
   */
  createMockLogger(options = {}) {
    const loggerId = `logger-${Date.now()}`;
    
    const mock = {
      debug: this._createMockFunction(),
      info: this._createMockFunction(),
      warn: this._createMockFunction(),
      error: this._createMockFunction(),
      
      // Logger metadata
      name: options.name || 'test-logger',
      level: options.level || 'debug',
      
      // Mock metadata
      _mockType: 'Logger',
      _mockId: loggerId,
      _entries: []
    };
    
    // Track log entries
    ['debug', 'info', 'warn', 'error'].forEach(level => {
      const originalMethod = mock[level];
      mock[level] = this._createMockFunction((...args) => {
        mock._entries.push({
          level,
          timestamp: Date.now(),
          args
        });
        return originalMethod(...args);
      });
    });
    
    this.createdMocks.set(loggerId, mock);
    return mock;
  }

  /**
   * Create a mock action callback system
   * @param {Object} options - Configuration options
   * @returns {Object} Mock ActionCallbackSystem
   */
  createMockActionCallbackSystem(options = {}) {
    const systemId = 'action-callback-system';
    
    const mock = {
      // Callback registration
      registerCallback: this._createMockFunction(() => 'callback-id'),
      unregisterCallback: this._createMockFunction(() => true),
      
      // Callback execution
      executeCallbacks: this._createMockFunction(async () => ({ prevented: false })),
      
      // Middleware
      addMiddleware: this._createMockFunction(),
      removeMiddleware: this._createMockFunction(),
      
      // Query methods
      getCallbackCount: this._createMockFunction(() => 0),
      hasCallbacks: this._createMockFunction(() => false),
      
      // Mock metadata
      _mockType: 'ActionCallbackSystem',
      _mockId: systemId,
      _callbacks: new Map(),
      _executions: []
    };
    
    // Track callback executions
    const originalExecute = mock.executeCallbacks;
    mock.executeCallbacks = this._createMockFunction(async (action, context) => {
      mock._executions.push({ action, context, timestamp: Date.now() });
      return originalExecute(action, context);
    });
    
    this.createdMocks.set(systemId, mock);
    return mock;
  }

  /**
   * Create a mock event bus
   * @param {Object} options - Configuration options
   * @returns {Object} Mock EventBus
   */
  createMockEventBus(options = {}) {
    const busId = 'event-bus';
    
    const mock = {
      // Event operations
      emit: this._createMockFunction(),
      on: this._createMockFunction(() => 'subscription-id'),
      off: this._createMockFunction(() => true),
      once: this._createMockFunction(() => 'subscription-id'),
      
      // Pattern matching
      subscribe: this._createMockFunction(() => 'subscription-id'),
      unsubscribe: this._createMockFunction(() => true),
      
      // Query methods
      getSubscriberCount: this._createMockFunction(() => 0),
      hasSubscribers: this._createMockFunction(() => false),
      
      // Mock metadata
      _mockType: 'EventBus',
      _mockId: busId,
      _events: [],
      _subscribers: new Map()
    };
    
    // Track emitted events
    const originalEmit = mock.emit;
    mock.emit = this._createMockFunction((event, data) => {
      mock._events.push({ event, data, timestamp: Date.now() });
      return originalEmit(event, data);
    });
    
    this.createdMocks.set(busId, mock);
    return mock;
  }

  /**
   * Create a mock state manager
   * @param {Object} options - Configuration options
   * @returns {Object} Mock StateManager
   */
  createMockStateManager(options = {}) {
    const managerId = 'state-manager';
    
    const mock = {
      // State operations
      get: this._createMockFunction(() => null),
      set: this._createMockFunction(() => true),
      delete: this._createMockFunction(() => true),
      has: this._createMockFunction(() => false),
      
      // Subscription
      subscribe: this._createMockFunction(() => 'subscription-id'),
      unsubscribe: this._createMockFunction(() => true),
      
      // Transactions
      beginTransaction: this._createMockFunction(() => 'transaction-id'),
      commitTransaction: this._createMockFunction(() => true),
      rollbackTransaction: this._createMockFunction(() => true),
      
      // Mock metadata
      _mockType: 'StateManager',
      _mockId: managerId,
      _state: new Map(),
      _changes: []
    };
    
    this.createdMocks.set(managerId, mock);
    return mock;
  }

  /**
   * Get a created mock by ID
   * @param {string} mockId - Mock identifier
   * @returns {Object|null} Mock object or null if not found
   */
  getMock(mockId) {
    return this.createdMocks.get(mockId) || null;
  }

  /**
   * Get all created mocks
   * @returns {Map} Map of all created mocks
   */
  getAllMocks() {
    return new Map(this.createdMocks);
  }

  /**
   * Clear all created mocks
   */
  clearMocks() {
    this.createdMocks.clear();
  }

  /**
   * Reset all mock call history
   */
  resetMocks() {
    for (const mock of this.createdMocks.values()) {
      if (mock._callHistory) {
        mock._callHistory.length = 0;
      }
      
      // Reset mock functions
      Object.keys(mock).forEach(key => {
        if (mock[key] && mock[key]._isMockFunction) {
          mock[key].mockClear();
        }
      });
    }
  }

  /**
   * Wrap methods for call tracking
   * @private
   */
  _wrapMethodsForTracking(mock) {
    Object.keys(mock).forEach(key => {
      if (typeof mock[key] === 'function' && !key.startsWith('_') && mock[key]._isMockFunction) {
        const originalFn = mock[key];
        mock[key] = this._createMockFunction((...args) => {
          mock._callHistory.push({
            method: key,
            args,
            timestamp: Date.now()
          });
          return originalFn(...args);
        });
      }
    });
  }

  /**
   * Create a mock function that works with or without Jest
   * @private
   */
  _createMockFunction(implementation) {
    const mockFn = (...args) => {
      mockFn.calls.push(args);
      mockFn.callCount++;
      mockFn.lastCall = args;
      
      try {
        const result = implementation ? implementation(...args) : undefined;
        mockFn.results.push({ type: 'return', value: result });
        return result;
      } catch (error) {
        mockFn.results.push({ type: 'throw', value: error });
        throw error;
      }
    };
    
    // Mock function metadata
    mockFn.calls = [];
    mockFn.results = [];
    mockFn.callCount = 0;
    mockFn.lastCall = null;
    mockFn._isMockFunction = true;
    
    // Jest compatibility
    if (typeof jest !== 'undefined' && jest.fn) {
      const jestMock = jest.fn(implementation);
      jestMock._isMockFunction = true;
      return jestMock;
    }
    
    // Mock Jest-like methods for compatibility
    mockFn.mockClear = () => {
      mockFn.calls = [];
      mockFn.results = [];
      mockFn.callCount = 0;
      mockFn.lastCall = null;
    };
    
    mockFn.mockImplementation = (newImpl) => {
      implementation = newImpl;
      return mockFn;
    };
    
    mockFn.mockReturnValue = (value) => {
      implementation = () => value;
      return mockFn;
    };
    
    mockFn.mockResolvedValue = (value) => {
      implementation = async () => value;
      return mockFn;
    };
    
    mockFn.mockRejectedValue = (error) => {
      implementation = async () => { throw error; };
      return mockFn;
    };
    
    // Jest-like mock property
    mockFn.mock = {
      get calls() { return mockFn.calls; },
      get results() { return mockFn.results; }
    };
    
    return mockFn;
  }
}

// Export singleton instance
export const mockFactory = new MockFactory();