# Foundation Configuration Examples

## Overview

This guide provides comprehensive configuration examples for different environments and use cases with the foundational abstraction system. Each example includes complete configuration files, environment setup, and usage patterns.

## Environment Configurations

### Development Environment

#### Container Configuration
```javascript
// config/development/containerConfig.js
import { Container } from '../../src/foundation/di/Container.js';
import { LoggerFactory } from '../../src/foundation/logging/LoggerFactory.js';
import { ActionCallbackSystem } from '../../src/foundation/actions/ActionCallbackSystem.js';
import { StateManager } from '../../src/foundation/state/StateManager.js';
import { EventBus } from '../../src/foundation/events/EventBus.js';
import { ResourceManager } from '../../src/foundation/resources/ResourceManager.js';
import { ConfigurationManager } from '../../src/foundation/config/ConfigurationManager.js';
import { PluginManager } from '../../src/foundation/plugins/PluginManager.js';

// Platform adapters
import { ElectronWindowAdapter } from '../../src/platform/electron/ElectronWindowAdapter.js';
import { ElectronResourceAdapter } from '../../src/platform/electron/ElectronResourceAdapter.js';

// Services
import { GameWindowService } from '../../src/services/GameWindowService.js';
import { DoorKeyService } from '../../src/services/DoorKeyService.js';
import { EmailService } from '../../src/services/EmailService.js';
import { LensService } from '../../src/services/LensService.js';
import { PuzzleService } from '../../src/services/PuzzleService.js';

export function configureDevelopmentContainer() {
  const container = new Container();
  
  // Foundation services with development-specific configuration
  container.registerSingleton('loggerFactory', () => new LoggerFactory({
    level: 'debug',
    modules: {
      'WindowService': 'debug',
      'DoorKeyService': 'debug',
      'EmailService': 'info',
      'LensService': 'debug',
      'PuzzleService': 'debug'
    },
    transports: [
      {
        type: 'console',
        level: 'debug',
        format: 'pretty',
        colors: true
      },
      {
        type: 'file',
        level: 'debug',
        format: 'json',
        options: {
          filename: 'logs/fenestra-dev.log',
          maxSize: '10MB',
          maxFiles: 5
        }
      }
    ]
  }));
  
  container.registerSingleton('actionCallbacks', () => new ActionCallbackSystem({
    defaultCallback: (context) => {
      const logger = container.resolve('loggerFactory').create('ActionCallbacks');
      logger.debug('Action executed', context);
    },
    errorIsolation: true,
    middleware: [
      // Development middleware for debugging
      (context, next) => {
        const start = performance.now();
        const result = next();
        const duration = performance.now() - start;
        
        if (duration > 100) {
          const logger = container.resolve('loggerFactory').create('Performance');
          logger.warn('Slow action detected', { action: context.action, duration });
        }
        
        return result;
      }
    ]
  }));
  
  container.registerSingleton('stateManager', () => new StateManager({
    persistence: {
      adapter: 'file',
      path: 'game-data/.fenestra-storage/dev-state.json',
      autoSave: true,
      saveInterval: 5000 // Save every 5 seconds in development
    },
    validation: {
      enabled: true,
      strict: true // Strict validation in development
    }
  }));
  
  container.registerSingleton('eventBus', () => new EventBus({
    middleware: [
      // Development event logging
      (event, next) => {
        const logger = container.resolve('loggerFactory').create('EventBus');
        logger.debug('Event emitted', { type: event.type, data: event.data });
        return next();
      }
    ],
    validation: {
      enabled: true,
      schemas: new Map() // Add event schemas for validation
    }
  }));
  
  container.registerSingleton('resourceManager', (c) => new ResourceManager(
    c.resolve('resourceAdapter'),
    {
      cache: {
        enabled: false, // Disable caching in development for fresh reloads
        maxSize: 100,
        ttl: 300000 // 5 minutes
      },
      watching: {
        enabled: true, // Enable file watching in development
        debounce: 100
      }
    }
  ));
  
  container.registerSingleton('configManager', (c) => new ConfigurationManager({
    environment: 'development',
    configPaths: [
      'config/default.json',
      'config/development.json',
      'config/local.json' // Local overrides
    ],
    watchForChanges: true, // Hot reload configuration in development
    validation: {
      enabled: true,
      strict: true
    }
  }));
  
  container.registerSingleton('pluginManager', (c) => new PluginManager({
    pluginPaths: [
      'plugins/development',
      'plugins/shared'
    ],
    autoLoad: true,
    hotReload: true, // Enable plugin hot reloading in development
    sandboxing: false // Disable sandboxing for easier debugging
  }));
  
  // Platform adapters with development configuration
  container.registerSingleton('windowAdapter', (c) => new ElectronWindowAdapter({
    devTools: true, // Enable dev tools in development
    logging: c.resolve('loggerFactory').create('ElectronWindowAdapter')
  }));
  
  container.registerSingleton('resourceAdapter', (c) => new ElectronResourceAdapter({
    basePath: process.cwd(),
    security: {
      enabled: true,
      allowedPaths: [
        'game-data',
        'renderer',
        'config',
        'plugins'
      ]
    },
    logging: c.resolve('loggerFactory').create('ElectronResourceAdapter')
  }));
  
  // Logger factory for creating module-specific loggers
  container.registerFactory('logger', (c) => (moduleName) => 
    c.resolve('loggerFactory').create(moduleName)
  );
  
  // Services with development configuration
  container.register('gameWindowService', GameWindowService);
  container.register('doorKeyService', DoorKeyService);
  container.register('emailService', EmailService);
  container.register('lensService', LensService);
  container.register('puzzleService', PuzzleService);
  
  return container;
}
```

#### Logging Configuration
```json
// config/development.json
{
  "logging": {
    "level": "debug",
    "modules": {
      "WindowService": "debug",
      "DoorKeyService": "debug",
      "EmailService": "info",
      "LensService": "debug",
      "PuzzleService": "debug",
      "ActionCallbacks": "debug",
      "StateManager": "debug",
      "EventBus": "debug",
      "ResourceManager": "info",
      "PluginManager": "debug"
    },
    "transports": [
      {
        "type": "console",
        "level": "debug",
        "format": "pretty",
        "colors": true,
        "timestamp": true
      },
      {
        "type": "file",
        "level": "debug",
        "format": "json",
        "options": {
          "filename": "logs/fenestra-dev.log",
          "maxSize": "10MB",
          "maxFiles": 5,
          "compress": false
        }
      }
    ]
  },
  "actionCallbacks": {
    "enabled": true,
    "defaultLogging": true,
    "performanceMonitoring": true,
    "errorIsolation": true
  },
  "stateManager": {
    "persistence": {
      "adapter": "file",
      "path": "game-data/.fenestra-storage/dev-state.json",
      "autoSave": true,
      "saveInterval": 5000,
      "backup": {
        "enabled": true,
        "maxBackups": 10
      }
    },
    "validation": {
      "enabled": true,
      "strict": true
    }
  },
  "resourceManager": {
    "cache": {
      "enabled": false,
      "maxSize": 100,
      "ttl": 300000
    },
    "watching": {
      "enabled": true,
      "debounce": 100
    }
  },
  "pluginManager": {
    "autoLoad": true,
    "hotReload": true,
    "sandboxing": false,
    "pluginPaths": [
      "plugins/development",
      "plugins/shared"
    ]
  }
}
```

### Production Environment

#### Container Configuration
```javascript
// config/production/containerConfig.js
export function configureProductionContainer() {
  const container = new Container();
  
  // Foundation services with production-optimized configuration
  container.registerSingleton('loggerFactory', () => new LoggerFactory({
    level: 'info',
    modules: {
      'WindowService': 'info',
      'DoorKeyService': 'info',
      'EmailService': 'warn',
      'LensService': 'info',
      'PuzzleService': 'info'
    },
    transports: [
      {
        type: 'console',
        level: 'warn', // Only warnings and errors to console in production
        format: 'json',
        colors: false
      },
      {
        type: 'file',
        level: 'info',
        format: 'json',
        options: {
          filename: 'logs/fenestra-prod.log',
          maxSize: '50MB',
          maxFiles: 10,
          compress: true
        }
      },
      {
        type: 'file',
        level: 'error',
        format: 'json',
        options: {
          filename: 'logs/fenestra-errors.log',
          maxSize: '10MB',
          maxFiles: 5
        }
      }
    ]
  }));
  
  container.registerSingleton('actionCallbacks', () => new ActionCallbackSystem({
    defaultCallback: null, // No default logging in production
    errorIsolation: true,
    middleware: [
      // Production performance monitoring
      (context, next) => {
        const start = performance.now();
        const result = next();
        const duration = performance.now() - start;
        
        if (duration > 1000) { // Only log very slow operations
          const logger = container.resolve('loggerFactory').create('Performance');
          logger.warn('Very slow action detected', { action: context.action, duration });
        }
        
        return result;
      }
    ]
  }));
  
  container.registerSingleton('stateManager', () => new StateManager({
    persistence: {
      adapter: 'file',
      path: 'game-data/.fenestra-storage/game-state.json',
      autoSave: true,
      saveInterval: 30000, // Save every 30 seconds in production
      backup: {
        enabled: true,
        maxBackups: 5,
        interval: 3600000 // Backup every hour
      }
    },
    validation: {
      enabled: true,
      strict: false // Less strict validation in production for performance
    }
  }));
  
  container.registerSingleton('eventBus', () => new EventBus({
    middleware: [], // No debug middleware in production
    validation: {
      enabled: false // Disable validation in production for performance
    }
  }));
  
  container.registerSingleton('resourceManager', (c) => new ResourceManager(
    c.resolve('resourceAdapter'),
    {
      cache: {
        enabled: true, // Enable caching in production
        maxSize: 1000,
        ttl: 1800000 // 30 minutes
      },
      watching: {
        enabled: false // Disable file watching in production
      }
    }
  ));
  
  container.registerSingleton('pluginManager', (c) => new PluginManager({
    pluginPaths: [
      'plugins/production'
    ],
    autoLoad: true,
    hotReload: false, // Disable hot reload in production
    sandboxing: true // Enable sandboxing for security
  }));
  
  // Platform adapters with production configuration
  container.registerSingleton('windowAdapter', (c) => new ElectronWindowAdapter({
    devTools: false, // Disable dev tools in production
    logging: c.resolve('loggerFactory').create('ElectronWindowAdapter')
  }));
  
  container.registerSingleton('resourceAdapter', (c) => new ElectronResourceAdapter({
    basePath: process.cwd(),
    security: {
      enabled: true,
      strict: true, // Strict security in production
      allowedPaths: [
        'game-data',
        'renderer'
      ]
    },
    logging: c.resolve('loggerFactory').create('ElectronResourceAdapter')
  }));
  
  // Services
  container.register('gameWindowService', GameWindowService);
  container.register('doorKeyService', DoorKeyService);
  container.register('emailService', EmailService);
  container.register('lensService', LensService);
  container.register('puzzleService', PuzzleService);
  
  return container;
}
```

#### Production Configuration
```json
// config/production.json
{
  "logging": {
    "level": "info",
    "modules": {
      "WindowService": "info",
      "DoorKeyService": "info",
      "EmailService": "warn",
      "LensService": "info",
      "PuzzleService": "info"
    },
    "transports": [
      {
        "type": "console",
        "level": "warn",
        "format": "json",
        "colors": false,
        "timestamp": true
      },
      {
        "type": "file",
        "level": "info",
        "format": "json",
        "options": {
          "filename": "logs/fenestra-prod.log",
          "maxSize": "50MB",
          "maxFiles": 10,
          "compress": true
        }
      },
      {
        "type": "file",
        "level": "error",
        "format": "json",
        "options": {
          "filename": "logs/fenestra-errors.log",
          "maxSize": "10MB",
          "maxFiles": 5
        }
      }
    ]
  },
  "actionCallbacks": {
    "enabled": true,
    "defaultLogging": false,
    "performanceMonitoring": true,
    "errorIsolation": true
  },
  "stateManager": {
    "persistence": {
      "adapter": "file",
      "path": "game-data/.fenestra-storage/game-state.json",
      "autoSave": true,
      "saveInterval": 30000,
      "backup": {
        "enabled": true,
        "maxBackups": 5,
        "interval": 3600000
      }
    },
    "validation": {
      "enabled": true,
      "strict": false
    }
  },
  "resourceManager": {
    "cache": {
      "enabled": true,
      "maxSize": 1000,
      "ttl": 1800000
    },
    "watching": {
      "enabled": false
    }
  },
  "pluginManager": {
    "autoLoad": true,
    "hotReload": false,
    "sandboxing": true,
    "pluginPaths": [
      "plugins/production"
    ]
  }
}
```

### Testing Environment

#### Container Configuration
```javascript
// config/testing/containerConfig.js
import { TestContainer } from '../../src/foundation/testing/TestContainer.js';
import { MockFactory } from '../../src/foundation/testing/MockFactory.js';
import { TestTransports } from '../../src/foundation/testing/TestTransports.js';

export function configureTestingContainer() {
  const container = new TestContainer();
  
  // Foundation services with testing configuration
  container.registerSingleton('loggerFactory', () => new LoggerFactory({
    level: 'error', // Only errors in tests to reduce noise
    transports: [
      new TestTransports.MemoryTransport() // Capture logs for assertions
    ]
  }));
  
  container.registerSingleton('actionCallbacks', () => new ActionCallbackSystem({
    defaultCallback: null,
    errorIsolation: true,
    middleware: [] // No middleware in tests for predictability
  }));
  
  container.registerSingleton('stateManager', () => new StateManager({
    persistence: {
      adapter: 'memory', // Use memory adapter for tests
      autoSave: false
    },
    validation: {
      enabled: true,
      strict: true
    }
  }));
  
  container.registerSingleton('eventBus', () => new EventBus({
    middleware: [],
    validation: {
      enabled: false // Disable for test performance
    }
  }));
  
  container.registerSingleton('resourceManager', (c) => new ResourceManager(
    c.resolve('resourceAdapter'),
    {
      cache: {
        enabled: false // Disable caching in tests
      },
      watching: {
        enabled: false
      }
    }
  ));
  
  // Mock platform adapters for testing
  container.registerSingleton('windowAdapter', () => 
    MockFactory.createWindowAdapter()
  );
  
  container.registerSingleton('resourceAdapter', () => 
    MockFactory.createResourceAdapter()
  );
  
  // Logger factory
  container.registerFactory('logger', (c) => (moduleName) => 
    c.resolve('loggerFactory').create(moduleName)
  );
  
  // Services
  container.register('gameWindowService', GameWindowService);
  container.register('doorKeyService', DoorKeyService);
  container.register('emailService', EmailService);
  container.register('lensService', LensService);
  container.register('puzzleService', PuzzleService);
  
  return container;
}
```

## Service Layer Configuration Examples

### Game Window Service Configuration

```javascript
// Example: Configuring GameWindowService with different window types
export class GameWindowService {
  static dependencies = ['windowAdapter', 'stateManager', 'logger', 'actionCallbacks', 'configManager'];
  
  constructor(windowAdapter, stateManager, logger, actionCallbacks, configManager) {
    this.windowAdapter = windowAdapter;
    this.stateManager = stateManager;
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    this.configManager = configManager;
    
    // Load window configurations
    this.windowConfigs = new Map();
    this.initializeWindowConfigs();
  }
  
  async initializeWindowConfigs() {
    const configs = await this.configManager.load('windows.json', {
      defaults: {
        door: {
          width: 400,
          height: 600,
          resizable: false,
          frame: false,
          alwaysOnTop: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: 'preload.js'
          }
        },
        terminal: {
          width: 800,
          height: 600,
          resizable: true,
          frame: true,
          alwaysOnTop: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: 'preload.js'
          }
        },
        lens: {
          width: 200,
          height: 200,
          resizable: false,
          frame: false,
          alwaysOnTop: true,
          transparent: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: 'preload.js'
          }
        }
      }
    });
    
    Object.entries(configs).forEach(([type, config]) => {
      this.windowConfigs.set(type, config);
    });
  }
  
  async createGameWindow(type, id, customOptions = {}) {
    const baseConfig = this.windowConfigs.get(type);
    if (!baseConfig) {
      throw new Error(`Unknown window type: ${type}`);
    }
    
    const options = {
      ...baseConfig,
      ...customOptions,
      webPreferences: {
        ...baseConfig.webPreferences,
        ...customOptions.webPreferences
      }
    };
    
    const context = {
      action: 'create-game-window',
      source: 'GameWindowService',
      data: { type, id, options }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      const window = await this.windowAdapter.create(options);
      
      // Load appropriate HTML file based on type
      const htmlFile = this.getHtmlFileForType(type);
      await this.windowAdapter.loadFile(window, htmlFile);
      
      // Store window state
      await this.stateManager.set(`windows.${id}`, {
        type,
        created: Date.now(),
        options
      });
      
      this.logger.info('Game window created', { type, id });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
      
      return window;
    } catch (error) {
      this.logger.error('Failed to create game window', { type, id, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  getHtmlFileForType(type) {
    const htmlFiles = {
      door: 'renderer/door.html',
      terminal: 'renderer/terminal.html',
      lens: 'renderer/lensViewer.html',
      email: 'renderer/email.html',
      picture: 'renderer/pictureViewer.html',
      content: 'renderer/contentViewer.html'
    };
    
    return htmlFiles[type] || 'renderer/index.html';
  }
}
```

### Door-Key Service Configuration

```javascript
// Example: Configuring DoorKeyService with relationship management
export class DoorKeyService {
  static dependencies = ['stateManager', 'eventBus', 'logger', 'actionCallbacks', 'configManager'];
  
  constructor(stateManager, eventBus, logger, actionCallbacks, configManager) {
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    this.configManager = configManager;
    
    this.initializeConfiguration();
  }
  
  async initializeConfiguration() {
    this.config = await this.configManager.load('doorKey.json', {
      defaults: {
        overlapThreshold: 0.5,
        autoUnlock: true,
        persistRelationships: true,
        validationRules: {
          requireKeyForDoor: true,
          allowMultipleKeys: false,
          checkKeyPermissions: true
        }
      }
    });
  }
  
  async establishRelationship(doorId, keyId, options = {}) {
    const context = {
      action: 'establish-relationship',
      source: 'DoorKeyService',
      data: { doorId, keyId, options }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Validate relationship based on configuration
      await this.validateRelationship(doorId, keyId);
      
      // Check overlap if required
      if (this.config.overlapThreshold > 0) {
        const overlap = await this.calculateOverlap(doorId, keyId);
        if (overlap < this.config.overlapThreshold) {
          throw new Error(`Insufficient overlap: ${overlap} < ${this.config.overlapThreshold}`);
        }
      }
      
      // Store relationship
      const relationship = {
        doorId,
        keyId,
        established: Date.now(),
        options,
        active: true
      };
      
      await this.stateManager.set(`relationships.${doorId}.${keyId}`, relationship);
      
      // Emit event for other services
      await this.eventBus.emit('door-key.relationship-established', {
        doorId,
        keyId,
        relationship
      });
      
      this.logger.info('Door-key relationship established', { doorId, keyId });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
      
      return relationship;
    } catch (error) {
      this.logger.error('Failed to establish relationship', { doorId, keyId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async validateRelationship(doorId, keyId) {
    if (this.config.validationRules.requireKeyForDoor) {
      const keyExists = await this.stateManager.get(`keys.${keyId}`);
      if (!keyExists) {
        throw new Error(`Key not found: ${keyId}`);
      }
    }
    
    if (!this.config.validationRules.allowMultipleKeys) {
      const existingRelationships = await this.stateManager.get(`relationships.${doorId}`);
      if (existingRelationships && Object.keys(existingRelationships).length > 0) {
        throw new Error(`Door ${doorId} already has a key relationship`);
      }
    }
    
    if (this.config.validationRules.checkKeyPermissions) {
      const keyPermissions = await this.stateManager.get(`keys.${keyId}.permissions`);
      if (keyPermissions && !keyPermissions.includes(doorId)) {
        throw new Error(`Key ${keyId} does not have permission for door ${doorId}`);
      }
    }
  }
}
```

## Plugin Configuration Examples

### Basic Plugin Structure

```javascript
// plugins/example-plugin/index.js
import { Plugin } from '../../src/foundation/plugins/Plugin.js';

export class ExamplePlugin extends Plugin {
  constructor() {
    super('example-plugin', '1.0.0', {
      description: 'Example plugin demonstrating foundation integration',
      author: 'Fenestra Team',
      dependencies: ['logger', 'stateManager', 'eventBus', 'actionCallbacks']
    });
  }
  
  async initialize(container, hookSystem) {
    // Resolve dependencies from container
    this.logger = container.resolve('logger')('ExamplePlugin');
    this.stateManager = container.resolve('stateManager');
    this.eventBus = container.resolve('eventBus');
    this.actionCallbacks = container.resolve('actionCallbacks');
    
    // Register hooks
    hookSystem.register('game.level.loaded', this.onLevelLoaded.bind(this));
    hookSystem.register('window.created', this.onWindowCreated.bind(this));
    
    // Register action callbacks
    this.actionCallbacks.register('create-window', this.onWindowAction.bind(this), {
      priority: 10,
      source: 'example-plugin'
    });
    
    // Subscribe to events
    this.eventBus.on('door-key.relationship-established', this.onRelationshipEstablished.bind(this));
    
    this.logger.info('Example plugin initialized');
  }
  
  async onLevelLoaded(levelData) {
    this.logger.info('Level loaded', { level: levelData.id });
    
    // Modify level data
    levelData.customFeatures = {
      exampleFeature: true,
      timestamp: Date.now()
    };
    
    // Store plugin state
    await this.stateManager.set(`plugins.${this.name}.levelsLoaded`, 
      (await this.stateManager.get(`plugins.${this.name}.levelsLoaded`, 0)) + 1
    );
    
    return levelData;
  }
  
  async onWindowCreated(windowData) {
    this.logger.info('Window created via hook', { windowId: windowData.id });
    
    // Add custom window behavior
    if (windowData.type === 'door') {
      await this.addDoorEnhancements(windowData);
    }
  }
  
  async onWindowAction(context) {
    if (context.phase === 'before') {
      this.logger.debug('Window action starting', { action: context.action });
    } else if (context.phase === 'after') {
      this.logger.debug('Window action completed', { 
        action: context.action, 
        duration: context.duration 
      });
    }
  }
  
  async onRelationshipEstablished(event) {
    this.logger.info('Door-key relationship established', event.data);
    
    // Custom logic for relationship events
    await this.trackRelationshipStats(event.data);
  }
  
  async addDoorEnhancements(windowData) {
    // Example: Add custom styling or behavior to door windows
    await this.stateManager.set(`windows.${windowData.id}.enhancements`, {
      plugin: this.name,
      features: ['custom-styling', 'enhanced-animations'],
      applied: Date.now()
    });
  }
  
  async trackRelationshipStats(relationshipData) {
    const stats = await this.stateManager.get(`plugins.${this.name}.relationshipStats`, {
      total: 0,
      byDoor: {}
    });
    
    stats.total++;
    stats.byDoor[relationshipData.doorId] = (stats.byDoor[relationshipData.doorId] || 0) + 1;
    
    await this.stateManager.set(`plugins.${this.name}.relationshipStats`, stats);
  }
  
  async cleanup() {
    this.logger.info('Example plugin cleaning up');
    
    // Cleanup plugin state if needed
    await this.stateManager.delete(`plugins.${this.name}`);
  }
}
```

### Plugin Configuration File

```json
// plugins/example-plugin/plugin.json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example plugin demonstrating foundation integration",
  "author": "Fenestra Team",
  "main": "index.js",
  "dependencies": {
    "foundation": "^2.0.0"
  },
  "permissions": [
    "state.read",
    "state.write",
    "events.subscribe",
    "hooks.register",
    "actions.register"
  ],
  "configuration": {
    "enableEnhancements": true,
    "trackingEnabled": true,
    "logLevel": "info"
  },
  "hooks": [
    "game.level.loaded",
    "window.created"
  ],
  "events": [
    "door-key.relationship-established"
  ],
  "actions": [
    "create-window"
  ]
}
```

## Environment-Specific Usage Examples

### Development Usage

```javascript
// main-dev.js
import { configureDevelopmentContainer } from './config/development/containerConfig.js';

async function startDevelopment() {
  // Set up development container
  const container = configureDevelopmentContainer();
  
  // Enable development features
  process.env.NODE_ENV = 'development';
  process.env.ENABLE_DEV_TOOLS = 'true';
  process.env.ENABLE_HOT_RELOAD = 'true';
  
  // Resolve services
  const gameWindowService = container.resolve('gameWindowService');
  const doorKeyService = container.resolve('doorKeyService');
  const pluginManager = container.resolve('pluginManager');
  
  // Load development plugins
  await pluginManager.loadPlugin('development-tools');
  await pluginManager.loadPlugin('debug-overlay');
  
  // Start application with development configuration
  await startApplication(gameWindowService, doorKeyService);
  
  // Set up development-specific features
  await setupDevelopmentFeatures(container);
}

async function setupDevelopmentFeatures(container) {
  const logger = container.resolve('logger')('Development');
  const actionCallbacks = container.resolve('actionCallbacks');
  
  // Add development action callback for debugging
  actionCallbacks.register('*', (context) => {
    if (context.phase === 'error') {
      logger.error('Action failed in development', {
        action: context.action,
        source: context.source,
        error: context.error.message,
        stack: context.error.stack
      });
    }
  }, { priority: -1000 }); // Very low priority to catch all errors
  
  logger.info('Development features enabled');
}

startDevelopment().catch(console.error);
```

### Production Usage

```javascript
// main-prod.js
import { configureProductionContainer } from './config/production/containerConfig.js';

async function startProduction() {
  // Set up production container
  const container = configureProductionContainer();
  
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Resolve services
  const gameWindowService = container.resolve('gameWindowService');
  const doorKeyService = container.resolve('doorKeyService');
  const pluginManager = container.resolve('pluginManager');
  
  // Load production plugins only
  await pluginManager.loadPlugin('analytics');
  await pluginManager.loadPlugin('error-reporting');
  
  // Start application with production configuration
  await startApplication(gameWindowService, doorKeyService);
  
  // Set up production monitoring
  await setupProductionMonitoring(container);
}

async function setupProductionMonitoring(container) {
  const logger = container.resolve('logger')('Production');
  const actionCallbacks = container.resolve('actionCallbacks');
  
  // Add production monitoring
  actionCallbacks.register('*', (context) => {
    if (context.phase === 'error') {
      // Send to error reporting service
      reportError(context.error, {
        action: context.action,
        source: context.source,
        timestamp: context.timestamp
      });
    }
  }, { priority: -500 });
  
  logger.info('Production monitoring enabled');
}

startProduction().catch(console.error);
```

### Testing Usage

```javascript
// test/setup.js
import { configureTestingContainer } from '../config/testing/containerConfig.js';

export function setupTestEnvironment() {
  const container = configureTestingContainer();
  
  // Set testing environment
  process.env.NODE_ENV = 'test';
  
  return container;
}

// test/services/gameWindowService.test.js
import { setupTestEnvironment } from '../setup.js';

describe('GameWindowService', () => {
  let container;
  let gameWindowService;
  let mockWindowAdapter;
  let mockLogger;
  
  beforeEach(() => {
    container = setupTestEnvironment();
    gameWindowService = container.resolve('gameWindowService');
    
    // Get mocks for assertions
    mockWindowAdapter = container.resolve('windowAdapter');
    mockLogger = container.resolve('logger')('GameWindowService');
  });
  
  it('should create game window with proper configuration', async () => {
    const window = await gameWindowService.createGameWindow('door', 'test-door');
    
    expect(mockWindowAdapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 400,
        height: 600,
        resizable: false
      })
    );
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Game window created',
      { type: 'door', id: 'test-door' }
    );
  });
});
```

## Configuration Validation Examples

### Schema Validation

```javascript
// src/foundation/config/schemas.js
export const configSchemas = {
  logging: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error', 'none']
      },
      modules: {
        type: 'object',
        additionalProperties: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error', 'none']
        }
      },
      transports: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['console', 'file', 'remote']
            },
            level: {
              type: 'string',
              enum: ['debug', 'info', 'warn', 'error', 'none']
            },
            format: {
              type: 'string',
              enum: ['json', 'pretty']
            }
          },
          required: ['type', 'level']
        }
      }
    },
    required: ['level', 'transports']
  },
  
  stateManager: {
    type: 'object',
    properties: {
      persistence: {
        type: 'object',
        properties: {
          adapter: {
            type: 'string',
            enum: ['file', 'memory', 'database']
          },
          path: {
            type: 'string'
          },
          autoSave: {
            type: 'boolean'
          },
          saveInterval: {
            type: 'number',
            minimum: 1000
          }
        },
        required: ['adapter']
      }
    }
  }
};
```

### Runtime Configuration Updates

```javascript
// Example: Runtime configuration updates
export class ConfigurableService {
  static dependencies = ['configManager', 'logger', 'actionCallbacks'];
  
  constructor(configManager, logger, actionCallbacks) {
    this.configManager = configManager;
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    
    // Subscribe to configuration changes
    this.configManager.on('config.updated', this.onConfigUpdated.bind(this));
  }
  
  async onConfigUpdated(event) {
    const { path, newValue, oldValue } = event.data;
    
    this.logger.info('Configuration updated', { path, newValue, oldValue });
    
    // Handle specific configuration changes
    if (path.startsWith('logging.')) {
      await this.updateLoggingConfiguration(path, newValue);
    } else if (path.startsWith('stateManager.')) {
      await this.updateStateManagerConfiguration(path, newValue);
    }
  }
  
  async updateLoggingConfiguration(path, newValue) {
    // Reconfigure logging based on new settings
    if (path === 'logging.level') {
      this.logger.setLevel(newValue);
    }
  }
  
  async updateStateManagerConfiguration(path, newValue) {
    // Reconfigure state manager based on new settings
    if (path === 'stateManager.persistence.saveInterval') {
      await this.stateManager.updateSaveInterval(newValue);
    }
  }
}
```

This comprehensive configuration guide provides examples for all major environments and use cases, demonstrating how to properly configure the foundational abstraction system for different scenarios while maintaining consistency and best practices.