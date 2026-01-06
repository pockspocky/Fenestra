/**
 * Application Bootstrap System
 * 
 * Provides centralized application initialization with dependency injection,
 * configuration management, and service orchestration.
 * 
 * Requirements: 4.1, 4.3, 4.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import { Container } from '../di/Container.js';
import { LoggerFactory } from '../logging/LoggerFactory.js';
import { ActionCallbackSystem } from '../actions/ActionCallbackSystem.js';
import { ConfigurationManager } from '../config/ConfigurationManager.js';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor.js';
import { EventBus } from '../events/EventBus.js';
import { StateManager } from '../state/StateManager.js';
import { ResourceManager } from '../resources/ResourceManager.js';
import { WindowManager } from '../windows/WindowManager.js';
import { PluginManager } from '../plugins/PluginManager.js';

// Platform Adapters
import { ElectronResourceAdapter } from '../../platform/electron/ElectronResourceAdapter.js';
import { ElectronWindowAdapter } from '../../platform/electron/ElectronWindowAdapter.js';

// Service Layer
import { GameWindowService } from '../../services/GameWindowService.js';
import { DoorKeyService } from '../../services/DoorKeyService.js';
import { EmailService } from '../../services/EmailService.js';
import { LensService } from '../../services/LensService.js';
import { PuzzleService } from '../../services/PuzzleService.js';

// Configuration Schemas
import { ALL_SCHEMAS } from '../config/schemas.js';

export class ApplicationBootstrap {
  constructor(options = {}) {
    this.options = {
      configBaseDir: options.configBaseDir || process.cwd(),
      environment: options.environment || process.env.NODE_ENV || 'development',
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      enableConfigWatching: options.enableConfigWatching !== false,
      ...options
    };
    
    this.container = new Container();
    this.initialized = false;
    this.services = new Map();
    
    // Bootstrap logger (will be replaced with configured logger)
    this.logger = console;
  }

  /**
   * Initialize the application
   * @returns {Promise<Container>} Configured dependency injection container
   */
  async initialize() {
    if (this.initialized) {
      throw new Error('Application already initialized');
    }
    
    try {
      console.log('[ApplicationBootstrap] Starting application initialization...');
      
      // Phase 1: Configuration Management
      await this._initializeConfiguration();
      
      // Phase 2: Foundation Services
      await this._initializeFoundationServices();
      
      // Phase 3: Platform Adapters
      await this._initializePlatformAdapters();
      
      // Phase 4: Service Layer
      await this._initializeServiceLayer();
      
      // Phase 5: Performance Monitoring
      await this._initializePerformanceMonitoring();
      
      // Phase 6: Configuration Watching
      await this._startConfigurationWatching();
      
      this.initialized = true;
      
      this.logger.info('[ApplicationBootstrap] Application initialization completed successfully', {
        environment: this.options.environment,
        services: this.container.getServiceNames().length,
        performanceMonitoring: this.options.enablePerformanceMonitoring
      });
      
      return this.container;
    } catch (error) {
      console.error('[ApplicationBootstrap] Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get a service from the container
   * @param {string} serviceName - Service name
   * @returns {any} Service instance
   */
  getService(serviceName) {
    if (!this.initialized) {
      throw new Error('Application not initialized');
    }
    
    return this.container.resolve(serviceName);
  }

  /**
   * Get all registered service names
   * @returns {string[]} Service names
   */
  getServiceNames() {
    return this.container.getServiceNames();
  }

  /**
   * Get application statistics
   * @returns {Object} Application statistics
   */
  getStats() {
    const containerStats = this.container.getStats();
    const configManager = this.services.get('configManager');
    const performanceMonitor = this.services.get('performanceMonitor');
    
    return {
      initialized: this.initialized,
      environment: this.options.environment,
      container: containerStats,
      configuration: configManager?.getStats(),
      performance: performanceMonitor?.getOverallStats(),
      services: Array.from(this.services.keys())
    };
  }

  /**
   * Shutdown the application
   */
  async shutdown() {
    this.logger?.info('[ApplicationBootstrap] Starting application shutdown...');
    
    try {
      // Stop configuration watching
      const configManager = this.services.get('configManager');
      if (configManager) {
        configManager.stopWatching();
      }
      
      // Destroy performance monitor
      const performanceMonitor = this.services.get('performanceMonitor');
      if (performanceMonitor) {
        performanceMonitor.destroy();
      }
      
      // Clear container
      this.container.clear();
      this.services.clear();
      
      this.initialized = false;
      
      this.logger?.info('[ApplicationBootstrap] Application shutdown completed');
    } catch (error) {
      this.logger?.error('[ApplicationBootstrap] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Initialize configuration management
   * @private
   */
  async _initializeConfiguration() {
    console.log('[ApplicationBootstrap] Initializing configuration management...');
    
    // Create configuration manager
    const configManager = new ConfigurationManager({
      baseDir: this.options.configBaseDir,
      environment: this.options.environment,
      logger: this.logger // Bootstrap logger
    });
    
    // Register configuration schemas
    for (const [section, schema] of Object.entries(ALL_SCHEMAS)) {
      configManager.registerSchema(section, schema);
    }
    
    // Load configuration
    const config = await configManager.load();
    
    // Store services
    this.services.set('configManager', configManager);
    this.services.set('config', config);
    
    // Register in container
    this.container.registerFactory('configManager', () => configManager);
    this.container.registerFactory('config', () => config);
    
    console.log('[ApplicationBootstrap] Configuration management initialized');
  }

  /**
   * Initialize foundation services
   * @private
   */
  async _initializeFoundationServices() {
    console.log('[ApplicationBootstrap] Initializing foundation services...');
    
    const config = this.services.get('config');
    
    // Logger Factory
    this.container.registerSingleton('loggerFactory', LoggerFactory);
    const loggerFactory = this.container.resolve('loggerFactory');
    
    // Configure logger factory with config
    if (config.logging) {
      loggerFactory.configure(config.logging);
    }
    
    // Replace bootstrap logger
    this.logger = loggerFactory.getLogger('ApplicationBootstrap');
    
    // Action Callback System
    this.container.registerFactory('actionCallbackSystem', (loggerFactory) => {
      const logger = loggerFactory.getLogger('ActionCallbackSystem');
      return new ActionCallbackSystem({
        logger,
        ...config.actionCallbacks
      });
    }, { dependencies: ['loggerFactory'] });
    
    // Event Bus
    this.container.registerFactory('eventBus', (loggerFactory) => {
      const logger = loggerFactory.getLogger('EventBus');
      return new EventBus({ logger });
    }, { dependencies: ['loggerFactory'] });
    
    // State Manager
    this.container.registerFactory('stateManager', (loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('StateManager');
      return new StateManager({ logger, actionCallbacks: actionCallbackSystem });
    }, { dependencies: ['loggerFactory', 'actionCallbackSystem'] });
    
    this.logger.debug('[ApplicationBootstrap] Foundation services initialized');
  }

  /**
   * Initialize platform adapters
   * @private
   */
  async _initializePlatformAdapters() {
    this.logger.debug('[ApplicationBootstrap] Initializing platform adapters...');
    
    // Electron Resource Adapter
    this.container.registerFactory('resourceAdapter', (loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('ElectronResourceAdapter');
      return new ElectronResourceAdapter(loggerFactory, actionCallbackSystem);
    }, { dependencies: ['loggerFactory', 'actionCallbackSystem'] });
    
    // Electron Window Adapter
    this.container.registerFactory('windowAdapter', (loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('ElectronWindowAdapter');
      return new ElectronWindowAdapter({ 
        loggerFactory, 
        actionCallbacks: actionCallbackSystem 
      });
    }, { dependencies: ['loggerFactory', 'actionCallbackSystem'] });
    
    // Resource Manager
    this.container.registerFactory('resourceManager', (resourceAdapter, loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('ResourceManager');
      const config = this.services.get('config');
      return new ResourceManager(resourceAdapter, loggerFactory, actionCallbackSystem, {
        ...config.resourceManagement
      });
    }, { dependencies: ['resourceAdapter', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Window Manager
    this.container.registerFactory('windowManager', (windowAdapter, loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('WindowManager');
      const config = this.services.get('config');
      return new WindowManager(windowAdapter, loggerFactory, actionCallbackSystem, {
        ...config.windowManagement
      });
    }, { dependencies: ['windowAdapter', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Plugin Manager
    this.container.registerFactory('pluginManager', (loggerFactory, actionCallbackSystem) => {
      const logger = loggerFactory.getLogger('PluginManager');
      return new PluginManager({ logger, actionCallbacks: actionCallbackSystem });
    }, { dependencies: ['loggerFactory', 'actionCallbackSystem'] });
    
    this.logger.debug('[ApplicationBootstrap] Platform adapters initialized');
  }

  /**
   * Initialize service layer
   * @private
   */
  async _initializeServiceLayer() {
    this.logger.debug('[ApplicationBootstrap] Initializing service layer...');
    
    // Game Window Service
    this.container.registerFactory('gameWindowService', (windowManager, loggerFactory, actionCallbackSystem) => {
      return new GameWindowService(windowManager, loggerFactory, actionCallbackSystem);
    }, { dependencies: ['windowManager', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Door Key Service
    this.container.registerFactory('doorKeyService', (stateManager, loggerFactory, actionCallbackSystem) => {
      return new DoorKeyService(stateManager, loggerFactory, actionCallbackSystem);
    }, { dependencies: ['stateManager', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Email Service
    this.container.registerFactory('emailService', (resourceManager, stateManager, loggerFactory, actionCallbackSystem) => {
      return new EmailService(resourceManager, stateManager, loggerFactory, actionCallbackSystem);
    }, { dependencies: ['resourceManager', 'stateManager', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Lens Service
    this.container.registerFactory('lensService', (windowManager, stateManager, loggerFactory, actionCallbackSystem) => {
      return new LensService(windowManager, stateManager, loggerFactory, actionCallbackSystem);
    }, { dependencies: ['windowManager', 'stateManager', 'loggerFactory', 'actionCallbackSystem'] });
    
    // Puzzle Service (composes all other services)
    this.container.registerFactory('puzzleService', (gameWindowService, doorKeyService, emailService, lensService, loggerFactory, actionCallbackSystem) => {
      return new PuzzleService(gameWindowService, doorKeyService, emailService, lensService, loggerFactory, actionCallbackSystem);
    }, { dependencies: ['gameWindowService', 'doorKeyService', 'emailService', 'lensService', 'loggerFactory', 'actionCallbackSystem'] });
    
    this.logger.debug('[ApplicationBootstrap] Service layer initialized');
  }

  /**
   * Initialize performance monitoring
   * @private
   */
  async _initializePerformanceMonitoring() {
    if (!this.options.enablePerformanceMonitoring) {
      this.logger.debug('[ApplicationBootstrap] Performance monitoring disabled');
      return;
    }
    
    this.logger.debug('[ApplicationBootstrap] Initializing performance monitoring...');
    
    const config = this.services.get('config');
    const loggerFactory = this.container.resolve('loggerFactory');
    const actionCallbackSystem = this.container.resolve('actionCallbackSystem');
    
    const performanceMonitor = new PerformanceMonitor({
      logger: loggerFactory.getLogger('PerformanceMonitor'),
      actionCallbacks: actionCallbackSystem,
      ...config.performanceMonitoring
    });
    
    // Register performance monitoring callbacks
    actionCallbackSystem.register(null, (context) => {
      // Monitor all operations
      if (context.phase === 'before') {
        context.performanceId = performanceMonitor.startOperation(context.action, {
          source: context.source,
          data: context.data
        });
      } else if (context.phase === 'after' && context.performanceId) {
        performanceMonitor.endOperation(context.performanceId, {
          success: context.success,
          result: context.result
        });
      } else if (context.phase === 'error' && context.performanceId) {
        performanceMonitor.endOperation(context.performanceId, {
          success: false,
          error: context.error
        });
      }
    }, { priority: -1000 }); // Low priority to run after other callbacks
    
    this.services.set('performanceMonitor', performanceMonitor);
    this.container.registerFactory('performanceMonitor', () => performanceMonitor);
    
    this.logger.debug('[ApplicationBootstrap] Performance monitoring initialized');
  }

  /**
   * Start configuration watching
   * @private
   */
  async _startConfigurationWatching() {
    if (!this.options.enableConfigWatching) {
      this.logger.debug('[ApplicationBootstrap] Configuration watching disabled');
      return;
    }
    
    const configManager = this.services.get('configManager');
    
    // Listen for configuration changes
    configManager.on('reloaded', (newConfig) => {
      this.logger.info('[ApplicationBootstrap] Configuration reloaded', {
        configKeys: Object.keys(newConfig).length
      });
      
      // Update config service
      this.services.set('config', newConfig);
      
      // Reconfigure services that support runtime updates
      this._handleConfigurationUpdate(newConfig);
    });
    
    configManager.on('error', (error) => {
      this.logger.error('[ApplicationBootstrap] Configuration reload error', {
        error: error.message
      });
    });
    
    // Start watching
    configManager.startWatching();
    
    this.logger.debug('[ApplicationBootstrap] Configuration watching started');
  }

  /**
   * Handle configuration updates
   * @private
   */
  _handleConfigurationUpdate(newConfig) {
    try {
      // Update logger factory configuration
      const loggerFactory = this.container.resolve('loggerFactory');
      if (newConfig.logging) {
        loggerFactory.configure(newConfig.logging);
        this.logger.debug('[ApplicationBootstrap] Logger configuration updated');
      }
      
      // Update performance monitor thresholds
      if (this.services.has('performanceMonitor') && newConfig.performanceMonitoring) {
        const performanceMonitor = this.services.get('performanceMonitor');
        performanceMonitor.updateThresholds(newConfig.performanceMonitoring.thresholds);
        performanceMonitor.setEnabled(newConfig.performanceMonitoring.enabled);
        this.logger.debug('[ApplicationBootstrap] Performance monitor configuration updated');
      }
      
    } catch (error) {
      this.logger.error('[ApplicationBootstrap] Error updating service configurations', {
        error: error.message
      });
    }
  }
}