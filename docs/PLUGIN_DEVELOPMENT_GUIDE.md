# Plugin Development Guide

## Overview

This guide provides comprehensive documentation for developing plugins for the Fenestra foundational abstraction system. Plugins enable extending application functionality without modifying core code, using the foundation layer's dependency injection, event system, state management, and hook system.

## Plugin Architecture

### Core Concepts

1. **Plugin Base Class**: All plugins extend the foundation `Plugin` class
2. **Dependency Injection**: Plugins receive foundation services through the container
3. **Hook System**: Plugins register hooks at specific extension points
4. **Event Integration**: Plugins can subscribe to and emit events
5. **State Management**: Plugins can store and retrieve state through StateManager
6. **Action Callbacks**: Plugins can register callbacks for all system operations
7. **Lifecycle Management**: Plugins have initialize, activate, deactivate, and cleanup phases

### Plugin Lifecycle

```mermaid
graph TD
    A[Plugin Loaded] --> B[Constructor Called]
    B --> C[Dependencies Resolved]
    C --> D[initialize() Called]
    D --> E[activate() Called]
    E --> F[Plugin Active]
    F --> G[deactivate() Called]
    G --> H[cleanup() Called]
    H --> I[Plugin Unloaded]
    
    F --> J[Hot Reload]
    J --> G
```

## Basic Plugin Structure

### Minimal Plugin Template

```javascript
// plugins/example-plugin/index.js
import { Plugin } from '../../src/foundation/plugins/Plugin.js';

export class ExamplePlugin extends Plugin {
  constructor() {
    super('example-plugin', '1.0.0', {
      description: 'Example plugin demonstrating basic functionality',
      author: 'Your Name',
      dependencies: ['logger', 'stateManager', 'eventBus']
    });
  }
  
  async initialize(container, hookSystem) {
    // Resolve dependencies from the container
    this.logger = container.resolve('logger')('ExamplePlugin');
    this.stateManager = container.resolve('stateManager');
    this.eventBus = container.resolve('eventBus');
    
    this.logger.info('Example plugin initializing');
  }
  
  async activate() {
    this.logger.info('Example plugin activated');
  }
  
  async deactivate() {
    this.logger.info('Example plugin deactivated');
  }
  
  async cleanup() {
    this.logger.info('Example plugin cleaning up');
  }
}
```

### Plugin Metadata File

```json
// plugins/example-plugin/plugin.json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example plugin demonstrating basic functionality",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.js",
  "dependencies": {
    "foundation": "^2.0.0"
  },
  "permissions": [
    "state.read",
    "state.write",
    "events.subscribe",
    "events.emit",
    "hooks.register",
    "actions.register"
  ],
  "configuration": {
    "enabled": true,
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

## Advanced Plugin Examples

### Game Enhancement Plugin

```javascript
// plugins/game-enhancement/index.js
import { Plugin } from '../../src/foundation/plugins/Plugin.js';

export class GameEnhancementPlugin extends Plugin {
  constructor() {
    super('game-enhancement', '1.0.0', {
      description: 'Enhances game functionality with custom features',
      author: 'Game Team',
      dependencies: [
        'logger', 
        'stateManager', 
        'eventBus', 
        'actionCallbacks',
        'gameWindowService',
        'doorKeyService'
      ]
    });
    
    // Plugin-specific state
    this.enhancedWindows = new Set();
    this.customFeatures = new Map();
  }
  
  async initialize(container, hookSystem) {
    // Resolve foundation dependencies
    this.logger = container.resolve('logger')('GameEnhancementPlugin');
    this.stateManager = container.resolve('stateManager');
    this.eventBus = container.resolve('eventBus');
    this.actionCallbacks = container.resolve('actionCallbacks');
    
    // Resolve service dependencies
    this.gameWindowService = container.resolve('gameWindowService');
    this.doorKeyService = container.resolve('doorKeyService');
    
    // Load plugin configuration
    await this.loadConfiguration();
    
    // Register hooks
    hookSystem.register('game.level.loaded', this.onLevelLoaded.bind(this));
    hookSystem.register('window.created', this.onWindowCreated.bind(this));
    hookSystem.register('door.opened', this.onDoorOpened.bind(this));
    
    // Register action callbacks
    this.actionCallbacks.register('create-window', this.onWindowAction.bind(this), {
      priority: 50,
      source: 'game-enhancement-plugin'
    });
    
    // Subscribe to events
    this.eventBus.on('door-key.relationship-established', this.onRelationshipEstablished.bind(this));
    this.eventBus.on('game.state.changed', this.onGameStateChanged.bind(this));
    
    this.logger.info('Game enhancement plugin initialized');
  }
  
  async loadConfiguration() {
    this.config = await this.stateManager.get(`plugins.${this.name}.config`, {
      enableAnimations: true,
      enableSoundEffects: false,
      enableCustomStyling: true,
      enhancementLevel: 'standard',
      features: {
        doorGlow: true,
        keySparkle: true,
        successAnimation: true,
        hintSystem: false
      }
    });
    
    this.logger.info('Plugin configuration loaded', { config: this.config });
  }
  
  async activate() {
    // Initialize plugin features based on configuration
    if (this.config.enableAnimations) {
      await this.initializeAnimations();
    }
    
    if (this.config.enableCustomStyling) {
      await this.initializeCustomStyling();
    }
    
    // Load existing game state and apply enhancements
    await this.applyEnhancementsToExistingElements();
    
    this.logger.info('Game enhancement plugin activated');
  }
  
  async initializeAnimations() {
    // Set up CSS animations and transitions
    const animationCSS = `
      .enhanced-door {
        transition: all 0.3s ease-in-out;
        box-shadow: 0 0 10px rgba(0, 150, 255, 0.3);
      }
      
      .enhanced-door.unlocked {
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
        transform: scale(1.02);
      }
      
      .enhanced-key {
        transition: all 0.2s ease-in-out;
      }
      
      .enhanced-key.used {
        animation: keySparkle 1s ease-in-out;
      }
      
      @keyframes keySparkle {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.1); }
      }
    `;
    
    // Inject CSS into all game windows
    await this.injectCSS(animationCSS);
    
    this.logger.info('Animations initialized');
  }
  
  async initializeCustomStyling() {
    const customCSS = `
      .enhanced-window {
        border: 2px solid #4a90e2;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      .enhanced-content {
        padding: 10px;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      }
    `;
    
    await this.injectCSS(customCSS);
    
    this.logger.info('Custom styling initialized');
  }
  
  async injectCSS(css) {
    // Get all active windows and inject CSS
    const windows = await this.gameWindowService.getAllWindows();
    
    for (const [windowId, windowData] of Object.entries(windows)) {
      const window = await this.gameWindowService.getWindow(windowId);
      if (window) {
        await this.injectCSSIntoWindow(window, css);
      }
    }
  }
  
  async injectCSSIntoWindow(window, css) {
    // Use window adapter to inject CSS
    const script = `
      const style = document.createElement('style');
      style.textContent = \`${css}\`;
      document.head.appendChild(style);
    `;
    
    // Execute script in window context
    await window.webContents.executeJavaScript(script);
  }
  
  async applyEnhancementsToExistingElements() {
    // Apply enhancements to existing doors and keys
    const doors = await this.stateManager.get('doors', {});
    const keys = await this.stateManager.get('keys', {});
    
    for (const doorId of Object.keys(doors)) {
      await this.enhanceDoor(doorId);
    }
    
    for (const keyId of Object.keys(keys)) {
      await this.enhanceKey(keyId);
    }
    
    this.logger.info('Enhancements applied to existing elements', {
      doors: Object.keys(doors).length,
      keys: Object.keys(keys).length
    });
  }
  
  // Hook handlers
  async onLevelLoaded(levelData) {
    this.logger.info('Level loaded, applying enhancements', { level: levelData.id });
    
    // Add custom features to level data
    levelData.enhancements = {
      plugin: this.name,
      version: this.version,
      features: Object.keys(this.config.features).filter(
        feature => this.config.features[feature]
      ),
      applied: Date.now()
    };
    
    // Track level statistics
    await this.trackLevelStats(levelData.id);
    
    return levelData;
  }
  
  async onWindowCreated(windowData) {
    this.logger.info('Window created, applying enhancements', { windowId: windowData.id });
    
    // Apply enhancements based on window type
    if (windowData.type === 'door') {
      await this.enhanceDoor(windowData.id);
    } else if (windowData.type === 'key') {
      await this.enhanceKey(windowData.id);
    }
    
    // Mark window as enhanced
    this.enhancedWindows.add(windowData.id);
    
    return windowData;
  }
  
  async onDoorOpened(doorData) {
    this.logger.info('Door opened, triggering success animation', { doorId: doorData.id });
    
    if (this.config.features.successAnimation) {
      await this.playSuccessAnimation(doorData.id);
    }
    
    // Track door opening statistics
    await this.trackDoorOpeningStats(doorData.id);
    
    return doorData;
  }
  
  // Action callback handlers
  async onWindowAction(context) {
    if (context.phase === 'before' && context.action === 'create-window') {
      this.logger.debug('Window creation starting', { 
        windowId: context.data.id,
        type: context.data.type 
      });
      
      // Pre-process window options
      if (this.config.enableCustomStyling) {
        context.data.options = this.enhanceWindowOptions(context.data.options);
      }
    } else if (context.phase === 'after' && context.success) {
      this.logger.debug('Window creation completed', { 
        windowId: context.data.id,
        duration: context.duration 
      });
      
      // Post-process created window
      await this.postProcessWindow(context.data.id, context.data.type);
    }
  }
  
  enhanceWindowOptions(options) {
    return {
      ...options,
      webPreferences: {
        ...options.webPreferences,
        additionalArguments: [
          ...(options.webPreferences.additionalArguments || []),
          '--enable-features=VizDisplayCompositor'
        ]
      }
    };
  }
  
  async postProcessWindow(windowId, type) {
    // Apply post-creation enhancements
    const window = await this.gameWindowService.getWindow(windowId);
    if (window && this.config.enableCustomStyling) {
      await this.applyWindowEnhancements(window, type);
    }
  }
  
  // Event handlers
  async onRelationshipEstablished(event) {
    const { doorId, keyId, relationship } = event.data;
    
    this.logger.info('Relationship established, applying enhancements', { doorId, keyId });
    
    if (this.config.features.doorGlow) {
      await this.addDoorGlow(doorId);
    }
    
    if (this.config.features.keySparkle) {
      await this.addKeySparkle(keyId);
    }
    
    // Store custom relationship data
    await this.stateManager.set(`plugins.${this.name}.relationships.${doorId}.${keyId}`, {
      enhanced: true,
      timestamp: Date.now(),
      features: {
        doorGlow: this.config.features.doorGlow,
        keySparkle: this.config.features.keySparkle
      }
    });
  }
  
  async onGameStateChanged(event) {
    const { path, newValue, oldValue } = event.data;
    
    this.logger.debug('Game state changed', { path, newValue, oldValue });
    
    // React to specific state changes
    if (path.startsWith('doors.') && path.endsWith('.state')) {
      const doorId = path.split('.')[1];
      await this.handleDoorStateChange(doorId, newValue, oldValue);
    }
  }
  
  // Enhancement methods
  async enhanceDoor(doorId) {
    const window = await this.gameWindowService.getWindow(doorId);
    if (!window) return;
    
    const enhancementScript = `
      document.body.classList.add('enhanced-door');
      
      // Add glow effect if enabled
      if (${this.config.features.doorGlow}) {
        document.body.style.boxShadow = '0 0 15px rgba(0, 150, 255, 0.4)';
      }
      
      // Add hover effects
      document.body.addEventListener('mouseenter', () => {
        document.body.style.transform = 'scale(1.01)';
      });
      
      document.body.addEventListener('mouseleave', () => {
        document.body.style.transform = 'scale(1)';
      });
    `;
    
    await window.webContents.executeJavaScript(enhancementScript);
    
    // Store enhancement state
    await this.stateManager.set(`plugins.${this.name}.doors.${doorId}`, {
      enhanced: true,
      timestamp: Date.now(),
      features: ['glow', 'hover']
    });
    
    this.logger.debug('Door enhanced', { doorId });
  }
  
  async enhanceKey(keyId) {
    const window = await this.gameWindowService.getWindow(keyId);
    if (!window) return;
    
    const enhancementScript = `
      document.body.classList.add('enhanced-key');
      
      // Add sparkle effect if enabled
      if (${this.config.features.keySparkle}) {
        setInterval(() => {
          document.body.style.filter = 'brightness(1.2)';
          setTimeout(() => {
            document.body.style.filter = 'brightness(1)';
          }, 200);
        }, 2000);
      }
    `;
    
    await window.webContents.executeJavaScript(enhancementScript);
    
    // Store enhancement state
    await this.stateManager.set(`plugins.${this.name}.keys.${keyId}`, {
      enhanced: true,
      timestamp: Date.now(),
      features: ['sparkle']
    });
    
    this.logger.debug('Key enhanced', { keyId });
  }
  
  async addDoorGlow(doorId) {
    const window = await this.gameWindowService.getWindow(doorId);
    if (!window) return;
    
    const glowScript = `
      document.body.style.boxShadow = '0 0 25px rgba(0, 255, 0, 0.6)';
      document.body.style.transition = 'box-shadow 0.5s ease-in-out';
    `;
    
    await window.webContents.executeJavaScript(glowScript);
  }
  
  async addKeySparkle(keyId) {
    const window = await this.gameWindowService.getWindow(keyId);
    if (!window) return;
    
    const sparkleScript = `
      document.body.classList.add('used');
      setTimeout(() => {
        document.body.classList.remove('used');
      }, 1000);
    `;
    
    await window.webContents.executeJavaScript(sparkleScript);
  }
  
  async playSuccessAnimation(doorId) {
    const window = await this.gameWindowService.getWindow(doorId);
    if (!window) return;
    
    const animationScript = `
      const celebration = document.createElement('div');
      celebration.innerHTML = '🎉';
      celebration.style.position = 'absolute';
      celebration.style.top = '50%';
      celebration.style.left = '50%';
      celebration.style.transform = 'translate(-50%, -50%)';
      celebration.style.fontSize = '48px';
      celebration.style.animation = 'bounce 1s ease-in-out';
      celebration.style.zIndex = '1000';
      
      document.body.appendChild(celebration);
      
      setTimeout(() => {
        document.body.removeChild(celebration);
      }, 1000);
    `;
    
    await window.webContents.executeJavaScript(animationScript);
  }
  
  async applyWindowEnhancements(window, type) {
    const enhancementScript = `
      document.body.classList.add('enhanced-window');
      document.querySelector('.content, body').classList.add('enhanced-content');
    `;
    
    await window.webContents.executeJavaScript(enhancementScript);
  }
  
  async handleDoorStateChange(doorId, newState, oldState) {
    if (newState === 'unlocked' && oldState === 'locked') {
      await this.addDoorGlow(doorId);
      
      if (this.config.features.successAnimation) {
        await this.playSuccessAnimation(doorId);
      }
    }
  }
  
  // Statistics and tracking
  async trackLevelStats(levelId) {
    const stats = await this.stateManager.get(`plugins.${this.name}.stats.levels`, {});
    stats[levelId] = {
      loaded: Date.now(),
      enhancements: Object.keys(this.config.features).filter(
        feature => this.config.features[feature]
      )
    };
    
    await this.stateManager.set(`plugins.${this.name}.stats.levels`, stats);
  }
  
  async trackDoorOpeningStats(doorId) {
    const stats = await this.stateManager.get(`plugins.${this.name}.stats.doorOpenings`, {});
    
    if (!stats[doorId]) {
      stats[doorId] = { count: 0, timestamps: [] };
    }
    
    stats[doorId].count++;
    stats[doorId].timestamps.push(Date.now());
    
    // Keep only last 10 timestamps
    if (stats[doorId].timestamps.length > 10) {
      stats[doorId].timestamps = stats[doorId].timestamps.slice(-10);
    }
    
    await this.stateManager.set(`plugins.${this.name}.stats.doorOpenings`, stats);
  }
  
  // Plugin API methods
  async getEnhancementStats() {
    return {
      enhancedWindows: this.enhancedWindows.size,
      customFeatures: this.customFeatures.size,
      levelStats: await this.stateManager.get(`plugins.${this.name}.stats.levels`, {}),
      doorStats: await this.stateManager.get(`plugins.${this.name}.stats.doorOpenings`, {})
    };
  }
  
  async updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await this.stateManager.set(`plugins.${this.name}.config`, this.config);
    
    this.logger.info('Plugin configuration updated', { config: this.config });
    
    // Reapply enhancements with new configuration
    await this.applyEnhancementsToExistingElements();
  }
  
  async deactivate() {
    // Remove enhancements from all windows
    for (const windowId of this.enhancedWindows) {
      await this.removeEnhancements(windowId);
    }
    
    this.enhancedWindows.clear();
    this.customFeatures.clear();
    
    this.logger.info('Game enhancement plugin deactivated');
  }
  
  async removeEnhancements(windowId) {
    const window = await this.gameWindowService.getWindow(windowId);
    if (!window) return;
    
    const removalScript = `
      document.body.classList.remove('enhanced-door', 'enhanced-key', 'enhanced-window');
      document.body.style.boxShadow = '';
      document.body.style.transform = '';
      document.body.style.filter = '';
      
      // Remove injected styles
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent.includes('enhanced-')) {
          style.remove();
        }
      });
    `;
    
    await window.webContents.executeJavaScript(removalScript);
  }
  
  async cleanup() {
    // Clean up plugin state
    await this.stateManager.delete(`plugins.${this.name}`);
    
    this.logger.info('Game enhancement plugin cleaned up');
  }
}
```

### Analytics Plugin

```javascript
// plugins/analytics/index.js
import { Plugin } from '../../src/foundation/plugins/Plugin.js';

export class AnalyticsPlugin extends Plugin {
  constructor() {
    super('analytics', '1.0.0', {
      description: 'Collects and analyzes game usage statistics',
      author: 'Analytics Team',
      dependencies: [
        'logger',
        'stateManager',
        'eventBus',
        'actionCallbacks',
        'resourceManager'
      ]
    });
    
    this.sessionId = this.generateSessionId();
    this.events = [];
    this.metrics = new Map();
  }
  
  async initialize(container, hookSystem) {
    this.logger = container.resolve('logger')('AnalyticsPlugin');
    this.stateManager = container.resolve('stateManager');
    this.eventBus = container.resolve('eventBus');
    this.actionCallbacks = container.resolve('actionCallbacks');
    this.resourceManager = container.resolve('resourceManager');
    
    // Load configuration
    await this.loadConfiguration();
    
    // Register for all action callbacks to track performance
    this.actionCallbacks.register('*', this.trackAction.bind(this), {
      priority: -1000, // Very low priority to not interfere
      source: 'analytics-plugin'
    });
    
    // Subscribe to all events
    this.eventBus.on('*', this.trackEvent.bind(this));
    
    // Start session
    await this.startSession();
    
    this.logger.info('Analytics plugin initialized', { sessionId: this.sessionId });
  }
  
  async loadConfiguration() {
    this.config = await this.stateManager.get(`plugins.${this.name}.config`, {
      enabled: true,
      trackActions: true,
      trackEvents: true,
      trackPerformance: true,
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      anonymize: true,
      exportPath: 'analytics/data'
    });
  }
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async startSession() {
    const sessionData = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      userAgent: process.platform,
      version: process.env.npm_package_version || '1.0.0'
    };
    
    await this.stateManager.set(`plugins.${this.name}.currentSession`, sessionData);
    
    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushData();
    }, this.config.flushInterval);
    
    this.trackEvent({
      type: 'session.started',
      data: sessionData
    });
  }
  
  async trackAction(context) {
    if (!this.config.enabled || !this.config.trackActions) return;
    
    const actionData = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      action: context.action,
      source: context.source,
      phase: context.phase,
      success: context.success,
      duration: context.duration,
      error: context.error ? context.error.message : null
    };
    
    // Anonymize sensitive data if configured
    if (this.config.anonymize) {
      actionData.data = this.anonymizeData(context.data);
    } else {
      actionData.data = context.data;
    }
    
    this.events.push(actionData);
    
    // Track performance metrics
    if (this.config.trackPerformance && context.duration) {
      this.updatePerformanceMetrics(context.action, context.duration);
    }
    
    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      await this.flushData();
    }
  }
  
  async trackEvent(event) {
    if (!this.config.enabled || !this.config.trackEvents) return;
    
    const eventData = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      type: event.type,
      source: event.source || 'unknown',
      data: this.config.anonymize ? this.anonymizeData(event.data) : event.data
    };
    
    this.events.push(eventData);
    
    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      await this.flushData();
    }
  }
  
  anonymizeData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const anonymized = { ...data };
    
    // Remove or hash sensitive fields
    const sensitiveFields = ['id', 'path', 'filename', 'windowId', 'doorId', 'keyId'];
    
    for (const field of sensitiveFields) {
      if (anonymized[field]) {
        anonymized[field] = this.hashValue(anonymized[field]);
      }
    }
    
    return anonymized;
  }
  
  hashValue(value) {
    // Simple hash function for anonymization
    let hash = 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }
  
  updatePerformanceMetrics(action, duration) {
    if (!this.metrics.has(action)) {
      this.metrics.set(action, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0
      });
    }
    
    const metric = this.metrics.get(action);
    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.avgDuration = metric.totalDuration / metric.count;
    
    this.metrics.set(action, metric);
  }
  
  async flushData() {
    if (this.events.length === 0) return;
    
    const batchData = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      events: [...this.events],
      metrics: Object.fromEntries(this.metrics)
    };
    
    try {
      // Save to file
      const filename = `analytics_${this.sessionId}_${Date.now()}.json`;
      const filepath = `${this.config.exportPath}/${filename}`;
      
      await this.resourceManager.write(filepath, JSON.stringify(batchData, null, 2));
      
      // Clear events buffer
      this.events = [];
      
      this.logger.debug('Analytics data flushed', { 
        eventCount: batchData.events.length,
        filepath 
      });
    } catch (error) {
      this.logger.error('Failed to flush analytics data', { error: error.message });
    }
  }
  
  async generateReport() {
    const sessionData = await this.stateManager.get(`plugins.${this.name}.currentSession`);
    const currentTime = Date.now();
    const sessionDuration = currentTime - sessionData.startTime;
    
    const report = {
      session: {
        id: this.sessionId,
        duration: sessionDuration,
        startTime: sessionData.startTime,
        endTime: currentTime
      },
      events: {
        total: this.events.length,
        types: this.getEventTypeCounts()
      },
      performance: {
        metrics: Object.fromEntries(this.metrics),
        slowestActions: this.getSlowestActions(),
        fastestActions: this.getFastestActions()
      },
      summary: {
        totalActions: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.count, 0),
        averageActionDuration: this.getOverallAverageActionDuration(),
        errorRate: this.getErrorRate()
      }
    };
    
    return report;
  }
  
  getEventTypeCounts() {
    const counts = {};
    for (const event of this.events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }
  
  getSlowestActions() {
    return Array.from(this.metrics.entries())
      .sort(([,a], [,b]) => b.avgDuration - a.avgDuration)
      .slice(0, 5)
      .map(([action, metrics]) => ({ action, avgDuration: metrics.avgDuration }));
  }
  
  getFastestActions() {
    return Array.from(this.metrics.entries())
      .sort(([,a], [,b]) => a.avgDuration - b.avgDuration)
      .slice(0, 5)
      .map(([action, metrics]) => ({ action, avgDuration: metrics.avgDuration }));
  }
  
  getOverallAverageActionDuration() {
    const totalDuration = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.totalDuration, 0);
    const totalCount = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.count, 0);
    
    return totalCount > 0 ? totalDuration / totalCount : 0;
  }
  
  getErrorRate() {
    const errorEvents = this.events.filter(e => e.error || e.success === false);
    return this.events.length > 0 ? errorEvents.length / this.events.length : 0;
  }
  
  async exportReport() {
    const report = await this.generateReport();
    const filename = `analytics_report_${this.sessionId}.json`;
    const filepath = `${this.config.exportPath}/reports/${filename}`;
    
    await this.resourceManager.write(filepath, JSON.stringify(report, null, 2));
    
    this.logger.info('Analytics report exported', { filepath });
    
    return filepath;
  }
  
  async deactivate() {
    // Flush remaining data
    await this.flushData();
    
    // Stop flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.logger.info('Analytics plugin deactivated');
  }
  
  async cleanup() {
    // Export final report
    await this.exportReport();
    
    // End session
    const sessionData = await this.stateManager.get(`plugins.${this.name}.currentSession`);
    sessionData.endTime = Date.now();
    sessionData.duration = sessionData.endTime - sessionData.startTime;
    
    await this.stateManager.set(`plugins.${this.name}.sessions.${this.sessionId}`, sessionData);
    await this.stateManager.delete(`plugins.${this.name}.currentSession`);
    
    this.logger.info('Analytics plugin cleaned up');
  }
}
```

## Plugin Configuration and Management

### Plugin Manager Configuration

```javascript
// src/foundation/plugins/PluginManager.js configuration example
export class PluginManager {
  constructor(config = {}) {
    this.config = {
      pluginPaths: ['plugins'],
      autoLoad: true,
      hotReload: false,
      sandboxing: true,
      maxPlugins: 50,
      timeout: 30000, // 30 seconds for plugin operations
      ...config
    };
    
    this.plugins = new Map();
    this.hooks = new Map();
    this.container = null;
  }
  
  async loadPlugin(pluginName) {
    const context = {
      action: 'load-plugin',
      source: 'PluginManager',
      data: { pluginName }
    };
    
    await this.actionCallbacks.execute('before', context);
    
    try {
      // Find plugin directory
      const pluginPath = await this.findPluginPath(pluginName);
      if (!pluginPath) {
        throw new Error(`Plugin '${pluginName}' not found`);
      }
      
      // Load plugin metadata
      const metadata = await this.loadPluginMetadata(pluginPath);
      
      // Validate plugin
      await this.validatePlugin(metadata);
      
      // Load plugin class
      const PluginClass = await this.loadPluginClass(pluginPath, metadata);
      
      // Create plugin instance
      const plugin = new PluginClass();
      
      // Initialize plugin
      await plugin.initialize(this.container, this.hookSystem);
      
      // Activate plugin
      await plugin.activate();
      
      // Store plugin
      this.plugins.set(pluginName, {
        instance: plugin,
        metadata,
        path: pluginPath,
        loaded: Date.now(),
        active: true
      });
      
      this.logger.info('Plugin loaded successfully', { pluginName });
      
      await this.actionCallbacks.execute('after', { ...context, success: true });
      
      return plugin;
    } catch (error) {
      this.logger.error('Failed to load plugin', { pluginName, error: error.message });
      await this.actionCallbacks.execute('error', { ...context, error });
      throw error;
    }
  }
}
```

### Plugin Development Environment Setup

```javascript
// plugins/development-tools/index.js
export class DevelopmentToolsPlugin extends Plugin {
  constructor() {
    super('development-tools', '1.0.0', {
      description: 'Development tools for plugin debugging and testing',
      author: 'Dev Team',
      dependencies: ['logger', 'stateManager', 'eventBus', 'actionCallbacks']
    });
  }
  
  async initialize(container, hookSystem) {
    this.logger = container.resolve('logger')('DevelopmentToolsPlugin');
    this.stateManager = container.resolve('stateManager');
    this.eventBus = container.resolve('eventBus');
    this.actionCallbacks = container.resolve('actionCallbacks');
    
    // Only enable in development environment
    if (process.env.NODE_ENV !== 'development') {
      this.logger.info('Development tools disabled in production');
      return;
    }
    
    // Set up development features
    await this.setupDevelopmentFeatures();
    
    this.logger.info('Development tools plugin initialized');
  }
  
  async setupDevelopmentFeatures() {
    // Add global debugging functions
    global.debugPlugin = this.debugPlugin.bind(this);
    global.inspectState = this.inspectState.bind(this);
    global.triggerEvent = this.triggerEvent.bind(this);
    global.listHooks = this.listHooks.bind(this);
    
    // Set up hot reload if enabled
    if (process.env.ENABLE_HOT_RELOAD === 'true') {
      await this.setupHotReload();
    }
    
    // Add development action callbacks
    this.actionCallbacks.register('*', this.debugAction.bind(this), {
      priority: 1000, // High priority for debugging
      source: 'development-tools'
    });
  }
  
  async debugPlugin(pluginName) {
    const pluginManager = this.container.resolve('pluginManager');
    const plugin = pluginManager.getPlugin(pluginName);
    
    if (!plugin) {
      console.log(`Plugin '${pluginName}' not found`);
      return;
    }
    
    console.log('Plugin Debug Info:', {
      name: plugin.name,
      version: plugin.version,
      active: plugin.active,
      dependencies: plugin.dependencies,
      hooks: plugin.hooks,
      events: plugin.events
    });
  }
  
  async inspectState(path) {
    const state = await this.stateManager.get(path);
    console.log(`State at '${path}':`, state);
    return state;
  }
  
  async triggerEvent(eventType, data) {
    await this.eventBus.emit(eventType, data);
    console.log(`Event '${eventType}' triggered with data:`, data);
  }
  
  async listHooks() {
    const hookSystem = this.container.resolve('hookSystem');
    const hooks = hookSystem.getAllHooks();
    console.log('Registered hooks:', hooks);
    return hooks;
  }
  
  async debugAction(context) {
    if (context.phase === 'error') {
      console.error('Action Error:', {
        action: context.action,
        source: context.source,
        error: context.error.message,
        stack: context.error.stack
      });
    }
  }
  
  async setupHotReload() {
    const chokidar = await import('chokidar');
    
    const watcher = chokidar.watch('plugins/**/*.js', {
      ignored: /node_modules/,
      persistent: true
    });
    
    watcher.on('change', async (path) => {
      this.logger.info('Plugin file changed, reloading', { path });
      
      // Extract plugin name from path
      const pluginName = path.split('/')[1];
      
      try {
        const pluginManager = this.container.resolve('pluginManager');
        await pluginManager.reloadPlugin(pluginName);
        
        console.log(`Plugin '${pluginName}' hot reloaded successfully`);
      } catch (error) {
        console.error(`Failed to hot reload plugin '${pluginName}':`, error.message);
      }
    });
    
    this.watcher = watcher;
    this.logger.info('Hot reload enabled for plugins');
  }
  
  async cleanup() {
    // Clean up global debugging functions
    delete global.debugPlugin;
    delete global.inspectState;
    delete global.triggerEvent;
    delete global.listHooks;
    
    // Stop file watcher
    if (this.watcher) {
      await this.watcher.close();
    }
    
    this.logger.info('Development tools plugin cleaned up');
  }
}
```

## Plugin Testing

### Unit Testing Plugins

```javascript
// test/plugins/gameEnhancement.test.js
import { GameEnhancementPlugin } from '../../plugins/game-enhancement/index.js';
import { MockFactory } from '../../src/foundation/testing/MockFactory.js';
import { TestContainer } from '../../src/foundation/testing/TestContainer.js';

describe('GameEnhancementPlugin', () => {
  let plugin;
  let mockContainer;
  let mockHookSystem;
  let mockLogger;
  let mockStateManager;
  let mockEventBus;
  let mockActionCallbacks;
  
  beforeEach(() => {
    // Create mocks
    mockLogger = MockFactory.createLogger();
    mockStateManager = MockFactory.createStateManager();
    mockEventBus = MockFactory.createEventBus();
    mockActionCallbacks = MockFactory.createActionCallbacks();
    mockHookSystem = MockFactory.createHookSystem();
    
    // Create test container
    mockContainer = new TestContainer();
    mockContainer.registerInstance('logger', () => mockLogger);
    mockContainer.registerInstance('stateManager', mockStateManager);
    mockContainer.registerInstance('eventBus', mockEventBus);
    mockContainer.registerInstance('actionCallbacks', mockActionCallbacks);
    
    // Create plugin
    plugin = new GameEnhancementPlugin();
  });
  
  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      mockStateManager.get.mockResolvedValue({
        enableAnimations: true,
        enableCustomStyling: true
      });
      
      await plugin.initialize(mockContainer, mockHookSystem);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Game enhancement plugin initialized');
      expect(mockHookSystem.register).toHaveBeenCalledWith(
        'game.level.loaded',
        expect.any(Function)
      );
      expect(mockActionCallbacks.register).toHaveBeenCalledWith(
        'create-window',
        expect.any(Function),
        expect.objectContaining({
          priority: 50,
          source: 'game-enhancement-plugin'
        })
      );
    });
    
    it('should load configuration from state manager', async () => {
      const config = {
        enableAnimations: false,
        enableCustomStyling: true,
        features: {
          doorGlow: true,
          keySparkle: false
        }
      };
      
      mockStateManager.get.mockResolvedValue(config);
      
      await plugin.initialize(mockContainer, mockHookSystem);
      
      expect(mockStateManager.get).toHaveBeenCalledWith(
        `plugins.${plugin.name}.config`,
        expect.any(Object)
      );
      expect(plugin.config).toEqual(config);
    });
  });
  
  describe('hook handlers', () => {
    beforeEach(async () => {
      mockStateManager.get.mockResolvedValue({});
      await plugin.initialize(mockContainer, mockHookSystem);
    });
    
    it('should enhance level data on level loaded', async () => {
      const levelData = { id: 'level-1', name: 'Test Level' };
      
      const result = await plugin.onLevelLoaded(levelData);
      
      expect(result.enhancements).toBeDefined();
      expect(result.enhancements.plugin).toBe(plugin.name);
      expect(result.enhancements.version).toBe(plugin.version);
      expect(mockStateManager.set).toHaveBeenCalled();
    });
    
    it('should enhance window on window created', async () => {
      const windowData = { id: 'window-1', type: 'door' };
      
      // Mock the enhanceDoor method
      plugin.enhanceDoor = jest.fn().mockResolvedValue();
      
      const result = await plugin.onWindowCreated(windowData);
      
      expect(plugin.enhanceDoor).toHaveBeenCalledWith(windowData.id);
      expect(plugin.enhancedWindows.has(windowData.id)).toBe(true);
      expect(result).toBe(windowData);
    });
  });
  
  describe('event handlers', () => {
    beforeEach(async () => {
      mockStateManager.get.mockResolvedValue({
        features: { doorGlow: true, keySparkle: true }
      });
      await plugin.initialize(mockContainer, mockHookSystem);
    });
    
    it('should handle relationship established event', async () => {
      const event = {
        data: {
          doorId: 'door-1',
          keyId: 'key-1',
          relationship: { id: 'rel-1' }
        }
      };
      
      // Mock enhancement methods
      plugin.addDoorGlow = jest.fn().mockResolvedValue();
      plugin.addKeySparkle = jest.fn().mockResolvedValue();
      
      await plugin.onRelationshipEstablished(event);
      
      expect(plugin.addDoorGlow).toHaveBeenCalledWith('door-1');
      expect(plugin.addKeySparkle).toHaveBeenCalledWith('key-1');
      expect(mockStateManager.set).toHaveBeenCalledWith(
        `plugins.${plugin.name}.relationships.door-1.key-1`,
        expect.objectContaining({
          enhanced: true,
          features: {
            doorGlow: true,
            keySparkle: true
          }
        })
      );
    });
  });
  
  describe('cleanup', () => {
    it('should clean up plugin state', async () => {
      await plugin.cleanup();
      
      expect(mockStateManager.delete).toHaveBeenCalledWith(`plugins.${plugin.name}`);
      expect(mockLogger.info).toHaveBeenCalledWith('Game enhancement plugin cleaned up');
    });
  });
});
```

### Integration Testing

```javascript
// test/integration/pluginSystem.test.js
import { configureTestingContainer } from '../config/testing/containerConfig.js';
import { GameEnhancementPlugin } from '../../plugins/game-enhancement/index.js';

describe('Plugin System Integration', () => {
  let container;
  let pluginManager;
  let gameWindowService;
  let doorKeyService;
  
  beforeEach(() => {
    container = configureTestingContainer();
    pluginManager = container.resolve('pluginManager');
    gameWindowService = container.resolve('gameWindowService');
    doorKeyService = container.resolve('doorKeyService');
  });
  
  it('should load and integrate plugin with services', async () => {
    // Load plugin
    const plugin = new GameEnhancementPlugin();
    await pluginManager.loadPlugin(plugin);
    
    // Create a door window
    const doorWindow = await gameWindowService.createGameWindow('door', 'test-door');
    
    // Create door and key
    await doorKeyService.createDoor('test-door', {
      position: { x: 100, y: 100 },
      size: { width: 400, height: 600 }
    });
    
    await doorKeyService.createKey('test-key', {
      position: { x: 150, y: 200 },
      size: { width: 50, height: 50 }
    });
    
    // Establish relationship (should trigger plugin enhancements)
    const relationship = await doorKeyService.establishRelationship('test-door', 'test-key');
    
    // Verify plugin integration
    expect(plugin.enhancedWindows.has('test-door')).toBe(true);
    expect(relationship).toBeDefined();
    
    // Verify plugin state
    const pluginStats = await plugin.getEnhancementStats();
    expect(pluginStats.enhancedWindows).toBeGreaterThan(0);
  });
});
```

## Plugin Distribution and Packaging

### Plugin Package Structure

```
plugins/
├── my-plugin/
│   ├── index.js              # Main plugin file
│   ├── plugin.json           # Plugin metadata
│   ├── README.md             # Plugin documentation
│   ├── package.json          # NPM package info (optional)
│   ├── assets/               # Plugin assets
│   │   ├── styles.css
│   │   └── images/
│   ├── config/               # Plugin configuration
│   │   ├── default.json
│   │   └── schema.json
│   ├── lib/                  # Plugin utilities
│   │   ├── utils.js
│   │   └── helpers.js
│   └── test/                 # Plugin tests
│       ├── index.test.js
│       └── integration.test.js
```

### Plugin Packaging Script

```javascript
// scripts/packagePlugin.js
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

export async function packagePlugin(pluginName, outputDir = 'dist/plugins') {
  const pluginDir = path.join('plugins', pluginName);
  const outputPath = path.join(outputDir, `${pluginName}.zip`);
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  // Create archive
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.pipe(output);
  
  // Add plugin files
  archive.directory(pluginDir, pluginName);
  
  await archive.finalize();
  
  console.log(`Plugin '${pluginName}' packaged to ${outputPath}`);
  
  return outputPath;
}
```

## Best Practices and Guidelines

### Plugin Development Checklist

- [ ] **Plugin extends base Plugin class**
- [ ] **Proper dependency declaration**
- [ ] **Comprehensive error handling**
- [ ] **State management integration**
- [ ] **Event system integration**
- [ ] **Action callback integration**
- [ ] **Proper cleanup implementation**
- [ ] **Configuration support**
- [ ] **Logging integration**
- [ ] **Unit tests written**
- [ ] **Integration tests written**
- [ ] **Documentation complete**
- [ ] **Plugin metadata file**

### Performance Considerations

1. **Lazy Loading**: Load plugin resources only when needed
2. **Event Filtering**: Subscribe only to relevant events
3. **State Optimization**: Use efficient state storage patterns
4. **Memory Management**: Clean up resources properly
5. **Async Operations**: Use proper async/await patterns

### Security Guidelines

1. **Input Validation**: Validate all external inputs
2. **Permission Checking**: Respect plugin permissions
3. **Sandboxing**: Use sandboxed execution when available
4. **Resource Limits**: Implement resource usage limits
5. **Error Isolation**: Prevent plugin errors from affecting core system

### Plugin API Best Practices

1. **Consistent Interfaces**: Follow foundation layer patterns
2. **Backward Compatibility**: Maintain API compatibility
3. **Versioning**: Use semantic versioning
4. **Documentation**: Provide comprehensive API documentation
5. **Testing**: Include comprehensive test coverage

This guide provides the foundation for developing robust, maintainable, and extensible plugins that integrate seamlessly with the Fenestra foundational abstraction system.