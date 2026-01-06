# Service Layer Implementation Guide

## Overview

This guide provides comprehensive examples and patterns for implementing the service layer in the foundational abstraction system. The service layer composes foundation components to create business logic services that are testable, maintainable, and extensible.

## Service Layer Architecture

### Core Principles

1. **Composition over Inheritance**: Services compose foundation components rather than extending base classes
2. **Dependency Injection**: All dependencies are injected through the constructor
3. **Single Responsibility**: Each service has a focused, well-defined responsibility
4. **Foundation Integration**: All services integrate with logging, action callbacks, state management, and events
5. **Platform Agnostic**: Services use platform adapters, never direct platform APIs

### Service Structure Template

```javascript
// Template for all service layer implementations
export class ExampleService {
  // Declare dependencies for container resolution
  static dependencies = ['logger', 'actionCallbacks', 'stateManager', 'eventBus'];
  
  constructor(logger, actionCallbacks, stateManager, eventBus) {
    // Store foundation dependencies
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    
    // Initialize service-specific state
    this.initialized = false;
  }
  
  async initialize() {
    // Service initialization logic
    await this.loadConfiguration();
    await this.setupEventSubscriptions();
    
    this.initialized = true;
    this.logger.info('Service initialized');
  }
  
  async performOperation(data) {
    // Standard operation pattern with action tracking
    const context = {
      action: 'perform-operation',
      source: 'ExampleService',
      data
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      const result = await this.coreOperation(data);
      
      await this.actionCallbacks.execute('after', { ...context, success: true, result });
      
      return result;
    } catch (error) {
      this.logger.error('Operation failed', { data, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async coreOperation(data) {
    // Core business logic implementation
    throw new Error('Must be implemented by subclass');
  }
  
  async cleanup() {
    // Service cleanup logic
    this.logger.info('Service cleaning up');
  }
}
```

## Game Window Service Implementation

### Complete Implementation

```javascript
// src/services/GameWindowService.js
import { ValidationError, SystemError } from '../foundation/error/ErrorHandler.js';

export class GameWindowService {
  static dependencies = [
    'windowAdapter', 
    'stateManager', 
    'eventBus', 
    'logger', 
    'actionCallbacks',
    'configManager'
  ];
  
  constructor(windowAdapter, stateManager, eventBus, logger, actionCallbacks, configManager) {
    this.windowAdapter = windowAdapter;
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    this.configManager = configManager;
    
    // Service state
    this.windows = new Map();
    this.windowConfigs = new Map();
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    const context = {
      action: 'initialize-game-window-service',
      source: 'GameWindowService',
      data: {}
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Load window configurations
      await this.loadWindowConfigurations();
      
      // Set up event subscriptions
      await this.setupEventSubscriptions();
      
      // Initialize window tracking
      await this.initializeWindowTracking();
      
      this.initialized = true;
      this.logger.info('GameWindowService initialized');
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Failed to initialize GameWindowService', { error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async loadWindowConfigurations() {
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
        },
        email: {
          width: 600,
          height: 800,
          resizable: true,
          frame: true,
          alwaysOnTop: false,
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
    
    this.logger.info('Window configurations loaded', { 
      types: Array.from(this.windowConfigs.keys()) 
    });
  }
  
  async setupEventSubscriptions() {
    // Subscribe to window lifecycle events
    this.eventBus.on('window.closed', this.handleWindowClosed.bind(this));
    this.eventBus.on('window.moved', this.handleWindowMoved.bind(this));
    this.eventBus.on('window.resized', this.handleWindowResized.bind(this));
    
    // Subscribe to game events
    this.eventBus.on('game.level.changed', this.handleLevelChanged.bind(this));
    this.eventBus.on('game.state.reset', this.handleGameReset.bind(this));
  }
  
  async initializeWindowTracking() {
    // Initialize window tracking state
    const existingWindows = await this.stateManager.get('windows', {});
    
    // Clean up any stale window references
    for (const [windowId, windowData] of Object.entries(existingWindows)) {
      if (!await this.isWindowValid(windowId)) {
        await this.stateManager.delete(`windows.${windowId}`);
        this.logger.info('Cleaned up stale window reference', { windowId });
      }
    }
  }
  
  async createGameWindow(type, id, customOptions = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Validate inputs
    this.validateWindowCreationInputs(type, id, customOptions);
    
    const context = {
      action: 'create-game-window',
      source: 'GameWindowService',
      data: { type, id, customOptions }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Check if window already exists
      if (this.windows.has(id)) {
        throw new ValidationError(`Window with id '${id}' already exists`);
      }
      
      // Get base configuration for window type
      const baseConfig = this.windowConfigs.get(type);
      if (!baseConfig) {
        throw new ValidationError(`Unknown window type: ${type}`);
      }
      
      // Merge configurations
      const options = this.mergeWindowOptions(baseConfig, customOptions);
      
      // Create window through platform adapter
      const window = await this.windowAdapter.create(options);
      
      // Load appropriate HTML file
      const htmlFile = this.getHtmlFileForType(type);
      await this.windowAdapter.loadFile(window, htmlFile);
      
      // Set up window event handlers
      await this.setupWindowEventHandlers(window, id, type);
      
      // Store window reference and state
      this.windows.set(id, { window, type, options });
      await this.stateManager.set(`windows.${id}`, {
        type,
        created: Date.now(),
        options,
        active: true
      });
      
      // Emit window created event
      await this.eventBus.emit('window.created', {
        windowId: id,
        type,
        options
      });
      
      this.logger.info('Game window created', { type, id });
      
      await this.actionCallbacks.execute('after', { 
        ...context, 
        success: true, 
        result: { windowId: id } 
      });
      
      return window;
    } catch (error) {
      this.logger.error('Failed to create game window', { 
        type, 
        id, 
        error: error.message 
      });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  validateWindowCreationInputs(type, id, customOptions) {
    if (!type || typeof type !== 'string') {
      throw new ValidationError('Window type must be a non-empty string');
    }
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Window ID must be a non-empty string');
    }
    
    if (customOptions && typeof customOptions !== 'object') {
      throw new ValidationError('Custom options must be an object');
    }
  }
  
  mergeWindowOptions(baseConfig, customOptions) {
    return {
      ...baseConfig,
      ...customOptions,
      webPreferences: {
        ...baseConfig.webPreferences,
        ...(customOptions.webPreferences || {})
      }
    };
  }
  
  getHtmlFileForType(type) {
    const htmlFiles = {
      door: 'renderer/door.html',
      terminal: 'renderer/terminal.html',
      lens: 'renderer/lensViewer.html',
      email: 'renderer/email.html',
      picture: 'renderer/pictureViewer.html',
      content: 'renderer/contentViewer.html',
      startMenu: 'renderer/startMenu.html'
    };
    
    return htmlFiles[type] || 'renderer/index.html';
  }
  
  async setupWindowEventHandlers(window, id, type) {
    // Set up platform-specific event handlers
    await this.windowAdapter.onClosed(window, () => {
      this.handleWindowClosedInternal(id);
    });
    
    await this.windowAdapter.onMoved(window, (bounds) => {
      this.handleWindowMovedInternal(id, bounds);
    });
    
    await this.windowAdapter.onResized(window, (bounds) => {
      this.handleWindowResizedInternal(id, bounds);
    });
    
    await this.windowAdapter.onReady(window, () => {
      this.handleWindowReadyInternal(id, type);
    });
  }
  
  async handleWindowClosedInternal(windowId) {
    const context = {
      action: 'handle-window-closed',
      source: 'GameWindowService',
      data: { windowId }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Remove from tracking
      this.windows.delete(windowId);
      
      // Update state
      await this.stateManager.set(`windows.${windowId}.active`, false);
      await this.stateManager.set(`windows.${windowId}.closed`, Date.now());
      
      // Emit event
      await this.eventBus.emit('window.closed', { windowId });
      
      this.logger.info('Window closed', { windowId });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Error handling window closure', { windowId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
    }
  }
  
  async handleWindowMovedInternal(windowId, bounds) {
    try {
      // Update state with new position
      await this.stateManager.set(`windows.${windowId}.position`, {
        x: bounds.x,
        y: bounds.y,
        updated: Date.now()
      });
      
      // Emit event
      await this.eventBus.emit('window.moved', { windowId, bounds });
      
      this.logger.debug('Window moved', { windowId, bounds });
    } catch (error) {
      this.logger.error('Error handling window move', { windowId, error: error.message });
    }
  }
  
  async handleWindowResizedInternal(windowId, bounds) {
    try {
      // Update state with new size
      await this.stateManager.set(`windows.${windowId}.size`, {
        width: bounds.width,
        height: bounds.height,
        updated: Date.now()
      });
      
      // Emit event
      await this.eventBus.emit('window.resized', { windowId, bounds });
      
      this.logger.debug('Window resized', { windowId, bounds });
    } catch (error) {
      this.logger.error('Error handling window resize', { windowId, error: error.message });
    }
  }
  
  async handleWindowReadyInternal(windowId, type) {
    const context = {
      action: 'handle-window-ready',
      source: 'GameWindowService',
      data: { windowId, type }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Update state
      await this.stateManager.set(`windows.${windowId}.ready`, Date.now());
      
      // Emit event
      await this.eventBus.emit('window.ready', { windowId, type });
      
      this.logger.info('Window ready', { windowId, type });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Error handling window ready', { windowId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
    }
  }
  
  async destroyWindow(windowId) {
    const context = {
      action: 'destroy-window',
      source: 'GameWindowService',
      data: { windowId }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      const windowData = this.windows.get(windowId);
      if (!windowData) {
        throw new ValidationError(`Window '${windowId}' not found`);
      }
      
      // Destroy through platform adapter
      await this.windowAdapter.destroy(windowData.window);
      
      // Cleanup will be handled by the closed event handler
      
      this.logger.info('Window destroyed', { windowId });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Failed to destroy window', { windowId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async getWindow(windowId) {
    const windowData = this.windows.get(windowId);
    return windowData ? windowData.window : null;
  }
  
  async getWindowState(windowId) {
    return await this.stateManager.get(`windows.${windowId}`);
  }
  
  async getAllWindows() {
    const windows = {};
    for (const [id, data] of this.windows.entries()) {
      windows[id] = {
        type: data.type,
        options: data.options
      };
    }
    return windows;
  }
  
  async isWindowValid(windowId) {
    const windowData = this.windows.get(windowId);
    if (!windowData) return false;
    
    return await this.windowAdapter.isValid(windowData.window);
  }
  
  // Event handlers for external events
  async handleWindowClosed(event) {
    // This is called by the event bus for external window close events
    this.logger.debug('External window closed event', event.data);
  }
  
  async handleWindowMoved(event) {
    // This is called by the event bus for external window move events
    this.logger.debug('External window moved event', event.data);
  }
  
  async handleWindowResized(event) {
    // This is called by the event bus for external window resize events
    this.logger.debug('External window resized event', event.data);
  }
  
  async handleLevelChanged(event) {
    const { newLevel, oldLevel } = event.data;
    
    this.logger.info('Game level changed', { newLevel, oldLevel });
    
    // Close level-specific windows
    await this.closeLevelSpecificWindows(oldLevel);
    
    // Open new level windows if needed
    await this.openLevelSpecificWindows(newLevel);
  }
  
  async handleGameReset(event) {
    this.logger.info('Game reset, closing all windows');
    
    // Close all game windows except essential ones
    const windowIds = Array.from(this.windows.keys());
    for (const windowId of windowIds) {
      const windowData = this.windows.get(windowId);
      if (windowData && windowData.type !== 'terminal') {
        await this.destroyWindow(windowId);
      }
    }
  }
  
  async closeLevelSpecificWindows(level) {
    // Implementation for closing level-specific windows
    const levelWindows = await this.stateManager.get(`levels.${level}.windows`, []);
    
    for (const windowId of levelWindows) {
      if (this.windows.has(windowId)) {
        await this.destroyWindow(windowId);
      }
    }
  }
  
  async openLevelSpecificWindows(level) {
    // Implementation for opening level-specific windows
    const levelConfig = await this.stateManager.get(`levels.${level}.config`);
    
    if (levelConfig && levelConfig.windows) {
      for (const windowConfig of levelConfig.windows) {
        await this.createGameWindow(
          windowConfig.type,
          windowConfig.id,
          windowConfig.options
        );
      }
    }
  }
  
  async cleanup() {
    const context = {
      action: 'cleanup-game-window-service',
      source: 'GameWindowService',
      data: {}
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Close all windows
      const windowIds = Array.from(this.windows.keys());
      for (const windowId of windowIds) {
        await this.destroyWindow(windowId);
      }
      
      // Clear state
      this.windows.clear();
      this.windowConfigs.clear();
      this.initialized = false;
      
      this.logger.info('GameWindowService cleaned up');
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Error during GameWindowService cleanup', { error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
}
```

## Door-Key Service Implementation

### Complete Implementation

```javascript
// src/services/DoorKeyService.js
import { ValidationError, SystemError } from '../foundation/error/ErrorHandler.js';

export class DoorKeyService {
  static dependencies = [
    'stateManager',
    'eventBus',
    'logger',
    'actionCallbacks',
    'configManager',
    'resourceManager'
  ];
  
  constructor(stateManager, eventBus, logger, actionCallbacks, configManager, resourceManager) {
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.logger = logger;
    this.actionCallbacks = actionCallbacks;
    this.configManager = configManager;
    this.resourceManager = resourceManager;
    
    // Service state
    this.relationships = new Map();
    this.doors = new Map();
    this.keys = new Map();
    this.config = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    const context = {
      action: 'initialize-door-key-service',
      source: 'DoorKeyService',
      data: {}
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Load configuration
      await this.loadConfiguration();
      
      // Load existing doors and keys
      await this.loadDoorsAndKeys();
      
      // Load existing relationships
      await this.loadRelationships();
      
      // Set up event subscriptions
      await this.setupEventSubscriptions();
      
      this.initialized = true;
      this.logger.info('DoorKeyService initialized');
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Failed to initialize DoorKeyService', { error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async loadConfiguration() {
    this.config = await this.configManager.load('doorKey.json', {
      defaults: {
        overlapThreshold: 0.5,
        autoUnlock: true,
        persistRelationships: true,
        validationRules: {
          requireKeyForDoor: true,
          allowMultipleKeys: false,
          checkKeyPermissions: true,
          validateOverlap: true
        },
        permissions: {
          defaultKeyPermissions: [],
          adminKeys: [],
          masterKeys: []
        }
      }
    });
    
    this.logger.info('Door-key configuration loaded', { config: this.config });
  }
  
  async loadDoorsAndKeys() {
    // Load doors from state
    const doorsData = await this.stateManager.get('doors', {});
    for (const [doorId, doorData] of Object.entries(doorsData)) {
      this.doors.set(doorId, doorData);
    }
    
    // Load keys from state
    const keysData = await this.stateManager.get('keys', {});
    for (const [keyId, keyData] of Object.entries(keysData)) {
      this.keys.set(keyId, keyData);
    }
    
    this.logger.info('Doors and keys loaded', {
      doors: this.doors.size,
      keys: this.keys.size
    });
  }
  
  async loadRelationships() {
    const relationshipsData = await this.stateManager.get('relationships', {});
    
    for (const [doorId, doorRelationships] of Object.entries(relationshipsData)) {
      for (const [keyId, relationship] of Object.entries(doorRelationships)) {
        if (relationship.active) {
          const relationshipKey = `${doorId}:${keyId}`;
          this.relationships.set(relationshipKey, relationship);
        }
      }
    }
    
    this.logger.info('Relationships loaded', { count: this.relationships.size });
  }
  
  async setupEventSubscriptions() {
    // Subscribe to door events
    this.eventBus.on('door.created', this.handleDoorCreated.bind(this));
    this.eventBus.on('door.destroyed', this.handleDoorDestroyed.bind(this));
    
    // Subscribe to key events
    this.eventBus.on('key.created', this.handleKeyCreated.bind(this));
    this.eventBus.on('key.destroyed', this.handleKeyDestroyed.bind(this));
    
    // Subscribe to window events for overlap detection
    this.eventBus.on('window.moved', this.handleWindowMoved.bind(this));
    this.eventBus.on('window.resized', this.handleWindowResized.bind(this));
  }
  
  async createDoor(doorId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const context = {
      action: 'create-door',
      source: 'DoorKeyService',
      data: { doorId, options }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Validate door creation
      if (this.doors.has(doorId)) {
        throw new ValidationError(`Door '${doorId}' already exists`);
      }
      
      // Create door data
      const doorData = {
        id: doorId,
        created: Date.now(),
        state: 'closed',
        position: options.position || { x: 0, y: 0 },
        size: options.size || { width: 400, height: 600 },
        permissions: options.permissions || [],
        metadata: options.metadata || {},
        ...options
      };
      
      // Store door
      this.doors.set(doorId, doorData);
      await this.stateManager.set(`doors.${doorId}`, doorData);
      
      // Emit event
      await this.eventBus.emit('door.created', { doorId, doorData });
      
      this.logger.info('Door created', { doorId });
      
      await this.actionCallbacks.execute('after', { 
        ...context, 
        success: true, 
        result: { doorId } 
      });
      
      return doorData;
    } catch (error) {
      this.logger.error('Failed to create door', { doorId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async createKey(keyId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const context = {
      action: 'create-key',
      source: 'DoorKeyService',
      data: { keyId, options }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Validate key creation
      if (this.keys.has(keyId)) {
        throw new ValidationError(`Key '${keyId}' already exists`);
      }
      
      // Create key data
      const keyData = {
        id: keyId,
        created: Date.now(),
        position: options.position || { x: 0, y: 0 },
        size: options.size || { width: 50, height: 50 },
        permissions: options.permissions || this.config.permissions.defaultKeyPermissions,
        type: options.type || 'standard',
        metadata: options.metadata || {},
        ...options
      };
      
      // Store key
      this.keys.set(keyId, keyData);
      await this.stateManager.set(`keys.${keyId}`, keyData);
      
      // Emit event
      await this.eventBus.emit('key.created', { keyId, keyData });
      
      this.logger.info('Key created', { keyId });
      
      await this.actionCallbacks.execute('after', { 
        ...context, 
        success: true, 
        result: { keyId } 
      });
      
      return keyData;
    } catch (error) {
      this.logger.error('Failed to create key', { keyId, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async establishRelationship(doorId, keyId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const context = {
      action: 'establish-relationship',
      source: 'DoorKeyService',
      data: { doorId, keyId, options }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Validate relationship
      await this.validateRelationship(doorId, keyId);
      
      // Check overlap if required
      if (this.config.validationRules.validateOverlap) {
        const overlap = await this.calculateOverlap(doorId, keyId);
        if (overlap < this.config.overlapThreshold) {
          throw new ValidationError(
            `Insufficient overlap: ${overlap.toFixed(2)} < ${this.config.overlapThreshold}`
          );
        }
      }
      
      // Create relationship
      const relationship = {
        doorId,
        keyId,
        established: Date.now(),
        overlap: await this.calculateOverlap(doorId, keyId),
        options,
        active: true,
        metadata: options.metadata || {}
      };
      
      // Store relationship
      const relationshipKey = `${doorId}:${keyId}`;
      this.relationships.set(relationshipKey, relationship);
      await this.stateManager.set(`relationships.${doorId}.${keyId}`, relationship);
      
      // Update door and key states
      await this.updateDoorState(doorId, 'unlocked');
      await this.updateKeyState(keyId, 'used');
      
      // Emit event
      await this.eventBus.emit('door-key.relationship-established', {
        doorId,
        keyId,
        relationship
      });
      
      this.logger.info('Door-key relationship established', { doorId, keyId });
      
      await this.actionCallbacks.execute('after', { 
        ...context, 
        success: true, 
        result: { relationship } 
      });
      
      return relationship;
    } catch (error) {
      this.logger.error('Failed to establish relationship', { 
        doorId, 
        keyId, 
        error: error.message 
      });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async validateRelationship(doorId, keyId) {
    // Check if door exists
    if (!this.doors.has(doorId)) {
      throw new ValidationError(`Door '${doorId}' not found`);
    }
    
    // Check if key exists
    if (!this.keys.has(keyId)) {
      throw new ValidationError(`Key '${keyId}' not found`);
    }
    
    // Check if relationship already exists
    const relationshipKey = `${doorId}:${keyId}`;
    if (this.relationships.has(relationshipKey)) {
      throw new ValidationError(`Relationship between '${doorId}' and '${keyId}' already exists`);
    }
    
    // Validate based on configuration rules
    if (this.config.validationRules.requireKeyForDoor) {
      const keyData = this.keys.get(keyId);
      if (!keyData) {
        throw new ValidationError(`Key '${keyId}' not found`);
      }
    }
    
    if (!this.config.validationRules.allowMultipleKeys) {
      // Check if door already has a key
      const existingRelationships = Array.from(this.relationships.keys())
        .filter(key => key.startsWith(`${doorId}:`));
      
      if (existingRelationships.length > 0) {
        throw new ValidationError(`Door '${doorId}' already has a key relationship`);
      }
    }
    
    if (this.config.validationRules.checkKeyPermissions) {
      const keyData = this.keys.get(keyId);
      const doorData = this.doors.get(doorId);
      
      // Check if key has permission for this door
      if (keyData.permissions.length > 0 && !keyData.permissions.includes(doorId)) {
        // Check for master keys
        const isMasterKey = this.config.permissions.masterKeys.includes(keyId);
        const isAdminKey = this.config.permissions.adminKeys.includes(keyId);
        
        if (!isMasterKey && !isAdminKey) {
          throw new ValidationError(`Key '${keyId}' does not have permission for door '${doorId}'`);
        }
      }
    }
  }
  
  async calculateOverlap(doorId, keyId) {
    const doorData = this.doors.get(doorId);
    const keyData = this.keys.get(keyId);
    
    if (!doorData || !keyData) {
      return 0;
    }
    
    // Calculate bounding rectangles
    const doorRect = {
      x: doorData.position.x,
      y: doorData.position.y,
      width: doorData.size.width,
      height: doorData.size.height
    };
    
    const keyRect = {
      x: keyData.position.x,
      y: keyData.position.y,
      width: keyData.size.width,
      height: keyData.size.height
    };
    
    // Calculate intersection
    const intersectionX = Math.max(doorRect.x, keyRect.x);
    const intersectionY = Math.max(doorRect.y, keyRect.y);
    const intersectionWidth = Math.min(
      doorRect.x + doorRect.width,
      keyRect.x + keyRect.width
    ) - intersectionX;
    const intersectionHeight = Math.min(
      doorRect.y + doorRect.height,
      keyRect.y + keyRect.height
    ) - intersectionY;
    
    // Check if there's actual intersection
    if (intersectionWidth <= 0 || intersectionHeight <= 0) {
      return 0;
    }
    
    // Calculate overlap percentage
    const intersectionArea = intersectionWidth * intersectionHeight;
    const keyArea = keyRect.width * keyRect.height;
    
    return intersectionArea / keyArea;
  }
  
  async updateDoorState(doorId, newState) {
    const doorData = this.doors.get(doorId);
    if (!doorData) return;
    
    const oldState = doorData.state;
    doorData.state = newState;
    doorData.stateChanged = Date.now();
    
    // Update in memory and persistent storage
    this.doors.set(doorId, doorData);
    await this.stateManager.set(`doors.${doorId}`, doorData);
    
    // Emit event
    await this.eventBus.emit('door.state-changed', {
      doorId,
      newState,
      oldState,
      timestamp: doorData.stateChanged
    });
    
    this.logger.info('Door state updated', { doorId, oldState, newState });
  }
  
  async updateKeyState(keyId, newState) {
    const keyData = this.keys.get(keyId);
    if (!keyData) return;
    
    const oldState = keyData.state || 'unused';
    keyData.state = newState;
    keyData.stateChanged = Date.now();
    
    // Update in memory and persistent storage
    this.keys.set(keyId, keyData);
    await this.stateManager.set(`keys.${keyId}`, keyData);
    
    // Emit event
    await this.eventBus.emit('key.state-changed', {
      keyId,
      newState,
      oldState,
      timestamp: keyData.stateChanged
    });
    
    this.logger.info('Key state updated', { keyId, oldState, newState });
  }
  
  async removeRelationship(doorId, keyId) {
    const context = {
      action: 'remove-relationship',
      source: 'DoorKeyService',
      data: { doorId, keyId }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      const relationshipKey = `${doorId}:${keyId}`;
      const relationship = this.relationships.get(relationshipKey);
      
      if (!relationship) {
        throw new ValidationError(`Relationship between '${doorId}' and '${keyId}' not found`);
      }
      
      // Remove relationship
      this.relationships.delete(relationshipKey);
      await this.stateManager.set(`relationships.${doorId}.${keyId}.active`, false);
      await this.stateManager.set(`relationships.${doorId}.${keyId}.removed`, Date.now());
      
      // Update states
      await this.updateDoorState(doorId, 'locked');
      await this.updateKeyState(keyId, 'unused');
      
      // Emit event
      await this.eventBus.emit('door-key.relationship-removed', {
        doorId,
        keyId,
        relationship
      });
      
      this.logger.info('Door-key relationship removed', { doorId, keyId });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Failed to remove relationship', { 
        doorId, 
        keyId, 
        error: error.message 
      });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
  
  async getRelationship(doorId, keyId) {
    const relationshipKey = `${doorId}:${keyId}`;
    return this.relationships.get(relationshipKey) || null;
  }
  
  async getRelationshipsForDoor(doorId) {
    const relationships = [];
    for (const [key, relationship] of this.relationships.entries()) {
      if (key.startsWith(`${doorId}:`)) {
        relationships.push(relationship);
      }
    }
    return relationships;
  }
  
  async getRelationshipsForKey(keyId) {
    const relationships = [];
    for (const [key, relationship] of this.relationships.entries()) {
      if (key.endsWith(`:${keyId}`)) {
        relationships.push(relationship);
      }
    }
    return relationships;
  }
  
  async getAllRelationships() {
    return Array.from(this.relationships.values());
  }
  
  // Event handlers
  async handleDoorCreated(event) {
    const { doorId, doorData } = event.data;
    this.doors.set(doorId, doorData);
    this.logger.debug('Door created event handled', { doorId });
  }
  
  async handleDoorDestroyed(event) {
    const { doorId } = event.data;
    
    // Remove all relationships for this door
    const doorRelationships = await this.getRelationshipsForDoor(doorId);
    for (const relationship of doorRelationships) {
      await this.removeRelationship(relationship.doorId, relationship.keyId);
    }
    
    // Remove door
    this.doors.delete(doorId);
    await this.stateManager.delete(`doors.${doorId}`);
    
    this.logger.info('Door destroyed and relationships cleaned up', { doorId });
  }
  
  async handleKeyCreated(event) {
    const { keyId, keyData } = event.data;
    this.keys.set(keyId, keyData);
    this.logger.debug('Key created event handled', { keyId });
  }
  
  async handleKeyDestroyed(event) {
    const { keyId } = event.data;
    
    // Remove all relationships for this key
    const keyRelationships = await this.getRelationshipsForKey(keyId);
    for (const relationship of keyRelationships) {
      await this.removeRelationship(relationship.doorId, relationship.keyId);
    }
    
    // Remove key
    this.keys.delete(keyId);
    await this.stateManager.delete(`keys.${keyId}`);
    
    this.logger.info('Key destroyed and relationships cleaned up', { keyId });
  }
  
  async handleWindowMoved(event) {
    const { windowId, bounds } = event.data;
    
    // Update position for doors and keys
    if (this.doors.has(windowId)) {
      const doorData = this.doors.get(windowId);
      doorData.position = { x: bounds.x, y: bounds.y };
      this.doors.set(windowId, doorData);
      await this.stateManager.set(`doors.${windowId}.position`, doorData.position);
    }
    
    if (this.keys.has(windowId)) {
      const keyData = this.keys.get(windowId);
      keyData.position = { x: bounds.x, y: bounds.y };
      this.keys.set(windowId, keyData);
      await this.stateManager.set(`keys.${windowId}.position`, keyData.position);
    }
    
    // Check for new overlaps
    await this.checkForNewOverlaps();
  }
  
  async handleWindowResized(event) {
    const { windowId, bounds } = event.data;
    
    // Update size for doors and keys
    if (this.doors.has(windowId)) {
      const doorData = this.doors.get(windowId);
      doorData.size = { width: bounds.width, height: bounds.height };
      this.doors.set(windowId, doorData);
      await this.stateManager.set(`doors.${windowId}.size`, doorData.size);
    }
    
    if (this.keys.has(windowId)) {
      const keyData = this.keys.get(windowId);
      keyData.size = { width: bounds.width, height: bounds.height };
      this.keys.set(windowId, keyData);
      await this.stateManager.set(`keys.${windowId}.size`, keyData.size);
    }
    
    // Check for new overlaps
    await this.checkForNewOverlaps();
  }
  
  async checkForNewOverlaps() {
    if (!this.config.autoUnlock) return;
    
    // Check all door-key combinations for new overlaps
    for (const [doorId, doorData] of this.doors.entries()) {
      for (const [keyId, keyData] of this.keys.entries()) {
        const relationshipKey = `${doorId}:${keyId}`;
        
        // Skip if relationship already exists
        if (this.relationships.has(relationshipKey)) continue;
        
        // Calculate overlap
        const overlap = await this.calculateOverlap(doorId, keyId);
        
        // Establish relationship if overlap threshold is met
        if (overlap >= this.config.overlapThreshold) {
          try {
            await this.establishRelationship(doorId, keyId, {
              autoEstablished: true,
              overlap
            });
          } catch (error) {
            // Log but don't throw - this is automatic behavior
            this.logger.debug('Auto-relationship establishment failed', {
              doorId,
              keyId,
              error: error.message
            });
          }
        }
      }
    }
  }
  
  async cleanup() {
    const context = {
      action: 'cleanup-door-key-service',
      source: 'DoorKeyService',
      data: {}
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Clear in-memory state
      this.relationships.clear();
      this.doors.clear();
      this.keys.clear();
      this.config = null;
      this.initialized = false;
      
      this.logger.info('DoorKeyService cleaned up');
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
    } catch (error) {
      this.logger.error('Error during DoorKeyService cleanup', { error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
}
```

## Service Testing Examples

### Unit Testing with Mocks

```javascript
// test/services/gameWindowService.test.js
import { GameWindowService } from '../../src/services/GameWindowService.js';
import { MockFactory } from '../../src/foundation/testing/MockFactory.js';

describe('GameWindowService', () => {
  let gameWindowService;
  let mockWindowAdapter;
  let mockStateManager;
  let mockEventBus;
  let mockLogger;
  let mockActionCallbacks;
  let mockConfigManager;
  
  beforeEach(() => {
    // Create mocks using foundation testing utilities
    mockWindowAdapter = MockFactory.createWindowAdapter();
    mockStateManager = MockFactory.createStateManager();
    mockEventBus = MockFactory.createEventBus();
    mockLogger = MockFactory.createLogger();
    mockActionCallbacks = MockFactory.createActionCallbacks();
    mockConfigManager = MockFactory.createConfigManager();
    
    // Create service with mocked dependencies
    gameWindowService = new GameWindowService(
      mockWindowAdapter,
      mockStateManager,
      mockEventBus,
      mockLogger,
      mockActionCallbacks,
      mockConfigManager
    );
  });
  
  describe('createGameWindow', () => {
    it('should create window with proper configuration', async () => {
      // Arrange
      const type = 'door';
      const id = 'test-door';
      const customOptions = { width: 500 };
      
      mockConfigManager.load.mockResolvedValue({
        door: {
          width: 400,
          height: 600,
          resizable: false
        }
      });
      
      mockWindowAdapter.create.mockResolvedValue({ id: 'window-1' });
      mockStateManager.get.mockResolvedValue({});
      
      // Act
      const result = await gameWindowService.createGameWindow(type, id, customOptions);
      
      // Assert
      expect(mockActionCallbacks.execute).toHaveBeenCalledWith('before', 
        expect.objectContaining({
          action: 'create-game-window',
          source: 'GameWindowService',
          data: { type, id, customOptions }
        })
      );
      
      expect(mockWindowAdapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 500, // Custom option should override default
          height: 600,
          resizable: false
        })
      );
      
      expect(mockStateManager.set).toHaveBeenCalledWith(
        `windows.${id}`,
        expect.objectContaining({
          type,
          active: true
        })
      );
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('window.created', {
        windowId: id,
        type,
        options: expect.any(Object)
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith('Game window created', { type, id });
      
      expect(mockActionCallbacks.execute).toHaveBeenCalledWith('after',
        expect.objectContaining({
          action: 'create-game-window',
          success: true
        })
      );
      
      expect(result).toEqual({ id: 'window-1' });
    });
    
    it('should handle window creation failure', async () => {
      // Arrange
      const type = 'door';
      const id = 'test-door';
      const error = new Error('Window creation failed');
      
      mockConfigManager.load.mockResolvedValue({ door: {} });
      mockWindowAdapter.create.mockRejectedValue(error);
      
      // Act & Assert
      await expect(gameWindowService.createGameWindow(type, id)).rejects.toThrow(error);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create game window',
        expect.objectContaining({
          type,
          id,
          error: error.message
        })
      );
      
      expect(mockActionCallbacks.execute).toHaveBeenCalledWith('error',
        expect.objectContaining({
          action: 'create-game-window',
          error
        })
      );
    });
    
    it('should validate input parameters', async () => {
      // Act & Assert
      await expect(gameWindowService.createGameWindow('', 'test-id')).rejects.toThrow(
        'Window type must be a non-empty string'
      );
      
      await expect(gameWindowService.createGameWindow('door', '')).rejects.toThrow(
        'Window ID must be a non-empty string'
      );
      
      await expect(gameWindowService.createGameWindow('door', 'test-id', 'invalid')).rejects.toThrow(
        'Custom options must be an object'
      );
    });
  });
  
  describe('destroyWindow', () => {
    it('should destroy existing window', async () => {
      // Arrange
      const windowId = 'test-window';
      const mockWindow = { id: 'window-1' };
      
      gameWindowService.windows.set(windowId, {
        window: mockWindow,
        type: 'door',
        options: {}
      });
      
      // Act
      await gameWindowService.destroyWindow(windowId);
      
      // Assert
      expect(mockWindowAdapter.destroy).toHaveBeenCalledWith(mockWindow);
      expect(mockLogger.info).toHaveBeenCalledWith('Window destroyed', { windowId });
    });
    
    it('should handle non-existent window', async () => {
      // Act & Assert
      await expect(gameWindowService.destroyWindow('non-existent')).rejects.toThrow(
        "Window 'non-existent' not found"
      );
    });
  });
});
```

### Integration Testing

```javascript
// test/integration/serviceLayer.test.js
import { configureTestingContainer } from '../config/testing/containerConfig.js';

describe('Service Layer Integration', () => {
  let container;
  let gameWindowService;
  let doorKeyService;
  
  beforeEach(() => {
    container = configureTestingContainer();
    gameWindowService = container.resolve('gameWindowService');
    doorKeyService = container.resolve('doorKeyService');
  });
  
  it('should integrate window and door-key services', async () => {
    // Create a door window
    const doorWindow = await gameWindowService.createGameWindow('door', 'test-door');
    
    // Create a door in the door-key service
    const doorData = await doorKeyService.createDoor('test-door', {
      position: { x: 100, y: 100 },
      size: { width: 400, height: 600 }
    });
    
    // Create a key
    const keyData = await doorKeyService.createKey('test-key', {
      position: { x: 150, y: 200 },
      size: { width: 50, height: 50 }
    });
    
    // Establish relationship
    const relationship = await doorKeyService.establishRelationship('test-door', 'test-key');
    
    // Verify integration
    expect(doorWindow).toBeDefined();
    expect(doorData).toBeDefined();
    expect(keyData).toBeDefined();
    expect(relationship).toBeDefined();
    expect(relationship.doorId).toBe('test-door');
    expect(relationship.keyId).toBe('test-key');
  });
});
```

## Best Practices Summary

### Service Implementation Checklist

- [ ] **Dependencies declared**: Static `dependencies` array with all required foundation services
- [ ] **Constructor injection**: All dependencies injected through constructor
- [ ] **Initialization method**: Async `initialize()` method for setup
- [ ] **Action tracking**: All significant operations tracked with action callbacks
- [ ] **Structured logging**: All operations logged with structured data
- [ ] **State management**: All persistent state managed through StateManager
- [ ] **Event integration**: Service emits and subscribes to relevant events
- [ ] **Error handling**: Comprehensive error handling with structured context
- [ ] **Validation**: Input validation for all public methods
- [ ] **Cleanup method**: Proper cleanup of resources and state
- [ ] **Testing**: Unit tests with mocks and integration tests

### Common Patterns

1. **Operation Pattern**: Before/after action callbacks with error handling
2. **State Pattern**: Use StateManager for all persistent data
3. **Event Pattern**: Emit events for significant state changes
4. **Validation Pattern**: Validate inputs early and provide clear error messages
5. **Configuration Pattern**: Load configuration through ConfigManager
6. **Cleanup Pattern**: Implement proper resource cleanup

This guide provides the foundation for implementing robust, testable, and maintainable service layer components that integrate seamlessly with the foundational abstraction system.