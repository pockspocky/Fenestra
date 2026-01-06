/**
 * Window Adapter Abstract Base Class
 * 
 * Defines the interface that platform-specific window adapters must implement.
 * This abstraction allows the foundation layer to work with different platforms
 * (Electron, Web, etc.) through a consistent interface.
 */

export class WindowAdapter {
  constructor(options = {}) {
    this.options = options;
    this.logger = options.logger;
    this.actionCallbacks = options.actionCallbacks;
  }

  /**
   * Create a new window with the given configuration
   * @param {WindowConfig} config - Window configuration
   * @returns {Promise<WindowWrapper>} Platform-specific window wrapper
   * @abstract
   */
  async createWindow(config) {
    throw new Error('WindowAdapter.createWindow() must be implemented by subclass');
  }

  /**
   * Destroy a window
   * @param {WindowWrapper} window - Window to destroy
   * @returns {Promise<void>}
   * @abstract
   */
  async destroyWindow(window) {
    throw new Error('WindowAdapter.destroyWindow() must be implemented by subclass');
  }

  /**
   * Get all active windows
   * @returns {Promise<WindowWrapper[]>} Array of active windows
   * @abstract
   */
  async getAllWindows() {
    throw new Error('WindowAdapter.getAllWindows() must be implemented by subclass');
  }

  /**
   * Get window by ID
   * @param {string} id - Window ID
   * @returns {Promise<WindowWrapper|null>} Window wrapper or null if not found
   * @abstract
   */
  async getWindow(id) {
    throw new Error('WindowAdapter.getWindow() must be implemented by subclass');
  }

  /**
   * Check if window exists
   * @param {string} id - Window ID
   * @returns {Promise<boolean>} Whether window exists
   * @abstract
   */
  async windowExists(id) {
    throw new Error('WindowAdapter.windowExists() must be implemented by subclass');
  }

  /**
   * Get screen dimensions and information
   * @returns {Promise<Object>} Screen information
   * @abstract
   */
  async getScreenInfo() {
    throw new Error('WindowAdapter.getScreenInfo() must be implemented by subclass');
  }
}

/**
 * Window Wrapper Abstract Base Class
 * 
 * Provides a consistent interface for window operations regardless of platform.
 * Platform-specific adapters should extend this class.
 */
export class WindowWrapper {
  constructor(nativeWindow, id, adapter) {
    this.nativeWindow = nativeWindow;
    this.id = id;
    this.adapter = adapter;
    this.metadata = {};
    this.eventListeners = new Map();
  }

  /**
   * Get window ID
   * @returns {string} Window ID
   */
  getId() {
    return this.id;
  }

  /**
   * Get native window object (platform-specific)
   * @returns {any} Native window object
   */
  getNativeWindow() {
    return this.nativeWindow;
  }

  /**
   * Get window bounds
   * @returns {Promise<Object>} Window bounds {x, y, width, height}
   * @abstract
   */
  async getBounds() {
    throw new Error('WindowWrapper.getBounds() must be implemented by subclass');
  }

  /**
   * Set window bounds
   * @param {Object} bounds - New bounds {x, y, width, height}
   * @returns {Promise<void>}
   * @abstract
   */
  async setBounds(bounds) {
    throw new Error('WindowWrapper.setBounds() must be implemented by subclass');
  }

  /**
   * Show the window
   * @returns {Promise<void>}
   * @abstract
   */
  async show() {
    throw new Error('WindowWrapper.show() must be implemented by subclass');
  }

  /**
   * Hide the window
   * @returns {Promise<void>}
   * @abstract
   */
  async hide() {
    throw new Error('WindowWrapper.hide() must be implemented by subclass');
  }

  /**
   * Focus the window
   * @returns {Promise<void>}
   * @abstract
   */
  async focus() {
    throw new Error('WindowWrapper.focus() must be implemented by subclass');
  }

  /**
   * Minimize the window
   * @returns {Promise<void>}
   * @abstract
   */
  async minimize() {
    throw new Error('WindowWrapper.minimize() must be implemented by subclass');
  }

  /**
   * Maximize the window
   * @returns {Promise<void>}
   * @abstract
   */
  async maximize() {
    throw new Error('WindowWrapper.maximize() must be implemented by subclass');
  }

  /**
   * Check if window is destroyed
   * @returns {Promise<boolean>} Whether window is destroyed
   * @abstract
   */
  async isDestroyed() {
    throw new Error('WindowWrapper.isDestroyed() must be implemented by subclass');
  }

  /**
   * Check if window is visible
   * @returns {Promise<boolean>} Whether window is visible
   * @abstract
   */
  async isVisible() {
    throw new Error('WindowWrapper.isVisible() must be implemented by subclass');
  }

  /**
   * Load content in the window
   * @param {string} content - Content to load (URL, file path, or HTML)
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   * @abstract
   */
  async loadContent(content, options = {}) {
    throw new Error('WindowWrapper.loadContent() must be implemented by subclass');
  }

  /**
   * Set window metadata
   * @param {string} key - Metadata key
   * @param {any} value - Metadata value
   */
  setMetadata(key, value) {
    this.metadata[key] = value;
  }

  /**
   * Get window metadata
   * @param {string} key - Metadata key
   * @returns {any} Metadata value
   */
  getMetadata(key) {
    return this.metadata[key];
  }

  /**
   * Get all metadata
   * @returns {Object} All metadata
   */
  getAllMetadata() {
    return { ...this.metadata };
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {string} Listener ID for removal
   */
  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Map());
    }
    
    const listenerId = `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.eventListeners.get(event).set(listenerId, listener);
    
    return listenerId;
  }

  /**
   * Remove event listener
   * @param {string} listenerId - Listener ID returned by addEventListener
   * @returns {boolean} Whether listener was removed
   */
  removeEventListener(listenerId) {
    for (const [event, listeners] of this.eventListeners) {
      if (listeners.has(listenerId)) {
        listeners.delete(listenerId);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @protected
   */
  _emitEvent(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners.values()) {
        try {
          listener(data);
        } catch (error) {
          console.error(`[WindowWrapper] Event listener error for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Cleanup resources when window is destroyed
   * @protected
   */
  _cleanup() {
    this.eventListeners.clear();
    this.metadata = {};
  }
}