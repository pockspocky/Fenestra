/**
 * Electron Window Adapter
 * 
 * Implements the WindowAdapter interface for Electron BrowserWindow.
 * Provides platform-specific window management using Electron APIs.
 */

import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { WindowAdapter, WindowWrapper } from '../../foundation/windows/WindowAdapter.js';

const { BrowserWindow, screen } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ElectronWindowAdapter extends WindowAdapter {
  constructor(options = {}) {
    super(options);
    this.windows = new Map(); // id -> ElectronWindowWrapper
    this.preloadPath = options.preloadPath || path.join(process.cwd(), 'preload.js');
    
    this.logger?.debug('[ElectronWindowAdapter] Initialized', {
      preloadPath: this.preloadPath,
      options
    });
  }

  /**
   * Create a new Electron window
   * @param {WindowConfig} config - Window configuration
   * @returns {Promise<ElectronWindowWrapper>} Electron window wrapper
   */
  async createWindow(config) {
    const context = {
      action: 'window-create',
      source: 'ElectronWindowAdapter',
      windowId: config.id,
      config: config.toObject()
    };

    try {
      // Execute before callbacks
      await this.actionCallbacks?.execute('before', context);

      this.logger?.debug('[ElectronWindowAdapter] Creating window', context);

      // Convert WindowConfig to Electron BrowserWindow options
      const electronOptions = this._convertConfigToElectronOptions(config);

      // Create the Electron BrowserWindow
      const browserWindow = new BrowserWindow(electronOptions);

      // Create wrapper
      const wrapper = new ElectronWindowWrapper(browserWindow, config.id, this);
      
      // Store the wrapper
      this.windows.set(config.id, wrapper);

      // Set up event handlers
      this._setupWindowEvents(wrapper, config);

      // Load content if specified
      if (config.content) {
        await wrapper.loadContent(config.content);
      } else if (config.template) {
        const templatePath = path.join(process.cwd(), 'renderer', config.template);
        await wrapper.loadContent(`file://${templatePath}`);
      }

      // Execute lifecycle callback
      if (config.lifecycle?.onCreated) {
        try {
          await config.lifecycle.onCreated(wrapper);
        } catch (error) {
          this.logger?.warn('[ElectronWindowAdapter] Lifecycle onCreated callback failed', {
            windowId: config.id,
            error: error.message
          });
        }
      }

      context.success = true;
      context.windowWrapper = wrapper;
      
      // Execute after callbacks
      await this.actionCallbacks?.execute('after', context);

      this.logger?.info('[ElectronWindowAdapter] Window created successfully', {
        windowId: config.id,
        bounds: await wrapper.getBounds()
      });

      return wrapper;

    } catch (error) {
      context.success = false;
      context.error = error;

      // Execute error callbacks
      await this.actionCallbacks?.execute('error', context);

      this.logger?.error('[ElectronWindowAdapter] Failed to create window', {
        windowId: config.id,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Destroy a window
   * @param {ElectronWindowWrapper} window - Window to destroy
   * @returns {Promise<void>}
   */
  async destroyWindow(window) {
    const context = {
      action: 'window-destroy',
      source: 'ElectronWindowAdapter',
      windowId: window.getId()
    };

    try {
      await this.actionCallbacks?.execute('before', context);

      this.logger?.debug('[ElectronWindowAdapter] Destroying window', context);

      // Remove from our tracking
      this.windows.delete(window.getId());

      // Destroy the native window
      if (!window.nativeWindow.isDestroyed()) {
        window.nativeWindow.destroy();
      }

      // Cleanup wrapper
      window._cleanup();

      context.success = true;
      await this.actionCallbacks?.execute('after', context);

      this.logger?.info('[ElectronWindowAdapter] Window destroyed', {
        windowId: window.getId()
      });

    } catch (error) {
      context.success = false;
      context.error = error;
      await this.actionCallbacks?.execute('error', context);

      this.logger?.error('[ElectronWindowAdapter] Failed to destroy window', {
        windowId: window.getId(),
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get all active windows
   * @returns {Promise<ElectronWindowWrapper[]>} Array of active windows
   */
  async getAllWindows() {
    const context = {
      action: 'window-get-all',
      source: 'ElectronWindowAdapter'
    };

    try {
      await this.actionCallbacks?.execute('before', context);

      // Filter out destroyed windows
      const activeWindows = [];
      for (const [id, wrapper] of this.windows) {
        if (!await wrapper.isDestroyed()) {
          activeWindows.push(wrapper);
        } else {
          // Clean up destroyed windows
          this.windows.delete(id);
        }
      }

      context.success = true;
      context.windowCount = activeWindows.length;
      await this.actionCallbacks?.execute('after', context);

      return activeWindows;

    } catch (error) {
      context.success = false;
      context.error = error;
      await this.actionCallbacks?.execute('error', context);
      throw error;
    }
  }

  /**
   * Get window by ID
   * @param {string} id - Window ID
   * @returns {Promise<ElectronWindowWrapper|null>} Window wrapper or null
   */
  async getWindow(id) {
    const wrapper = this.windows.get(id);
    
    if (wrapper && await wrapper.isDestroyed()) {
      // Clean up destroyed window
      this.windows.delete(id);
      return null;
    }
    
    return wrapper || null;
  }

  /**
   * Check if window exists
   * @param {string} id - Window ID
   * @returns {Promise<boolean>} Whether window exists
   */
  async windowExists(id) {
    const wrapper = await this.getWindow(id);
    return wrapper !== null;
  }

  /**
   * Get screen information
   * @returns {Promise<Object>} Screen information
   */
  async getScreenInfo() {
    const context = {
      action: 'screen-info-get',
      source: 'ElectronWindowAdapter'
    };

    try {
      await this.actionCallbacks?.execute('before', context);

      const primaryDisplay = screen.getPrimaryDisplay();
      const allDisplays = screen.getAllDisplays();

      const screenInfo = {
        primary: {
          bounds: primaryDisplay.bounds,
          workArea: primaryDisplay.workArea,
          scaleFactor: primaryDisplay.scaleFactor,
          size: primaryDisplay.size,
          workAreaSize: primaryDisplay.workAreaSize
        },
        displays: allDisplays.map(display => ({
          id: display.id,
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
          size: display.size,
          workAreaSize: display.workAreaSize,
          internal: display.internal
        }))
      };

      context.success = true;
      context.screenInfo = screenInfo;
      await this.actionCallbacks?.execute('after', context);

      return screenInfo;

    } catch (error) {
      context.success = false;
      context.error = error;
      await this.actionCallbacks?.execute('error', context);
      throw error;
    }
  }

  /**
   * Convert WindowConfig to Electron BrowserWindow options
   * @param {WindowConfig} config - Window configuration
   * @returns {Object} Electron BrowserWindow options
   * @private
   */
  _convertConfigToElectronOptions(config) {
    const options = {
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      resizable: config.resizable,
      minimizable: config.minimizable,
      maximizable: config.maximizable,
      closable: config.closable,
      alwaysOnTop: config.alwaysOnTop,
      skipTaskbar: config.skipTaskbar,
      show: config.show,
      frame: config.frame,
      transparent: config.transparent,
      opacity: config.opacity,
      title: config.title,
      webPreferences: {
        ...config.webPreferences,
        preload: this.preloadPath
      }
    };

    // Set position if specified
    if (config.x !== undefined) {
      options.x = config.x;
    }
    if (config.y !== undefined) {
      options.y = config.y;
    }

    return options;
  }

  /**
   * Set up event handlers for a window
   * @param {ElectronWindowWrapper} wrapper - Window wrapper
   * @param {WindowConfig} config - Window configuration
   * @private
   */
  _setupWindowEvents(wrapper, config) {
    const browserWindow = wrapper.nativeWindow;

    // Window lifecycle events
    browserWindow.on('ready-to-show', () => {
      wrapper._emitEvent('ready', { windowId: wrapper.getId() });
      
      if (config.lifecycle?.onReady) {
        config.lifecycle.onReady(wrapper).catch(error => {
          this.logger?.warn('[ElectronWindowAdapter] Lifecycle onReady callback failed', {
            windowId: wrapper.getId(),
            error: error.message
          });
        });
      }
    });

    browserWindow.on('closed', () => {
      wrapper._emitEvent('closed', { windowId: wrapper.getId() });
      
      // Clean up from our tracking
      this.windows.delete(wrapper.getId());
      
      if (config.lifecycle?.onClosed) {
        config.lifecycle.onClosed(wrapper).catch(error => {
          this.logger?.warn('[ElectronWindowAdapter] Lifecycle onClosed callback failed', {
            windowId: wrapper.getId(),
            error: error.message
          });
        });
      }
    });

    browserWindow.on('moved', () => {
      const bounds = browserWindow.getBounds();
      wrapper._emitEvent('moved', { 
        windowId: wrapper.getId(),
        x: bounds.x,
        y: bounds.y
      });
      
      if (config.lifecycle?.onMoved) {
        config.lifecycle.onMoved(wrapper, bounds).catch(error => {
          this.logger?.warn('[ElectronWindowAdapter] Lifecycle onMoved callback failed', {
            windowId: wrapper.getId(),
            error: error.message
          });
        });
      }
    });

    browserWindow.on('resized', () => {
      const bounds = browserWindow.getBounds();
      wrapper._emitEvent('resized', { 
        windowId: wrapper.getId(),
        width: bounds.width,
        height: bounds.height
      });
      
      if (config.lifecycle?.onResized) {
        config.lifecycle.onResized(wrapper, bounds).catch(error => {
          this.logger?.warn('[ElectronWindowAdapter] Lifecycle onResized callback failed', {
            windowId: wrapper.getId(),
            error: error.message
          });
        });
      }
    });

    // Error handling
    browserWindow.webContents.on('crashed', (event, killed) => {
      wrapper._emitEvent('crashed', { 
        windowId: wrapper.getId(),
        killed
      });
      
      this.logger?.error('[ElectronWindowAdapter] Window crashed', {
        windowId: wrapper.getId(),
        killed
      });
    });

    browserWindow.webContents.on('unresponsive', () => {
      wrapper._emitEvent('unresponsive', { windowId: wrapper.getId() });
      
      this.logger?.warn('[ElectronWindowAdapter] Window became unresponsive', {
        windowId: wrapper.getId()
      });
    });

    browserWindow.webContents.on('responsive', () => {
      wrapper._emitEvent('responsive', { windowId: wrapper.getId() });
      
      this.logger?.info('[ElectronWindowAdapter] Window became responsive', {
        windowId: wrapper.getId()
      });
    });
  }
}

/**
 * Electron Window Wrapper
 * 
 * Wraps Electron BrowserWindow with the foundation WindowWrapper interface.
 */
export class ElectronWindowWrapper extends WindowWrapper {
  constructor(browserWindow, id, adapter) {
    super(browserWindow, id, adapter);
  }

  /**
   * Get window bounds
   * @returns {Promise<Object>} Window bounds {x, y, width, height}
   */
  async getBounds() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    return this.nativeWindow.getBounds();
  }

  /**
   * Set window bounds
   * @param {Object} bounds - New bounds {x, y, width, height}
   * @returns {Promise<void>}
   */
  async setBounds(bounds) {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.setBounds(bounds);
  }

  /**
   * Show the window
   * @returns {Promise<void>}
   */
  async show() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.show();
  }

  /**
   * Hide the window
   * @returns {Promise<void>}
   */
  async hide() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.hide();
  }

  /**
   * Focus the window
   * @returns {Promise<void>}
   */
  async focus() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.focus();
  }

  /**
   * Minimize the window
   * @returns {Promise<void>}
   */
  async minimize() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.minimize();
  }

  /**
   * Maximize the window
   * @returns {Promise<void>}
   */
  async maximize() {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }
    
    this.nativeWindow.maximize();
  }

  /**
   * Check if window is destroyed
   * @returns {Promise<boolean>} Whether window is destroyed
   */
  async isDestroyed() {
    return this.nativeWindow.isDestroyed();
  }

  /**
   * Check if window is visible
   * @returns {Promise<boolean>} Whether window is visible
   */
  async isVisible() {
    if (this.nativeWindow.isDestroyed()) {
      return false;
    }
    
    return this.nativeWindow.isVisible();
  }

  /**
   * Load content in the window
   * @param {string} content - Content to load (URL, file path, or HTML)
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   */
  async loadContent(content, options = {}) {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }

    try {
      if (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('file://')) {
        // Load URL
        await this.nativeWindow.loadURL(content, options);
      } else if (content.includes('<html') || content.includes('<!DOCTYPE')) {
        // Load HTML content
        await this.nativeWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`, options);
      } else {
        // Assume file path
        await this.nativeWindow.loadFile(content, options);
      }
    } catch (error) {
      this.adapter.logger?.error('[ElectronWindowWrapper] Failed to load content', {
        windowId: this.id,
        content: content.substring(0, 100), // Truncate for logging
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get additional Electron-specific properties
   * @returns {Object} Electron-specific properties
   */
  getElectronProperties() {
    if (this.nativeWindow.isDestroyed()) {
      return {};
    }

    return {
      isMinimized: this.nativeWindow.isMinimized(),
      isMaximized: this.nativeWindow.isMaximized(),
      isFullScreen: this.nativeWindow.isFullScreen(),
      isFocused: this.nativeWindow.isFocused(),
      isAlwaysOnTop: this.nativeWindow.isAlwaysOnTop(),
      isResizable: this.nativeWindow.isResizable(),
      isMovable: this.nativeWindow.isMovable(),
      isMinimizable: this.nativeWindow.isMinimizable(),
      isMaximizable: this.nativeWindow.isMaximizable(),
      isClosable: this.nativeWindow.isClosable()
    };
  }

  /**
   * Send message to renderer process
   * @param {string} channel - IPC channel
   * @param {...any} args - Arguments to send
   */
  sendMessage(channel, ...args) {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }

    this.nativeWindow.webContents.send(channel, ...args);
  }

  /**
   * Execute JavaScript in renderer process
   * @param {string} code - JavaScript code to execute
   * @returns {Promise<any>} Execution result
   */
  async executeJavaScript(code) {
    if (this.nativeWindow.isDestroyed()) {
      throw new Error(`Window ${this.id} is destroyed`);
    }

    return this.nativeWindow.webContents.executeJavaScript(code);
  }
}