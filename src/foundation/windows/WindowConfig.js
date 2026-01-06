/**
 * Window Configuration Class
 * 
 * Provides validation, defaults, and configuration management for window creation.
 * Ensures consistent window configuration across different platforms and use cases.
 */

export class WindowConfig {
  constructor(config = {}) {
    // Set defaults first
    this._setDefaults();
    
    // Apply provided configuration
    this._applyConfig(config);
    
    // Validate the final configuration
    this._validate();
  }

  /**
   * Set default configuration values
   * @private
   */
  _setDefaults() {
    this.id = null;
    this.title = 'Fenestra Window';
    this.width = 800;
    this.height = 600;
    this.x = undefined;
    this.y = undefined;
    this.minWidth = 100;
    this.minHeight = 100;
    this.maxWidth = undefined;
    this.maxHeight = undefined;
    this.resizable = true;
    this.minimizable = true;
    this.maximizable = true;
    this.closable = true;
    this.alwaysOnTop = false;
    this.skipTaskbar = false;
    this.show = true;
    this.frame = true;
    this.transparent = false;
    this.opacity = 1.0;
    this.type = 'normal'; // 'normal', 'door', 'key', 'terminal', 'lens', etc.
    this.template = 'index.html';
    this.content = null; // URL, file path, or HTML content
    this.webPreferences = {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    };
    this.autoPosition = false;
    this.positionStrategy = 'center'; // 'center', 'cascade', 'optimal', 'manual'
    this.preventOverlap = true;
    this.maxOverlapRatio = 0.4;
    this.metadata = {};
    this.lifecycle = {
      onCreated: null,
      onReady: null,
      onClosed: null,
      onMoved: null,
      onResized: null
    };
  }

  /**
   * Apply configuration from provided object
   * @private
   */
  _applyConfig(config) {
    // Direct property assignment for simple values
    const simpleProperties = [
      'id', 'title', 'width', 'height', 'x', 'y',
      'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
      'resizable', 'minimizable', 'maximizable', 'closable',
      'alwaysOnTop', 'skipTaskbar', 'show', 'frame',
      'transparent', 'opacity', 'type', 'template', 'content',
      'autoPosition', 'positionStrategy', 'preventOverlap', 'maxOverlapRatio'
    ];

    for (const prop of simpleProperties) {
      if (config[prop] !== undefined) {
        this[prop] = config[prop];
      }
    }

    // Merge complex objects
    if (config.webPreferences) {
      this.webPreferences = { ...this.webPreferences, ...config.webPreferences };
    }

    if (config.metadata) {
      this.metadata = { ...this.metadata, ...config.metadata };
    }

    if (config.lifecycle) {
      this.lifecycle = { ...this.lifecycle, ...config.lifecycle };
    }
  }

  /**
   * Validate the configuration
   * @private
   */
  _validate() {
    const errors = [];

    // Validate required fields
    if (!this.id || typeof this.id !== 'string') {
      errors.push('Window ID must be a non-empty string');
    }

    // Validate dimensions
    if (typeof this.width !== 'number' || this.width < 1) {
      errors.push('Width must be a positive number');
    }

    if (typeof this.height !== 'number' || this.height < 1) {
      errors.push('Height must be a positive number');
    }

    if (this.minWidth !== undefined && (typeof this.minWidth !== 'number' || this.minWidth < 1)) {
      errors.push('Minimum width must be a positive number');
    }

    if (this.minHeight !== undefined && (typeof this.minHeight !== 'number' || this.minHeight < 1)) {
      errors.push('Minimum height must be a positive number');
    }

    // Validate position if provided
    if (this.x !== undefined && typeof this.x !== 'number') {
      errors.push('X position must be a number');
    }

    if (this.y !== undefined && typeof this.y !== 'number') {
      errors.push('Y position must be a number');
    }

    // Validate opacity
    if (typeof this.opacity !== 'number' || this.opacity < 0 || this.opacity > 1) {
      errors.push('Opacity must be a number between 0 and 1');
    }

    // Validate overlap ratio
    if (typeof this.maxOverlapRatio !== 'number' || this.maxOverlapRatio < 0 || this.maxOverlapRatio > 1) {
      errors.push('Max overlap ratio must be a number between 0 and 1');
    }

    // Validate position strategy
    const validStrategies = ['center', 'cascade', 'optimal', 'manual'];
    if (!validStrategies.includes(this.positionStrategy)) {
      errors.push(`Position strategy must be one of: ${validStrategies.join(', ')}`);
    }

    // Validate window type
    const validTypes = ['normal', 'door', 'key', 'terminal', 'lens', 'email', 'picture', 'video', 'desktop'];
    if (!validTypes.includes(this.type)) {
      errors.push(`Window type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate template/content
    if (!this.template && !this.content) {
      errors.push('Either template or content must be specified');
    }

    if (errors.length > 0) {
      throw new ValidationError('Window configuration validation failed', {
        errors,
        config: this.toObject()
      });
    }
  }

  /**
   * Merge with another configuration
   * @param {WindowConfig|Object} otherConfig - Configuration to merge
   * @returns {WindowConfig} New configuration instance
   */
  merge(otherConfig) {
    const otherObj = otherConfig instanceof WindowConfig ? otherConfig.toObject() : otherConfig;
    const mergedConfig = { ...this.toObject(), ...otherObj };
    return new WindowConfig(mergedConfig);
  }

  /**
   * Clone the configuration
   * @returns {WindowConfig} Cloned configuration
   */
  clone() {
    return new WindowConfig(this.toObject());
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      title: this.title,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      minWidth: this.minWidth,
      minHeight: this.minHeight,
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
      resizable: this.resizable,
      minimizable: this.minimizable,
      maximizable: this.maximizable,
      closable: this.closable,
      alwaysOnTop: this.alwaysOnTop,
      skipTaskbar: this.skipTaskbar,
      show: this.show,
      frame: this.frame,
      transparent: this.transparent,
      opacity: this.opacity,
      type: this.type,
      template: this.template,
      content: this.content,
      webPreferences: { ...this.webPreferences },
      autoPosition: this.autoPosition,
      positionStrategy: this.positionStrategy,
      preventOverlap: this.preventOverlap,
      maxOverlapRatio: this.maxOverlapRatio,
      metadata: { ...this.metadata },
      lifecycle: { ...this.lifecycle }
    };
  }

  /**
   * Get configuration for specific window type
   * @param {string} type - Window type
   * @returns {Object} Type-specific configuration overrides
   * @static
   */
  static getTypeDefaults(type) {
    const typeDefaults = {
      door: {
        width: 220,
        height: 320,
        resizable: false,
        frame: true,
        template: 'door.html',
        type: 'door'
      },
      key: {
        width: 100,
        height: 100,
        resizable: false,
        frame: false,
        alwaysOnTop: true,
        template: 'pictureViewer.html',
        type: 'key'
      },
      terminal: {
        width: 800,
        height: 600,
        minWidth: 400,
        minHeight: 300,
        template: 'terminal.html',
        type: 'terminal'
      },
      lens: {
        width: 200,
        height: 200,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        template: 'lensViewer.html',
        type: 'lens'
      },
      email: {
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        template: 'email.html',
        type: 'email'
      },
      picture: {
        width: 400,
        height: 300,
        template: 'pictureViewer.html',
        type: 'picture'
      },
      video: {
        width: 640,
        height: 360,
        template: 'index.html',
        type: 'video'
      },
      desktop: {
        width: 1200,
        height: 800,
        template: 'index.html',
        type: 'desktop'
      }
    };

    return typeDefaults[type] || {};
  }

  /**
   * Create configuration for specific window type
   * @param {string} type - Window type
   * @param {Object} overrides - Configuration overrides
   * @returns {WindowConfig} Configured instance
   * @static
   */
  static forType(type, overrides = {}) {
    const typeDefaults = WindowConfig.getTypeDefaults(type);
    const config = { ...typeDefaults, ...overrides };
    return new WindowConfig(config);
  }

  /**
   * Validate configuration object without creating instance
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result {isValid, errors}
   * @static
   */
  static validate(config) {
    try {
      new WindowConfig(config);
      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: error.context?.errors || [error.message]
      };
    }
  }
}

/**
 * Validation Error for window configuration
 */
export class ValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}