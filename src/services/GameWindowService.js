/**
 * Game Window Service
 * 
 * Game-specific window management service that composes foundation layer
 * components to provide high-level window operations for the Fenestra game.
 * Maintains all current window management functionality while using the
 * new abstraction layer.
 */

import { WindowConfig } from '../foundation/windows/WindowConfig.js';

export class GameWindowService {
  constructor(dependencies = {}) {
    this.windowManager = dependencies.windowManager;
    this.stateManager = dependencies.stateManager;
    this.resourceManager = dependencies.resourceManager;
    this.actionCallbacks = dependencies.actionCallbacks;
    this.logger = dependencies.logger || console;
    
    // Game-specific window tracking
    this.gameWindows = new Map(); // id -> game window metadata
    this.windowTypes = new Set(['door', 'key', 'terminal', 'email', 'lens', 'picture', 'content', 'startMenu']);
    
    // Window positioning state
    this.lastPosition = { x: 100, y: 100 };
    this.windowOffset = { x: 30, y: 30 };
    
    this._initializeService();
  }

  /**
   * Initialize the service and register callbacks
   * @private
   */
  _initializeService() {
    if (this.actionCallbacks) {
      // Register action callbacks for window operations
      this.actionCallbacks.register('window.create', this._onWindowCreate.bind(this));
      this.actionCallbacks.register('window.destroy', this._onWindowDestroy.bind(this));
    }

    this.logger.info('GameWindowService initialized', {
      service: 'GameWindowService',
      supportedTypes: Array.from(this.windowTypes)
    });
  }

  /**
   * Create a door window with game-specific configuration
   * @param {string} doorId - Unique door identifier
   * @param {string} title - Door window title
   * @param {boolean} show - Whether to show window immediately
   * @param {Object} options - Additional door options
   * @returns {Promise<Object>} Created window wrapper
   */
  async createDoor(doorId, title = 'Door', show = true, options = {}) {
    const config = new WindowConfig({
      id: doorId,
      type: 'door',
      title,
      width: options.width || 400,
      height: options.height || 300,
      show,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this._getPreloadPath()
      },
      ...options
    });

    // Set door-specific HTML file
    config.htmlFile = 'renderer/door.html';
    
    // Calculate position if not specified
    if (!config.x || !config.y) {
      const position = this._calculateNextPosition(config.width, config.height);
      config.x = position.x;
      config.y = position.y;
    }

    const window = await this.windowManager.createWindow(config);
    
    // Store game-specific metadata
    this.gameWindows.set(doorId, {
      type: 'door',
      title,
      initialState: options.initialState || 'closed',
      isLocked: options.isLocked || false,
      isEncrypted: options.isEncrypted || false,
      createdAt: Date.now(),
      ...options
    });

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`windows.doors.${doorId}`, {
        id: doorId,
        type: 'door',
        state: options.initialState || 'closed',
        isLocked: options.isLocked || false,
        createdAt: Date.now()
      });
    }

    this.logger.info('Door window created', {
      doorId,
      title,
      position: { x: config.x, y: config.y },
      options
    });

    return window;
  }

  /**
   * Create a key window with game-specific configuration
   * @param {string} keyId - Unique key identifier
   * @param {string} title - Key window title
   * @param {boolean} show - Whether to show window immediately
   * @param {Object} options - Additional key options
   * @returns {Promise<Object>} Created window wrapper
   */
  async createKey(keyId, title = 'Key', show = true, options = {}) {
    const config = new WindowConfig({
      id: keyId,
      type: 'key',
      title,
      width: options.width || 300,
      height: options.height || 200,
      show,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this._getPreloadPath()
      },
      ...options
    });

    // Set key-specific HTML file
    config.htmlFile = 'renderer/door.html'; // Keys use same template as doors
    
    // Calculate position if not specified
    if (!config.x || !config.y) {
      const position = this._calculateNextPosition(config.width, config.height);
      config.x = position.x;
      config.y = position.y;
    }

    const window = await this.windowManager.createWindow(config);
    
    // Store game-specific metadata
    this.gameWindows.set(keyId, {
      type: 'key',
      title,
      isOneTime: options.isOneTime || false,
      closeAfterUse: options.closeAfterUse || false,
      createdAt: Date.now(),
      ...options
    });

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`windows.keys.${keyId}`, {
        id: keyId,
        type: 'key',
        isOneTime: options.isOneTime || false,
        createdAt: Date.now()
      });
    }

    this.logger.info('Key window created', {
      keyId,
      title,
      position: { x: config.x, y: config.y },
      options
    });

    return window;
  }

  /**
   * Create a terminal window
   * @param {string} terminalId - Unique terminal identifier
   * @param {Object} options - Terminal options
   * @returns {Promise<Object>} Created window wrapper
   */
  async createTerminal(terminalId, options = {}) {
    const config = new WindowConfig({
      id: terminalId,
      type: 'terminal',
      title: options.title || 'Terminal',
      width: options.width || 800,
      height: options.height || 600,
      show: options.show !== false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this._getPreloadPath()
      },
      ...options
    });

    config.htmlFile = 'renderer/terminal.html';
    
    if (!config.x || !config.y) {
      const position = this._calculateNextPosition(config.width, config.height);
      config.x = position.x;
      config.y = position.y;
    }

    const window = await this.windowManager.createWindow(config);
    
    this.gameWindows.set(terminalId, {
      type: 'terminal',
      createdAt: Date.now(),
      ...options
    });

    this.logger.info('Terminal window created', { terminalId, options });

    return window;
  }

  /**
   * Create an email window
   * @param {string} emailId - Unique email identifier
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Created window wrapper
   */
  async createEmail(emailId, options = {}) {
    const config = new WindowConfig({
      id: emailId,
      type: 'email',
      title: options.title || 'Email',
      width: options.width || 600,
      height: options.height || 400,
      show: options.show !== false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this._getPreloadPath()
      },
      ...options
    });

    config.htmlFile = 'renderer/email.html';
    
    if (!config.x || !config.y) {
      const position = this._calculateNextPosition(config.width, config.height);
      config.x = position.x;
      config.y = position.y;
    }

    const window = await this.windowManager.createWindow(config);
    
    this.gameWindows.set(emailId, {
      type: 'email',
      createdAt: Date.now(),
      ...options
    });

    this.logger.info('Email window created', { emailId, options });

    return window;
  }

  /**
   * Create a lens window
   * @param {string} lensId - Unique lens identifier
   * @param {Object} options - Lens options
   * @returns {Promise<Object>} Created window wrapper
   */
  async createLens(lensId, options = {}) {
    const config = new WindowConfig({
      id: lensId,
      type: 'lens',
      title: options.title || 'Lens',
      width: options.width || 200,
      height: options.height || 200,
      show: options.show !== false,
      frame: false, // Lens windows are typically frameless
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this._getPreloadPath()
      },
      ...options
    });

    config.htmlFile = 'renderer/lensViewer.html';
    
    if (!config.x || !config.y) {
      const position = this._calculateNextPosition(config.width, config.height);
      config.x = position.x;
      config.y = position.y;
    }

    const window = await this.windowManager.createWindow(config);
    
    this.gameWindows.set(lensId, {
      type: 'lens',
      createdAt: Date.now(),
      ...options
    });

    this.logger.info('Lens window created', { lensId, options });

    return window;
  }

  /**
   * Get window by ID
   * @param {string} windowId - Window identifier
   * @returns {Object|null} Window wrapper or null if not found
   */
  getWindow(windowId) {
    return this.windowManager.getWindow(windowId);
  }

  /**
   * Get all game windows
   * @returns {Map} Map of all windows
   */
  getAllWindows() {
    return this.windowManager.getAllWindows();
  }

  /**
   * Destroy a window
   * @param {string} windowId - Window identifier
   * @returns {Promise<boolean>} Success status
   */
  async destroyWindow(windowId) {
    const success = await this.windowManager.destroyWindow(windowId);
    
    if (success) {
      this.gameWindows.delete(windowId);
      
      // Update state manager
      if (this.stateManager) {
        const windowType = this._getWindowType(windowId);
        if (windowType) {
          await this.stateManager.set(`windows.${windowType}s.${windowId}`, null);
        }
      }
      
      this.logger.info('Game window destroyed', { windowId });
    }
    
    return success;
  }

  /**
   * Get game-specific window metadata
   * @param {string} windowId - Window identifier
   * @returns {Object|null} Game window metadata
   */
  getGameWindowMetadata(windowId) {
    return this.gameWindows.get(windowId) || null;
  }

  /**
   * Calculate next window position to avoid overlap
   * @param {number} width - Window width
   * @param {number} height - Window height
   * @returns {Object} Position coordinates
   * @private
   */
  _calculateNextPosition(width, height) {
    const position = {
      x: this.lastPosition.x + this.windowOffset.x,
      y: this.lastPosition.y + this.windowOffset.y
    };

    // Update last position for next window
    this.lastPosition = position;

    // Reset position if we're getting too far from origin
    if (position.x > 800 || position.y > 600) {
      this.lastPosition = { x: 100, y: 100 };
      return { x: 100, y: 100 };
    }

    return position;
  }

  /**
   * Get preload script path
   * @returns {string} Preload script path
   * @private
   */
  _getPreloadPath() {
    // This would be resolved by the resource manager in a real implementation
    return './preload.js';
  }

  /**
   * Get window type from window ID
   * @param {string} windowId - Window identifier
   * @returns {string|null} Window type
   * @private
   */
  _getWindowType(windowId) {
    const metadata = this.gameWindows.get(windowId);
    return metadata ? metadata.type : null;
  }

  /**
   * Action callback for window creation
   * @param {Object} context - Action context
   * @private
   */
  _onWindowCreate(context) {
    this.logger.debug('Window creation action callback', {
      action: context.action,
      windowId: context.data.windowId,
      phase: context.phase
    });
  }

  /**
   * Action callback for window destruction
   * @param {Object} context - Action context
   * @private
   */
  _onWindowDestroy(context) {
    this.logger.debug('Window destruction action callback', {
      action: context.action,
      windowId: context.data.windowId,
      phase: context.phase
    });
  }
}