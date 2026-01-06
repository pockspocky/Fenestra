# Foundational Module Abstraction Proposal

## Current State Analysis

The Fenestra project has good modular structure but suffers from:
- **Tight coupling** between modules
- **Hardcoded dependencies** (e.g., direct Electron imports)
- **Limited reusability** outside the specific game context
- **Mixed concerns** within single modules
- **No clear abstraction layers**

## Proposed Abstraction Architecture

### 1. Core Abstraction Layers

```
┌─────────────────────────────────────────┐
│           Application Layer             │  ← Game-specific logic
├─────────────────────────────────────────┤
│           Service Layer                 │  ← Business logic services
├─────────────────────────────────────────┤
│           Foundation Layer              │  ← Reusable abstractions
├─────────────────────────────────────────┤
│           Platform Layer                │  ← Platform-specific adapters
└─────────────────────────────────────────┘
```

### 2. Foundation Layer Modules

#### A. Event System Foundation (`src/foundation/events/`)

**Current**: Callback system tied to specific game events
**Proposed**: Generic, extensible event system with universal action callbacks

```javascript
// src/foundation/events/EventBus.js
export class EventBus {
  constructor(options = {}) {
    this.events = new Map();
    this.middleware = [];
    this.options = { errorIsolation: true, ...options };
  }
  
  // Generic event registration
  on(eventPattern, handler, options = {}) { }
  off(registrationId) { }
  emit(eventName, payload) { }
  
  // Middleware support
  use(middleware) { }
  
  // Pattern matching for events
  onPattern(pattern, handler, options = {}) { }
}

// src/foundation/events/EventRegistry.js
export class EventRegistry {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.schemas = new Map();
  }
  
  // Register event schemas for validation
  registerEventSchema(eventType, schema) { }
  
  // Type-safe event emission
  emit(eventType, payload) { }
}

// src/foundation/events/ActionCallbackSystem.js
export class ActionCallbackSystem {
  constructor(options = {}) {
    this.callbacks = new Map();
    this.defaultCallback = options.defaultCallback || this.createDefaultLogger();
    this.globalCallbacks = [];
    this.middleware = [];
  }
  
  // Register action-specific callbacks
  registerActionCallback(actionName, callback, options = {}) {
    if (!this.callbacks.has(actionName)) {
      this.callbacks.set(actionName, []);
    }
    
    const registration = {
      id: this.generateId(),
      callback,
      priority: options.priority || 0,
      once: options.once || false,
      condition: options.condition || (() => true)
    };
    
    this.callbacks.get(actionName).push(registration);
    this.sortCallbacksByPriority(actionName);
    
    return registration.id;
  }
  
  // Register global callbacks (execute for all actions)
  registerGlobalCallback(callback, options = {}) {
    const registration = {
      id: this.generateId(),
      callback,
      priority: options.priority || 0,
      condition: options.condition || (() => true)
    };
    
    this.globalCallbacks.push(registration);
    this.globalCallbacks.sort((a, b) => b.priority - a.priority);
    
    return registration.id;
  }
  
  // Execute callbacks for an action
  async executeAction(actionName, context = {}) {
    const actionContext = {
      action: actionName,
      timestamp: Date.now(),
      ...context
    };
    
    // Execute middleware (before)
    for (const middleware of this.middleware) {
      if (middleware.before) {
        await middleware.before(actionContext);
      }
    }
    
    // Execute global callbacks first
    await this.executeCallbacks(this.globalCallbacks, actionContext);
    
    // Execute action-specific callbacks
    const actionCallbacks = this.callbacks.get(actionName) || [];
    await this.executeCallbacks(actionCallbacks, actionContext);
    
    // If no specific callbacks, use default
    if (actionCallbacks.length === 0 && this.globalCallbacks.length === 0) {
      await this.defaultCallback(actionContext);
    }
    
    // Execute middleware (after)
    for (const middleware of this.middleware) {
      if (middleware.after) {
        await middleware.after(actionContext);
      }
    }
    
    return actionContext;
  }
  
  // Create default logging callback
  createDefaultLogger() {
    return (context) => {
      console.log(`[ACTION] ${context.action}`, {
        timestamp: new Date(context.timestamp).toISOString(),
        data: context.data || {},
        source: context.source || 'unknown'
      });
    };
  }
  
  // Helper methods
  async executeCallbacks(callbacks, context) {
    for (const registration of callbacks) {
      try {
        if (registration.condition(context)) {
          await registration.callback(context);
          
          if (registration.once) {
            this.unregister(registration.id);
          }
        }
      } catch (error) {
        console.error(`Callback error for action ${context.action}:`, error);
      }
    }
  }
  
  unregister(registrationId) {
    // Remove from action-specific callbacks
    for (const [actionName, callbacks] of this.callbacks) {
      const index = callbacks.findIndex(cb => cb.id === registrationId);
      if (index !== -1) {
        callbacks.splice(index, 1);
        return true;
      }
    }
    
    // Remove from global callbacks
    const globalIndex = this.globalCallbacks.findIndex(cb => cb.id === registrationId);
    if (globalIndex !== -1) {
      this.globalCallbacks.splice(globalIndex, 1);
      return true;
    }
    
    return false;
  }
  
  sortCallbacksByPriority(actionName) {
    const callbacks = this.callbacks.get(actionName);
    if (callbacks) {
      callbacks.sort((a, b) => b.priority - a.priority);
    }
  }
  
  generateId() {
    return `callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### B. State Management Foundation (`src/foundation/state/`)

**Current**: Scattered state across modules
**Proposed**: Centralized, observable state management

```javascript
// src/foundation/state/StateManager.js
export class StateManager {
  constructor(initialState = {}, options = {}) {
    this.state = new Proxy(initialState, this.createStateProxy());
    this.subscribers = new Map();
    this.middleware = [];
    this.history = options.enableHistory ? [] : null;
  }
  
  // State access
  getState(path) { }
  setState(path, value) { }
  
  // Subscriptions
  subscribe(path, callback) { }
  unsubscribe(subscriptionId) { }
  
  // Transactions
  transaction(fn) { }
  
  // History (undo/redo)
  undo() { }
  redo() { }
}

// src/foundation/state/StateStore.js
export class StateStore {
  constructor(stateManager, persistenceAdapter) {
    this.stateManager = stateManager;
    this.persistence = persistenceAdapter;
  }
  
  async save(key) { }
  async load(key) { }
  async delete(key) { }
}
```

#### C. Window Management Foundation (`src/foundation/windows/`)

**Current**: Electron-specific window management
**Proposed**: Platform-agnostic window abstraction

```javascript
// src/foundation/windows/WindowManager.js
export class WindowManager {
  constructor(platformAdapter, options = {}) {
    this.platform = platformAdapter;
    this.windows = new Map();
    this.eventBus = options.eventBus;
    this.stateManager = options.stateManager;
  }
  
  async createWindow(config) { }
  async destroyWindow(id) { }
  getWindow(id) { }
  getAllWindows() { }
  
  // Layout management
  arrangeWindows(strategy) { }
  preventOverlap(windowId, threshold) { }
}

// src/foundation/windows/WindowConfig.js
export class WindowConfig {
  constructor(config = {}) {
    this.validate(config);
    Object.assign(this, this.getDefaults(), config);
  }
  
  validate(config) { }
  getDefaults() { }
  merge(otherConfig) { }
}

// src/foundation/windows/LayoutEngine.js
export class LayoutEngine {
  constructor(strategies = {}) {
    this.strategies = new Map(Object.entries(strategies));
  }
  
  addStrategy(name, strategy) { }
  applyLayout(windows, strategyName, options) { }
  calculateOptimalPosition(window, existingWindows) { }
}
```

#### D. Resource Management Foundation (`src/foundation/resources/`)

**Current**: Direct file system access
**Proposed**: Abstract resource management

```javascript
// src/foundation/resources/ResourceManager.js
export class ResourceManager {
  constructor(adapters = {}) {
    this.adapters = new Map(Object.entries(adapters));
    this.cache = new Map();
    this.watchers = new Map();
  }
  
  async load(resourcePath, options = {}) { }
  async save(resourcePath, data, options = {}) { }
  async delete(resourcePath) { }
  async exists(resourcePath) { }
  
  // Caching
  enableCache(resourcePath, options = {}) { }
  clearCache(pattern) { }
  
  // Watching
  watch(resourcePath, callback) { }
  unwatch(watchId) { }
}

// src/foundation/resources/ResourceAdapter.js
export class ResourceAdapter {
  async load(path) { throw new Error('Not implemented'); }
  async save(path, data) { throw new Error('Not implemented'); }
  async delete(path) { throw new Error('Not implemented'); }
  async exists(path) { throw new Error('Not implemented'); }
  async list(path) { throw new Error('Not implemented'); }
}
```

#### E. Logging System Foundation (`src/foundation/logging/`)

**Current**: Global console override with inconsistent patterns and performance issues
**Proposed**: Structured, configurable logging system with proper abstraction

```javascript
// src/foundation/logging/Logger.js
export class Logger {
  constructor(name, options = {}) {
    this.name = name;
    this.level = options.level || 'info';
    this.transports = options.transports || [];
    this.context = options.context || {};
    this.middleware = [];
  }
  
  // Core logging methods with lazy evaluation
  debug(message, meta) {
    this.log('debug', message, meta);
  }
  
  info(message, meta) {
    this.log('info', message, meta);
  }
  
  warn(message, meta) {
    this.log('warn', message, meta);
  }
  
  error(message, meta) {
    this.log('error', message, meta);
  }
  
  // Main logging method with performance optimization
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;
    
    // Lazy evaluation support
    const resolvedMessage = typeof message === 'function' ? message() : message;
    const resolvedMeta = typeof meta === 'function' ? meta() : meta;
    
    const logEntry = this.createLogEntry(level, resolvedMessage, resolvedMeta);
    
    // Apply middleware
    let processedEntry = logEntry;
    for (const middleware of this.middleware) {
      try {
        processedEntry = middleware(processedEntry) || processedEntry;
      } catch (error) {
        // Middleware errors shouldn't break logging
        this.fallbackLog('Middleware error in logger', { error: error.message });
      }
    }
    
    // Send to transports
    this.transports.forEach(transport => {
      try {
        transport.log(processedEntry);
      } catch (error) {
        this.fallbackLog('Transport error in logger', { 
          transport: transport.constructor.name,
          error: error.message 
        });
      }
    });
  }
  
  // Performance-optimized level checking
  shouldLog(level) {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.level);
  }
  
  createLogEntry(level, message, meta) {
    return {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      meta: { ...this.context, ...meta },
      pid: process.pid,
      version: process.env.npm_package_version || '1.0.0'
    };
  }
  
  // Child logger creation for module-specific contexts
  child(context) {
    return new Logger(this.name, {
      level: this.level,
      transports: this.transports,
      context: { ...this.context, ...context }
    });
  }
  
  // Middleware support
  use(middleware) {
    this.middleware.push(middleware);
  }
  
  // Safe fallback logging
  fallbackLog(message, meta) {
    try {
      console.error(`[LOGGER_FALLBACK] ${message}`, meta);
    } catch (error) {
      // Last resort - do nothing to prevent infinite loops
    }
  }
  
  getLevelPriority(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
    return levels[level] || 1;
  }
}

// src/foundation/logging/LoggerFactory.js
export class LoggerFactory {
  constructor(config = {}) {
    this.config = config;
    this.loggers = new Map();
    this.transports = this.createTransports(config.transports || []);
  }
  
  createLogger(name, options = {}) {
    if (this.loggers.has(name)) {
      return this.loggers.get(name);
    }
    
    const loggerConfig = {
      level: options.level || this.config.modules?.[name] || this.config.level || 'info',
      transports: this.transports,
      context: options.context || {}
    };
    
    const logger = new Logger(name, loggerConfig);
    this.loggers.set(name, logger);
    
    return logger;
  }
  
  createTransports(transportConfigs) {
    return transportConfigs.map(config => {
      switch (config.type) {
        case 'console':
          return new ConsoleTransport(config);
        case 'file':
          return new FileTransport(config);
        case 'remote':
          return new RemoteTransport(config);
        default:
          throw new Error(`Unknown transport type: ${config.type}`);
      }
    });
  }
  
  // Update configuration at runtime
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update existing loggers
    for (const [name, logger] of this.loggers) {
      const newLevel = newConfig.modules?.[name] || newConfig.level;
      if (newLevel) {
        logger.level = newLevel;
      }
    }
  }
  
  // Get all loggers for debugging
  getAllLoggers() {
    return Array.from(this.loggers.entries());
  }
}

// src/foundation/logging/transports/ConsoleTransport.js
export class ConsoleTransport {
  constructor(options = {}) {
    this.level = options.level || 'debug';
    this.format = options.format || 'json';
    this.colors = options.colors !== false;
  }
  
  log(entry) {
    if (!this.shouldLog(entry.level)) return;
    
    const formatted = this.format === 'pretty' 
      ? this.formatPretty(entry)
      : this.formatJSON(entry);
    
    const method = this.getConsoleMethod(entry.level);
    method(formatted);
  }
  
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }
  
  formatPretty(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const logger = entry.logger.padEnd(15);
    
    let formatted = `${timestamp} ${level} [${logger}] ${entry.message}`;
    
    if (Object.keys(entry.meta).length > 0) {
      formatted += ` ${JSON.stringify(entry.meta)}`;
    }
    
    return this.colors ? this.colorize(formatted, entry.level) : formatted;
  }
  
  formatJSON(entry) {
    return JSON.stringify(entry);
  }
  
  colorize(text, level) {
    const colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m'  // red
    };
    const reset = '\x1b[0m';
    
    return `${colors[level] || ''}${text}${reset}`;
  }
  
  getConsoleMethod(level) {
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }
}

// src/foundation/logging/transports/FileTransport.js
export class FileTransport {
  constructor(options = {}) {
    this.filename = options.filename || 'app.log';
    this.level = options.level || 'info';
    this.maxSize = this.parseSize(options.maxSize || '10MB');
    this.maxFiles = options.maxFiles || 5;
    this.format = options.format || 'json';
  }
  
  async log(entry) {
    if (!this.shouldLog(entry.level)) return;
    
    const formatted = this.format === 'json' 
      ? JSON.stringify(entry) + '\n'
      : this.formatText(entry) + '\n';
    
    await this.writeToFile(formatted);
  }
  
  async writeToFile(content) {
    try {
      const fs = await import('fs/promises');
      
      // Check file size and rotate if needed
      await this.rotateIfNeeded();
      
      await fs.appendFile(this.filename, content, 'utf8');
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('[FILE_TRANSPORT] Failed to write log:', error.message);
    }
  }
  
  async rotateIfNeeded() {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.filename);
      
      if (stats.size >= this.maxSize) {
        await this.rotateFiles();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }
  
  async rotateFiles() {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Remove oldest file
    const oldestFile = `${this.filename}.${this.maxFiles}`;
    try {
      await fs.unlink(oldestFile);
    } catch (error) {
      // File doesn't exist, ignore
    }
    
    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldFile = i === 1 ? this.filename : `${this.filename}.${i}`;
      const newFile = `${this.filename}.${i + 1}`;
      
      try {
        await fs.rename(oldFile, newFile);
      } catch (error) {
        // File doesn't exist, continue
      }
    }
  }
  
  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
    
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }
    
    const [, size, unit] = match;
    return parseInt(size) * units[unit.toUpperCase()];
  }
  
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }
  
  formatText(entry) {
    return `${entry.timestamp} ${entry.level.toUpperCase()} [${entry.logger}] ${entry.message} ${JSON.stringify(entry.meta)}`;
  }
}

// src/foundation/logging/middleware/ActionLoggingMiddleware.js
export class ActionLoggingMiddleware {
  constructor(actionCallbacks) {
    this.actionCallbacks = actionCallbacks;
  }
  
  // Middleware function that integrates with action callback system
  middleware(logEntry) {
    // Trigger action callback for logging events
    if (this.actionCallbacks) {
      this.actionCallbacks.executeAction('log:entry', {
        source: 'LoggingSystem',
        data: {
          level: logEntry.level,
          logger: logEntry.logger,
          message: logEntry.message,
          meta: logEntry.meta
        },
        phase: 'after'
      }).catch(error => {
        // Don't let action callback errors break logging
        console.error('[ACTION_LOGGING_MIDDLEWARE] Error:', error.message);
      });
    }
    
    return logEntry;
  }
}
```

#### F. Plugin System Foundation (`src/foundation/plugins/`)

**Current**: No plugin system
**Proposed**: Extensible plugin architecture

```javascript
// src/foundation/plugins/PluginManager.js
export class PluginManager {
  constructor(context) {
    this.context = context;
    this.plugins = new Map();
    this.hooks = new Map();
    this.dependencies = new Map();
    this.logger = context.logger || console;
  }
  
  async loadPlugin(pluginConfig) { }
  async unloadPlugin(pluginId) { }
  
  // Hook system
  registerHook(hookName, callback, options = {}) { }
  executeHook(hookName, payload) { }
  
  // Plugin communication
  getPluginAPI(pluginId) { }
  broadcastMessage(message, excludePlugins = []) { }
}

// src/foundation/plugins/Plugin.js
export class Plugin {
  constructor(id, config = {}) {
    this.id = id;
    this.config = config;
    this.hooks = new Map();
    this.api = {};
    this.logger = config.logger;
  }
  
  async initialize(context) { }
  async destroy() { }
  
  // Hook registration
  onHook(hookName, callback) { }
  
  // API exposure
  exposeAPI(methods) { }
}
```

### 3. Platform Adapters (`src/platform/`)

#### Electron Adapter (`src/platform/electron/`)

```javascript
// src/platform/electron/ElectronWindowAdapter.js
export class ElectronWindowAdapter {
  constructor() {
    this.BrowserWindow = require('electron').BrowserWindow;
  }
  
  async createWindow(config) {
    const window = new this.BrowserWindow(config.toElectronConfig());
    return new ElectronWindowWrapper(window);
  }
}

// src/platform/electron/ElectronResourceAdapter.js
export class ElectronResourceAdapter extends ResourceAdapter {
  async load(path) {
    const fs = require('fs/promises');
    return await fs.readFile(path, 'utf8');
  }
  
  async save(path, data) {
    const fs = require('fs/promises');
    await fs.writeFile(path, data, 'utf8');
  }
}
```

### 4. Service Layer (`src/services/`)

#### Game Services built on Foundation

```javascript
// src/services/GameWindowService.js
export class GameWindowService {
  constructor(windowManager, eventBus, stateManager) {
    this.windowManager = windowManager;
    this.eventBus = eventBus;
    this.stateManager = stateManager;
  }
  
  async createDoor(id, config) {
    const windowConfig = new WindowConfig({
      ...config,
      type: 'door',
      template: 'door.html'
    });
    
    const window = await this.windowManager.createWindow(windowConfig);
    
    // Game-specific logic
    await this.initializeDoorBehavior(window, config);
    
    return window;
  }
}

// src/services/PuzzleService.js
export class PuzzleService {
  constructor(dependencies) {
    this.windowService = dependencies.windowService;
    this.stateManager = dependencies.stateManager;
    this.eventBus = dependencies.eventBus;
  }
  
  async createPuzzle(puzzleConfig) { }
  async solvePuzzle(puzzleId, solution) { }
  async getPuzzleState(puzzleId) { }
}
```

### 5. Dependency Injection Container

```javascript
// src/foundation/di/Container.js
export class Container {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
  }
  
  register(name, factory, options = {}) { }
  registerSingleton(name, factory) { }
  registerInstance(name, instance) { }
  
  resolve(name) { }
  resolveAll(pattern) { }
  
  // Auto-wiring
  autowire(constructor) { }
}

// Usage in main.js
const container = new Container();

// Register logging system first (foundation for everything else)
container.registerSingleton('loggingConfig', () => ({
  level: process.env.LOG_LEVEL || 'info',
  modules: {
    'WindowManager': 'debug',
    'DoorKeySystem': 'info',
    'GameLogic': 'info',
    'WorkerManager': 'warn',
    'ActionCallbacks': 'debug'
  },
  transports: [
    {
      type: 'console',
      level: 'debug',
      format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json',
      colors: true
    },
    {
      type: 'file',
      level: 'info',
      filename: 'logs/fenestra.log',
      maxSize: '10MB',
      maxFiles: 5,
      format: 'json'
    }
  ]
}));

container.registerSingleton('loggerFactory', (c) => {
  return new LoggerFactory(c.resolve('loggingConfig'));
});

// Register action callback system with logging integration
container.registerSingleton('actionCallbacks', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('ActionCallbacks');
  
  return new ActionCallbackSystem({
    logger,
    defaultCallback: (context) => {
      logger.info(`Action executed: ${context.action}`, {
        source: context.source,
        phase: context.phase,
        success: context.success,
        data: context.data,
        duration: context.duration
      });
    }
  });
});

// Register platform adapters with logging
container.registerSingleton('windowAdapter', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('ElectronWindowAdapter');
  return new ElectronWindowAdapter({ logger });
});

container.registerSingleton('resourceAdapter', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('ElectronResourceAdapter');
  return new ElectronResourceAdapter({ logger });
});

// Register foundation services with logging
container.registerSingleton('eventBus', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('EventBus');
  return new EventBus({ logger });
});

container.registerSingleton('stateManager', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('StateManager');
  return new StateManager({}, {
    eventBus: c.resolve('eventBus'),
    actionCallbacks: c.resolve('actionCallbacks'),
    logger
  });
});

container.registerSingleton('windowManager', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('WindowManager');
  return new WindowManager(
    c.resolve('windowAdapter'),
    { 
      eventBus: c.resolve('eventBus'),
      actionCallbacks: c.resolve('actionCallbacks'),
      logger
    }
  );
});

// Register game services with logging
container.register('gameWindowService', (c) => {
  const loggerFactory = c.resolve('loggerFactory');
  const logger = loggerFactory.createLogger('GameWindowService');
  return new GameWindowService(
    c.resolve('windowManager'),
    c.resolve('eventBus'),
    c.resolve('stateManager'),
    c.resolve('actionCallbacks'),
    logger
  );
});

// Setup logging middleware for action callbacks
const actionCallbacks = container.resolve('actionCallbacks');
const loggerFactory = container.resolve('loggerFactory');

// Add action logging middleware to all loggers
const actionLoggingMiddleware = new ActionLoggingMiddleware(actionCallbacks);
loggerFactory.getAllLoggers().forEach(([name, logger]) => {
  logger.use(actionLoggingMiddleware.middleware.bind(actionLoggingMiddleware));
});
```

## Logging System Integration Requirements

### Universal Logging Standards

Every module in the abstracted system must use the structured logging system instead of direct console calls:

#### Core Logging Principles
- **No Direct Console Usage**: All modules must use logger instances instead of `console.log/warn/error/debug`
- **Structured Logging**: All log entries must include structured metadata
- **Performance Optimization**: Lazy evaluation for expensive log operations
- **Error Resilience**: Logging failures must not break application functionality
- **Action Integration**: All significant operations must trigger both logging and action callbacks

#### Module Integration Pattern

Every abstracted module must follow this logging integration pattern:

```javascript
// Example: Enhanced Window Manager with Integrated Logging
export class WindowManager {
  constructor(platformAdapter, options = {}) {
    this.platform = platformAdapter;
    this.actionCallbacks = options.actionCallbacks;
    this.logger = options.logger; // Injected logger instance
    this.windows = new Map();
  }
  
  async createWindow(config) {
    const startTime = performance.now();
    
    // Log operation start with structured data
    this.logger.info('Creating window', {
      operation: 'createWindow',
      windowId: config.id,
      config: {
        width: config.width,
        height: config.height,
        type: config.type
      }
    });
    
    // Execute action callback (integrates with action system)
    await this.actionCallbacks.executeAction('window:create', {
      source: 'WindowManager',
      data: { config },
      phase: 'before'
    });
    
    try {
      const window = await this.platform.createWindow(config);
      this.windows.set(config.id, window);
      
      const duration = performance.now() - startTime;
      
      // Log successful completion with metrics
      this.logger.info('Window created successfully', {
        operation: 'createWindow',
        windowId: config.id,
        duration: `${duration.toFixed(2)}ms`,
        windowCount: this.windows.size,
        bounds: window.getBounds()
      });
      
      // Action callback for success
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, window, duration },
        phase: 'after',
        success: true
      });
      
      return window;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Structured error logging with full context
      this.logger.error('Window creation failed', {
        operation: 'createWindow',
        windowId: config.id,
        duration: `${duration.toFixed(2)}ms`,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        },
        config,
        recovery: {
          attempted: false,
          suggestions: ['Check window configuration', 'Verify platform adapter']
        }
      });
      
      // Action callback for error
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, error: error.message, duration },
        phase: 'error',
        success: false
      });
      
      throw error;
    }
  }
  
  // Lazy logging for performance-sensitive operations
  async moveWindow(windowId, x, y) {
    // Only log if debug level is enabled
    this.logger.debug(() => `Moving window ${windowId} to position (${x}, ${y})`, () => ({
      operation: 'moveWindow',
      windowId,
      position: { x, y },
      previousPosition: this.windows.get(windowId)?.getBounds()
    }));
    
    // Implementation...
  }
}

// Example: State Manager with Integrated Logging
export class StateManager {
  constructor(initialState = {}, options = {}) {
    this.state = new Proxy(initialState, this.createStateProxy());
    this.logger = options.logger;
    this.actionCallbacks = options.actionCallbacks;
    this.subscribers = new Map();
  }
  
  async setState(path, value) {
    const oldValue = this.getState(path);
    
    this.logger.debug('State update initiated', {
      operation: 'setState',
      path,
      oldValue,
      newValue: value,
      changeType: oldValue === undefined ? 'create' : 'update'
    });
    
    await this.actionCallbacks.executeAction('state:update', {
      source: 'StateManager',
      data: { path, oldValue, newValue: value },
      phase: 'before'
    });
    
    try {
      this.setStateInternal(path, value);
      
      this.logger.info('State updated successfully', {
        operation: 'setState',
        path,
        changeType: oldValue === undefined ? 'create' : 'update',
        subscriberCount: this.getSubscriberCount(path)
      });
      
      await this.actionCallbacks.executeAction('state:update', {
        source: 'StateManager',
        data: { path, oldValue, newValue: value },
        phase: 'after',
        success: true
      });
    } catch (error) {
      this.logger.error('State update failed', {
        operation: 'setState',
        path,
        error: {
          message: error.message,
          stack: error.stack
        },
        attemptedValue: value
      });
      
      await this.actionCallbacks.executeAction('state:update', {
        source: 'StateManager',
        data: { path, oldValue, newValue: value, error: error.message },
        phase: 'error',
        success: false
      });
      
      throw error;
    }
  }
}
```

### Configuration-Driven Logging Behavior

The logging system must be fully configurable to support different deployment scenarios:

```javascript
// Development Configuration
const developmentLoggingConfig = {
  level: 'debug',
  modules: {
    'WindowManager': 'debug',
    'DoorKeySystem': 'debug',
    'GameLogic': 'info',
    'ActionCallbacks': 'debug'
  },
  transports: [
    {
      type: 'console',
      level: 'debug',
      format: 'pretty',
      colors: true
    }
  ]
};

// Production Configuration
const productionLoggingConfig = {
  level: 'warn',
  modules: {
    'WindowManager': 'info',
    'DoorKeySystem': 'info',
    'GameLogic': 'warn',
    'ActionCallbacks': 'error'
  },
  transports: [
    {
      type: 'console',
      level: 'error',
      format: 'json',
      colors: false
    },
    {
      type: 'file',
      level: 'info',
      filename: 'logs/fenestra.log',
      maxSize: '50MB',
      maxFiles: 10,
      format: 'json'
    },
    {
      type: 'remote',
      level: 'error',
      endpoint: 'https://logging.example.com/api/logs',
      apiKey: process.env.LOGGING_API_KEY
    }
  ]
};

// Testing Configuration
const testLoggingConfig = {
  level: 'error',
  modules: {},
  transports: [
    {
      type: 'console',
      level: 'error',
      format: 'json',
      colors: false
    }
  ]
};
```

### Migration from Current Logging System

The abstraction includes a migration strategy to replace the current problematic logging:

#### Phase 1: Logger Factory Setup
1. Create `LoggerFactory` and configure transports
2. Replace global console override with proper logger instances
3. Update `loggerConfig.js` to use new system

#### Phase 2: Module-by-Module Migration
1. Inject logger instances into each module constructor
2. Replace all `console.*` calls with structured logging
3. Add lazy evaluation for performance-sensitive logs
4. Integrate with action callback system

#### Phase 3: Enhanced Features
1. Add file rotation and remote logging
2. Implement log aggregation and search
3. Add performance monitoring middleware
4. Create debugging and troubleshooting tools

### Backward Compatibility Bridge

During migration, a compatibility bridge ensures existing code continues to work:

```javascript
// src/foundation/logging/CompatibilityBridge.js
export class CompatibilityBridge {
  constructor(loggerFactory) {
    this.loggerFactory = loggerFactory;
    this.defaultLogger = loggerFactory.createLogger('Legacy');
  }
  
  // Bridge for existing global console usage
  createGlobalBridge() {
    const originalConsole = global.console;
    
    global.console = {
      ...originalConsole,
      log: (...args) => this.defaultLogger.info(this.formatLegacyMessage(args)),
      warn: (...args) => this.defaultLogger.warn(this.formatLegacyMessage(args)),
      error: (...args) => this.defaultLogger.error(this.formatLegacyMessage(args)),
      debug: (...args) => this.defaultLogger.debug(this.formatLegacyMessage(args))
    };
  }
  
  formatLegacyMessage(args) {
    return args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
  }
}
```

## Action Callback Requirements

### Universal Action Tracking

Every significant action in the system must trigger a customizable callback through the `ActionCallbackSystem`. This includes:

#### Core Actions
- **Window Operations**: `window:create`, `window:destroy`, `window:move`, `window:resize`, `window:focus`, `window:minimize`
- **State Changes**: `state:save`, `state:load`, `state:reset`, `state:update`, `state:transaction`
- **Resource Operations**: `resource:load`, `resource:save`, `resource:delete`, `resource:watch`
- **Plugin Operations**: `plugin:load`, `plugin:unload`, `plugin:execute`, `plugin:error`
- **Logging Operations**: `log:entry`, `log:error`, `log:performance`, `log:audit`

#### Game-Specific Actions
- **Door Operations**: `door:create`, `door:open`, `door:close`, `door:lock`, `door:unlock`
- **Key Operations**: `key:create`, `key:use`, `key:collect`, `key:drop`
- **Puzzle Operations**: `puzzle:start`, `puzzle:solve`, `puzzle:fail`, `puzzle:hint`
- **Navigation**: `navigate:enter`, `navigate:exit`, `navigate:teleport`

#### System Actions
- **Error Handling**: `error:validation`, `error:system`, `error:recovery`
- **Performance**: `performance:measure`, `performance:warn`, `performance:optimize`
- **Security**: `security:validate`, `security:deny`, `security:audit`

### Implementation Pattern

Every module that performs actions must integrate with both ActionCallbackSystem and structured logging:

```javascript
// Example: Enhanced Window Manager with Action Callbacks
export class WindowManager {
  constructor(platformAdapter, options = {}) {
    this.platform = platformAdapter;
    this.windows = new Map();
    this.eventBus = options.eventBus;
    this.actionCallbacks = options.actionCallbacks;
  }
  
  async createWindow(config) {
    // Execute action callback before operation
    await this.actionCallbacks.executeAction('window:create', {
      source: 'WindowManager',
      data: { config, windowId: config.id },
      phase: 'before'
    });
    
    try {
      const window = await this.platform.createWindow(config);
      this.windows.set(config.id, window);
      
      // Execute action callback after successful operation
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, windowId: config.id, window },
        phase: 'after',
        success: true
      });
      
      return window;
    } catch (error) {
      // Execute action callback on error
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, windowId: config.id, error: error.message },
        phase: 'error',
        success: false
      });
      
      throw error;
    }
  }
  
  async destroyWindow(windowId) {
    await this.actionCallbacks.executeAction('window:destroy', {
      source: 'WindowManager',
      data: { windowId },
      phase: 'before'
    });
    
    const window = this.windows.get(windowId);
    if (window) {
      await window.destroy();
      this.windows.delete(windowId);
      
      await this.actionCallbacks.executeAction('window:destroy', {
        source: 'WindowManager',
        data: { windowId },
        phase: 'after',
        success: true
      });
    }
  }
}

// Example: State Manager with Action Callbacks
export class StateManager {
  constructor(initialState = {}, options = {}) {
    this.state = new Proxy(initialState, this.createStateProxy());
    this.subscribers = new Map();
    this.actionCallbacks = options.actionCallbacks;
  }
  
  async setState(path, value) {
    const oldValue = this.getState(path);
    
    await this.actionCallbacks.executeAction('state:update', {
      source: 'StateManager',
      data: { path, oldValue, newValue: value },
      phase: 'before'
    });
    
    // Perform state update
    this.setStateInternal(path, value);
    
    await this.actionCallbacks.executeAction('state:update', {
      source: 'StateManager',
      data: { path, oldValue, newValue: value },
      phase: 'after',
      success: true
    });
  }
  
  async transaction(fn) {
    await this.actionCallbacks.executeAction('state:transaction', {
      source: 'StateManager',
      data: { operation: fn.name || 'anonymous' },
      phase: 'before'
    });
    
    const snapshot = this.createSnapshot();
    
    try {
      const result = await fn();
      
      await this.actionCallbacks.executeAction('state:transaction', {
        source: 'StateManager',
        data: { operation: fn.name || 'anonymous', result },
        phase: 'after',
        success: true
      });
      
      return result;
    } catch (error) {
      this.restoreSnapshot(snapshot);
      
      await this.actionCallbacks.executeAction('state:transaction', {
        source: 'StateManager',
        data: { operation: fn.name || 'anonymous', error: error.message },
        phase: 'error',
        success: false
      });
      
      throw error;
    }
  }
}
```

### Default Callback Behavior

The system provides a comprehensive default logger that outputs structured information:

```javascript
// Default callback implementation
const defaultActionCallback = (context) => {
  const logLevel = determineLogLevel(context);
  const message = formatActionMessage(context);
  const metadata = extractMetadata(context);
  
  console[logLevel](`[ACTION:${context.action.toUpperCase()}]`, message, metadata);
};

function determineLogLevel(context) {
  if (context.phase === 'error') return 'error';
  if (context.action.includes('performance:warn')) return 'warn';
  if (context.action.includes('debug:')) return 'debug';
  return 'log';
}

function formatActionMessage(context) {
  const phase = context.phase ? `[${context.phase.toUpperCase()}]` : '';
  const success = context.success !== undefined ? 
    (context.success ? '✓' : '✗') : '';
  
  return `${phase} ${success} ${context.action} - ${context.source}`;
}

function extractMetadata(context) {
  return {
    timestamp: new Date(context.timestamp).toISOString(),
    source: context.source,
    data: context.data,
    duration: context.duration,
    success: context.success
  };
}
```

### Customization Examples

Users can register custom callbacks for specific actions or patterns:

```javascript
// Custom analytics callback
actionCallbacks.registerActionCallback('window:*', (context) => {
  analytics.track('window_operation', {
    action: context.action,
    windowId: context.data.windowId,
    timestamp: context.timestamp
  });
});

// Custom performance monitoring
actionCallbacks.registerActionCallback('*', (context) => {
  if (context.phase === 'before') {
    performance.mark(`${context.action}-start`);
  } else if (context.phase === 'after') {
    performance.mark(`${context.action}-end`);
    performance.measure(context.action, `${context.action}-start`, `${context.action}-end`);
  }
}, { priority: 100 });

// Custom error handling
actionCallbacks.registerActionCallback('*', (context) => {
  if (context.phase === 'error') {
    errorReporting.captureException(new Error(context.data.error), {
      action: context.action,
      source: context.source,
      data: context.data
    });
  }
});

// Custom audit logging for security actions
actionCallbacks.registerActionCallback('security:*', (context) => {
  auditLog.record({
    action: context.action,
    timestamp: context.timestamp,
    source: context.source,
    data: context.data,
    severity: context.action.includes('deny') ? 'high' : 'medium'
  });
}, { priority: 200 });
```

### Integration with Plugin System

Plugins can register their own action callbacks:

```javascript
// Plugin registering custom callbacks
export class AnalyticsPlugin extends Plugin {
  async initialize(context) {
    this.actionCallbacks = context.actionCallbacks;
    
    // Register analytics for all puzzle actions
    this.registrationId = this.actionCallbacks.registerActionCallback('puzzle:*', 
      this.trackPuzzleAnalytics.bind(this)
    );
  }
  
  trackPuzzleAnalytics(context) {
    this.sendToAnalytics({
      event: 'puzzle_action',
      action: context.action,
      puzzleId: context.data.puzzleId,
      success: context.success,
      duration: context.duration
    });
  }
  
  async destroy() {
    this.actionCallbacks.unregister(this.registrationId);
  }
}
```

## Implementation Benefits

### 1. **Reusability**
- Foundation modules can be used in other Electron apps
- Platform adapters enable cross-platform support
- Service layer can be reused with different UIs

### 2. **Testability**
- Easy to mock dependencies
- Platform adapters can be swapped for testing
- Isolated unit testing of business logic
- Action callbacks can be mocked for testing specific behaviors

### 3. **Maintainability**
- Clear separation of concerns
- Dependency injection makes relationships explicit
- Plugin system enables extensibility without core changes
- Universal action tracking provides comprehensive audit trails

### 4. **Flexibility**
- Easy to swap implementations (e.g., different state management)
- Platform adapters enable targeting different environments
- Configuration-driven behavior
- Customizable action callbacks for different deployment scenarios

### 6. **Observability and Debugging**
- Every action is trackable through both callback and logging systems
- Default structured logging provides immediate visibility into system behavior
- Custom callbacks enable analytics, monitoring, and debugging
- Structured action context provides rich metadata for analysis
- Performance metrics and error tracking built into every operation
- Centralized logging with configurable transports and formats

## Migration Strategy

### Phase 1: Foundation Layer
1. Create event system abstraction
2. Implement structured logging system with proper transports
3. Implement action callback system with logging integration
4. Implement state management foundation
5. Abstract window management
6. Set up dependency injection with logger factory

### Phase 2: Platform Adapters
1. Create Electron adapters with logging integration
2. Abstract file system operations
3. Create platform-specific implementations
4. Integrate action callbacks and logging into all adapters

### Phase 3: Service Layer
1. Refactor existing modules to use foundation and structured logging
2. Replace all console.* calls with proper logger instances
3. Add action callback integration to all services
4. Create game-specific services
5. Implement plugin system with logging

### Phase 4: Application Layer
1. Update main.js to use container, action callbacks, and logging
2. Refactor UI components
3. Add configuration system for action callbacks and logging
4. Implement default and custom callback examples
5. Add log rotation, remote logging, and monitoring tools

## Example: Refactored Window Creation

### Before (Current)
```javascript
// Tightly coupled to Electron
import { BrowserWindow } from 'electron';

export async function createWindow(id, options) {
  const window = new BrowserWindow(options);
  windows.set(id, window);
  // Game-specific logic mixed with window management
  await initializeDoorState(window);
  return window;
}
```

### After (Abstracted with Action Callbacks and Structured Logging)
```javascript
// Foundation layer - platform agnostic with action tracking and proper logging
export class WindowManager {
  constructor(platformAdapter, options = {}) {
    this.platform = platformAdapter;
    this.actionCallbacks = options.actionCallbacks;
    this.logger = options.logger; // Structured logger instance
  }
  
  async createWindow(config) {
    const startTime = performance.now();
    
    // Structured logging with rich context
    this.logger.info('Creating window', {
      operation: 'createWindow',
      windowId: config.id,
      config: {
        width: config.width,
        height: config.height,
        type: config.type
      }
    });
    
    // Track action with callback system
    await this.actionCallbacks.executeAction('window:create', {
      source: 'WindowManager',
      data: { config },
      phase: 'before'
    });
    
    try {
      const window = await this.platform.createWindow(config);
      const duration = performance.now() - startTime;
      
      // Success logging with performance metrics
      this.logger.info('Window created successfully', {
        operation: 'createWindow',
        windowId: config.id,
        duration: `${duration.toFixed(2)}ms`,
        bounds: window.getBounds()
      });
      
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, window, duration },
        phase: 'after',
        success: true
      });
      
      this.eventBus.emit('window:created', { window, config });
      return window;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Structured error logging with full context
      this.logger.error('Window creation failed', {
        operation: 'createWindow',
        windowId: config.id,
        duration: `${duration.toFixed(2)}ms`,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        },
        config
      });
      
      await this.actionCallbacks.executeAction('window:create', {
        source: 'WindowManager',
        data: { config, error: error.message, duration },
        phase: 'error',
        success: false
      });
      throw error;
    }
  }
}

// Service layer - game-specific with action tracking and logging
export class GameWindowService {
  constructor(windowManager, eventBus, actionCallbacks, logger) {
    this.windowManager = windowManager;
    this.eventBus = eventBus;
    this.actionCallbacks = actionCallbacks;
    this.logger = logger;
  }
  
  async createDoor(id, config) {
    this.logger.info('Creating door window', {
      operation: 'createDoor',
      doorId: id,
      doorType: config.type
    });
    
    await this.actionCallbacks.executeAction('door:create', {
      source: 'GameWindowService',
      data: { id, config },
      phase: 'before'
    });
    
    const windowConfig = new WindowConfig({ ...config, type: 'door' });
    const window = await this.windowManager.createWindow(windowConfig);
    
    // Game-specific initialization via events
    this.eventBus.emit('door:created', { id, window, config });
    
    this.logger.info('Door created successfully', {
      operation: 'createDoor',
      doorId: id,
      windowId: window.id
    });
    
    await this.actionCallbacks.executeAction('door:create', {
      source: 'GameWindowService',
      data: { id, config, window },
      phase: 'after',
      success: true
    });
    
    return window;
  }
}

// Usage with DI, structured logging, and custom action callbacks
const gameWindowService = container.resolve('gameWindowService');
const actionCallbacks = container.resolve('actionCallbacks');
const loggerFactory = container.resolve('loggerFactory');

// Register custom callback for door creation analytics
actionCallbacks.registerActionCallback('door:create', (context) => {
  analytics.track('door_created', {
    doorId: context.data.id,
    doorType: context.data.config.type,
    timestamp: context.timestamp,
    duration: context.data.duration
  });
});

// Register custom logging callback for performance monitoring
actionCallbacks.registerActionCallback('*', (context) => {
  if (context.data.duration && parseFloat(context.data.duration) > 1000) {
    const performanceLogger = loggerFactory.createLogger('Performance');
    performanceLogger.warn('Slow operation detected', {
      action: context.action,
      source: context.source,
      duration: context.data.duration,
      threshold: '1000ms'
    });
  }
});

// Create door - will trigger structured logging, action callbacks, and analytics
const door = await gameWindowService.createDoor('door-1', doorConfig);
```

### Enhanced Output Example
```
2024-01-04T10:30:00.000Z INFO  [GameWindowService] Creating door window {"operation":"createDoor","doorId":"door-1","doorType":"puzzle"}

2024-01-04T10:30:00.100Z INFO  [WindowManager    ] Creating window {"operation":"createWindow","windowId":"door-1","config":{"width":400,"height":300,"type":"door"}}

2024-01-04T10:30:00.250Z INFO  [WindowManager    ] Window created successfully {"operation":"createWindow","windowId":"door-1","duration":"150.00ms","bounds":{"x":100,"y":100,"width":400,"height":300}}

2024-01-04T10:30:00.300Z INFO  [GameWindowService] Door created successfully {"operation":"createDoor","doorId":"door-1","windowId":"door-1"}

2024-01-04T10:30:00.350Z INFO  [ActionCallbacks  ] Action executed: door:create {"source":"GameWindowService","phase":"after","success":true,"data":{"id":"door-1","config":{"type":"puzzle"},"window":{"id":"door-1"}},"duration":"350ms"}
```

This abstraction approach would make the codebase much more modular, testable, and reusable while maintaining the existing functionality and providing comprehensive action tracking with customizable callbacks, structured logging that replaces the problematic global console override, and full compatibility with the proposed abstraction architecture.