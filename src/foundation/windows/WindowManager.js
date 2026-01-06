/**
 * Platform-Agnostic Window Manager
 * 
 * Provides centralized window lifecycle management through platform adapters.
 * Integrates with logging, action callbacks, events, and state management
 * to provide comprehensive window management capabilities.
 */

import { WindowConfig } from './WindowConfig.js';
import { LayoutEngine } from './LayoutEngine.js';

export class WindowManager {
  constructor(platformAdapter, options = {}) {
    this.platformAdapter = platformAdapter;
    this.windows = new Map(); // id -> WindowWrapper
    this.eventBus = options.eventBus;
    this.stateManager = options.stateManager;
    this.actionCallbacks = options.actionCallbacks;
    this.logger = options.logger;
    this.layoutEngine = new LayoutEngine({ logger: this.logger });
    
    // Configuration
    this.config = {
      autoPosition: options.autoPosition !== false,
      defaultPositionStrategy: options.defaultPositionStrategy || 'smart',
      preventOverlap: options.preventOverlap !== false,
      maxOverlapRatio: options.maxOverlapRatio || 0.4,
      ...options.config
    };

    // Initialize screen info
    this._initializeScreenInfo();
  }

  /**
   * Create a new window
   * @param {WindowConfig|Object} config - Window configuration
   * @returns {Promise<WindowWrapper>} Created window wrapper
   */
  async createWindow(config) {
    const startTime = Date.now();
    
    // Ensure we have a WindowConfig instance
    const windowConfig = config instanceof WindowConfig ? config : new WindowConfig(config);
    
    if (this.logger) {
      this.logger.info('Creating window', {
        operation: 'createWindow',
        windowId: windowConfig.id,
        type: windowConfig.type,
        dimensions: {
          width: windowConfig.width,
          height: windowConfig.height
        }
      });
    }

    // Execute before callbacks
    if (this.actionCallbacks) {
      await this.actionCallbacks.trigger('window:create', 'before', {
        source: 'WindowManager',
        data: { config: windowConfig.toObject() }
      });
    }

    try {
      // Check if window already exists
      if (this.windows.has(windowConfig.id)) {
        throw new Error(`Window with ID '${windowConfig.id}' already exists`);
      }

      // Apply positioning if needed
      await this._applyPositioning(windowConfig);

      // Create window through platform adapter
      const windowWrapper = await this.platformAdapter.createWindow(windowConfig);
      
      // Store window reference
      this.windows.set(windowConfig.id, windowWrapper);

      // Set up window event handlers
      this._setupWindowEventHandlers(windowWrapper, windowConfig);

      // Update state if state manager is available
      if (this.stateManager) {
        await this.stateManager.set(`windows.${windowConfig.id}`, {
          id: windowConfig.id,
          type: windowConfig.type,
          created: Date.now(),
          bounds: await windowWrapper.getBounds()
        });
      }

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.info('Window created successfully', {
          operation: 'createWindow',
          windowId: windowConfig.id,
          duration: `${duration}ms`,
          totalWindows: this.windows.size,
          bounds: await windowWrapper.getBounds()
        });
      }

      // Execute after callbacks
      if (this.actionCallbacks) {
        await this.actionCallbacks.trigger('window:create', 'after', {
          source: 'WindowManager',
          data: {
            config: windowConfig.toObject(),
            window: {
              id: windowWrapper.getId(),
              bounds: await windowWrapper.getBounds()
            },
            duration
          }
        });
      }

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('window:created', {
          windowId: windowConfig.id,
          window: windowWrapper,
          config: windowConfig
        });
      }

      // Execute lifecycle callback
      if (windowConfig.lifecycle.onCreated) {
        try {
          await windowConfig.lifecycle.onCreated(windowWrapper);
        } catch (error) {
          if (this.logger) {
            this.logger.warn('Window lifecycle callback failed', {
              operation: 'createWindow',
              windowId: windowConfig.id,
              callback: 'onCreated',
              error: error.message
            });
          }
        }
      }

      return windowWrapper;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.logger) {
        this.logger.error('Window creation failed', {
          operation: 'createWindow',
          windowId: windowConfig.id,
          duration: `${duration}ms`,
          error: {
            message: error.message,
            stack: error.stack
          },
          config: windowConfig.toObject()
        });
      }

      // Execute error callbacks
      if (this.actionCallbacks) {
        await this.actionCallbacks.trigger('window:create', 'error', {
          source: 'WindowManager',
          data: {
            config: windowConfig.toObject(),
            error: error.message,
            duration
          }
        });
      }

      throw error;
    }
  }

  /**
   * Destroy a window
   * @param {string} windowId - Window ID to destroy
   * @returns {Promise<boolean>} Whether window was destroyed
   */
  async destroyWindow(windowId) {
    const startTime = Date.now();
    
    if (this.logger) {
      this.logger.info('Destroying window', {
        operation: 'destroyWindow',
        windowId
      });
    }

    // Execute before callbacks
    if (this.actionCallbacks) {
      await this.actionCallbacks.trigger('window:destroy', 'before', {
        source: 'WindowManager',
        data: { windowId }
      });
    }

    try {
      const windowWrapper = this.windows.get(windowId);
      if (!windowWrapper) {
        if (this.logger) {
          this.logger.warn('Window not found for destruction', {
            operation: 'destroyWindow',
            windowId
          });
        }
        return false;
      }

      // Destroy through platform adapter
      await this.platformAdapter.destroyWindow(windowWrapper);
      
      // Remove from our tracking
      this.windows.delete(windowId);

      // Update state if state manager is available
      if (this.stateManager) {
        await this.stateManager.set(`windows.${windowId}`, undefined);
      }

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.info('Window destroyed successfully', {
          operation: 'destroyWindow',
          windowId,
          duration: `${duration}ms`,
          remainingWindows: this.windows.size
        });
      }

      // Execute after callbacks
      if (this.actionCallbacks) {
        await this.actionCallbacks.trigger('window:destroy', 'after', {
          source: 'WindowManager',
          data: { windowId, duration }
        });
      }

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('window:destroyed', {
          windowId,
          window: windowWrapper
        });
      }

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.logger) {
        this.logger.error('Window destruction failed', {
          operation: 'destroyWindow',
          windowId,
          duration: `${duration}ms`,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }

      // Execute error callbacks
      if (this.actionCallbacks) {
        await this.actionCallbacks.trigger('window:destroy', 'error', {
          source: 'WindowManager',
          data: { windowId, error: error.message, duration }
        });
      }

      throw error;
    }
  }

  /**
   * Get a window by ID
   * @param {string} windowId - Window ID
   * @returns {WindowWrapper|null} Window wrapper or null if not found
   */
  getWindow(windowId) {
    return this.windows.get(windowId) || null;
  }

  /**
   * Get all windows
   * @returns {WindowWrapper[]} Array of all window wrappers
   */
  getAllWindows() {
    return Array.from(this.windows.values());
  }

  /**
   * Get windows by type
   * @param {string} type - Window type
   * @returns {WindowWrapper[]} Array of windows of the specified type
   */
  getWindowsByType(type) {
    return this.getAllWindows().filter(window => 
      window.getMetadata('type') === type
    );
  }

  /**
   * Check if a window exists
   * @param {string} windowId - Window ID
   * @returns {boolean} Whether window exists
   */
  hasWindow(windowId) {
    return this.windows.has(windowId);
  }

  /**
   * Get window count
   * @returns {number} Number of active windows
   */
  getWindowCount() {
    return this.windows.size;
  }

  /**
   * Arrange windows using a layout strategy
   * @param {string} strategy - Layout strategy name
   * @param {Object} options - Arrangement options
   * @returns {Promise<void>}
   */
  async arrangeWindows(strategy = 'cascade', options = {}) {
    if (this.logger) {
      this.logger.info('Arranging windows', {
        operation: 'arrangeWindows',
        strategy,
        windowCount: this.windows.size
      });
    }

    const windows = this.getAllWindows();
    const screenInfo = await this._getScreenInfo();

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const windowConfig = new WindowConfig({
        id: window.getId(),
        width: (await window.getBounds()).width,
        height: (await window.getBounds()).height
      });

      const position = await this.layoutEngine.applyStrategy(
        strategy,
        windowConfig,
        windows.slice(0, i), // Previous windows
        screenInfo
      );

      await window.setBounds({
        ...await window.getBounds(),
        x: position.x,
        y: position.y
      });
    }

    if (this.eventBus) {
      this.eventBus.emit('windows:arranged', {
        strategy,
        windowCount: windows.length
      });
    }
  }

  /**
   * Prevent window overlap by repositioning
   * @param {string} windowId - Window ID to check
   * @param {number} maxOverlapRatio - Maximum allowed overlap ratio
   * @returns {Promise<boolean>} Whether repositioning was needed
   */
  async preventOverlap(windowId, maxOverlapRatio = null) {
    const window = this.getWindow(windowId);
    if (!window) {
      return false;
    }

    const threshold = maxOverlapRatio ?? this.config.maxOverlapRatio;
    const bounds = await window.getBounds();
    const otherWindows = this.getAllWindows().filter(w => w.getId() !== windowId);

    const { hasExcessiveOverlap } = await this.layoutEngine.checkOverlap(
      bounds,
      otherWindows,
      threshold
    );

    if (hasExcessiveOverlap) {
      const windowConfig = new WindowConfig({
        id: windowId,
        width: bounds.width,
        height: bounds.height
      });

      const newPosition = await this.layoutEngine.calculateOptimalPosition(
        windowConfig,
        otherWindows
      );

      await window.setBounds({
        ...bounds,
        x: newPosition.x,
        y: newPosition.y
      });

      if (this.logger) {
        this.logger.info('Window repositioned to prevent overlap', {
          operation: 'preventOverlap',
          windowId,
          oldPosition: { x: bounds.x, y: bounds.y },
          newPosition
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Get window manager statistics
   * @returns {Object} Statistics about managed windows
   */
  getStats() {
    const windowsByType = {};
    for (const window of this.windows.values()) {
      const type = window.getMetadata('type') || 'unknown';
      windowsByType[type] = (windowsByType[type] || 0) + 1;
    }

    return {
      totalWindows: this.windows.size,
      windowsByType,
      layoutStrategies: this.layoutEngine.getAvailableStrategies(),
      config: { ...this.config }
    };
  }

  /**
   * Apply positioning to window configuration
   * @private
   */
  async _applyPositioning(windowConfig) {
    if (!this.config.autoPosition && windowConfig.x !== undefined && windowConfig.y !== undefined) {
      return; // Manual positioning
    }

    const strategy = windowConfig.positionStrategy || this.config.defaultPositionStrategy;
    const existingWindows = this.getAllWindows();
    const screenInfo = await this._getScreenInfo();

    const position = await this.layoutEngine.applyStrategy(
      strategy,
      windowConfig,
      existingWindows,
      screenInfo
    );

    windowConfig.x = position.x;
    windowConfig.y = position.y;

    // Check for overlap if prevention is enabled
    if (this.config.preventOverlap || windowConfig.preventOverlap) {
      const bounds = {
        x: position.x,
        y: position.y,
        width: windowConfig.width,
        height: windowConfig.height
      };

      const { hasExcessiveOverlap } = await this.layoutEngine.checkOverlap(
        bounds,
        existingWindows,
        windowConfig.maxOverlapRatio || this.config.maxOverlapRatio
      );

      if (hasExcessiveOverlap) {
        const optimalPosition = await this.layoutEngine.calculateOptimalPosition(
          windowConfig,
          existingWindows
        );
        
        windowConfig.x = optimalPosition.x;
        windowConfig.y = optimalPosition.y;
      }
    }
  }

  /**
   * Set up event handlers for a window
   * @private
   */
  _setupWindowEventHandlers(windowWrapper, windowConfig) {
    // Set window metadata
    windowWrapper.setMetadata('type', windowConfig.type);
    windowWrapper.setMetadata('created', Date.now());
    windowWrapper.setMetadata('config', windowConfig.toObject());

    // Set up event forwarding to event bus and action callbacks
    const events = ['moved', 'resized', 'closed', 'ready', 'focused', 'blurred'];
    
    for (const event of events) {
      windowWrapper.addEventListener(event, async (data) => {
        // Emit to event bus
        if (this.eventBus) {
          this.eventBus.emit(`window:${event}`, {
            windowId: windowWrapper.getId(),
            window: windowWrapper,
            data
          });
        }

        // Trigger action callbacks
        if (this.actionCallbacks) {
          await this.actionCallbacks.trigger(`window:${event}`, 'after', {
            source: 'WindowManager',
            data: {
              windowId: windowWrapper.getId(),
              eventData: data
            }
          });
        }

        // Execute lifecycle callbacks
        const lifecycleCallback = windowConfig.lifecycle[`on${event.charAt(0).toUpperCase() + event.slice(1)}`];
        if (lifecycleCallback) {
          try {
            await lifecycleCallback(windowWrapper, data);
          } catch (error) {
            if (this.logger) {
              this.logger.warn('Window lifecycle callback failed', {
                windowId: windowWrapper.getId(),
                event,
                error: error.message
              });
            }
          }
        }
      });
    }
  }

  /**
   * Initialize screen information
   * @private
   */
  async _initializeScreenInfo() {
    try {
      const screenInfo = await this.platformAdapter.getScreenInfo();
      this.layoutEngine.updateScreenInfo(screenInfo);
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to get screen info, using defaults', {
          error: error.message
        });
      }
    }
  }

  /**
   * Get current screen information
   * @private
   */
  async _getScreenInfo() {
    try {
      return await this.platformAdapter.getScreenInfo();
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to get screen info, using defaults', {
          error: error.message
        });
      }
      
      return {
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        scaleFactor: 1.0
      };
    }
  }
}