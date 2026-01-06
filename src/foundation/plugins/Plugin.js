/**
 * Plugin Base Class
 * 
 * Provides the standard interface and lifecycle methods that all plugins
 * must implement. Handles plugin metadata, dependencies, and communication.
 */

export class Plugin {
  constructor(id, manifest = {}) {
    this.id = id;
    this.manifest = {
      name: manifest.name || id,
      version: manifest.version || '1.0.0',
      description: manifest.description || '',
      author: manifest.author || 'Unknown',
      dependencies: manifest.dependencies || [],
      permissions: manifest.permissions || [],
      hooks: manifest.hooks || [],
      api: manifest.api || {},
      ...manifest
    };
    
    this.state = 'uninitialized'; // 'uninitialized', 'initializing', 'active', 'error', 'destroyed'
    this.context = null;
    this.logger = null;
    this.hooks = new Map();
    this.api = {};
    this.messageHandlers = new Map();
    this.subscriptions = [];
    this.error = null;
  }

  /**
   * Get plugin ID
   * @returns {string} Plugin ID
   */
  getId() {
    return this.id;
  }

  /**
   * Get plugin manifest
   * @returns {Object} Plugin manifest
   */
  getManifest() {
    return { ...this.manifest };
  }

  /**
   * Get plugin state
   * @returns {string} Current plugin state
   */
  getState() {
    return this.state;
  }

  /**
   * Get plugin error (if any)
   * @returns {Error|null} Plugin error or null
   */
  getError() {
    return this.error;
  }

  /**
   * Initialize the plugin with context
   * @param {Object} context - Plugin context with services and utilities
   * @returns {Promise<void>}
   */
  async initialize(context) {
    if (this.state !== 'uninitialized') {
      throw new Error(`Plugin ${this.id} is already initialized`);
    }

    this.state = 'initializing';
    this.context = context;
    this.logger = context.logger || console;

    try {
      // Validate dependencies
      await this._validateDependencies(context);

      // Validate permissions
      await this._validatePermissions(context);

      // Call plugin-specific initialization
      await this.onInitialize(context);

      // Register hooks
      await this._registerHooks(context);

      // Expose API
      await this._exposeAPI(context);

      this.state = 'active';
      
      if (this.logger) {
        this.logger.info('Plugin initialized successfully', {
          operation: 'initializePlugin',
          pluginId: this.id,
          version: this.manifest.version,
          hooks: this.hooks.size,
          apiMethods: Object.keys(this.api).length
        });
      }
    } catch (error) {
      this.state = 'error';
      this.error = error;
      
      if (this.logger) {
        this.logger.error('Plugin initialization failed', {
          operation: 'initializePlugin',
          pluginId: this.id,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }
      
      throw error;
    }
  }

  /**
   * Destroy the plugin and clean up resources
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.state === 'destroyed') {
      return;
    }

    try {
      // Call plugin-specific cleanup
      await this.onDestroy();

      // Unregister hooks
      await this._unregisterHooks();

      // Clean up subscriptions
      this._cleanupSubscriptions();

      // Clear API
      this.api = {};

      this.state = 'destroyed';
      
      if (this.logger) {
        this.logger.info('Plugin destroyed successfully', {
          operation: 'destroyPlugin',
          pluginId: this.id
        });
      }
    } catch (error) {
      this.state = 'error';
      this.error = error;
      
      if (this.logger) {
        this.logger.error('Plugin destruction failed', {
          operation: 'destroyPlugin',
          pluginId: this.id,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }
      
      throw error;
    }
  }

  /**
   * Plugin-specific initialization logic (override in subclasses)
   * @param {Object} context - Plugin context
   * @returns {Promise<void>}
   * @protected
   */
  async onInitialize(context) {
    // Override in subclasses
  }

  /**
   * Plugin-specific cleanup logic (override in subclasses)
   * @returns {Promise<void>}
   * @protected
   */
  async onDestroy() {
    // Override in subclasses
  }

  /**
   * Register a hook handler
   * @param {string} hookName - Hook name
   * @param {Function} handler - Hook handler function
   * @param {Object} options - Hook options
   * @returns {string} Hook registration ID
   */
  registerHook(hookName, handler, options = {}) {
    if (!this.context || !this.context.hookSystem) {
      throw new Error('Plugin not initialized or hook system not available');
    }

    const registrationId = this.context.hookSystem.register(hookName, handler, {
      ...options,
      pluginId: this.id
    });

    this.hooks.set(registrationId, { hookName, handler, options });
    
    if (this.logger) {
      this.logger.debug('Hook registered', {
        operation: 'registerHook',
        pluginId: this.id,
        hookName,
        registrationId
      });
    }

    return registrationId;
  }

  /**
   * Unregister a hook handler
   * @param {string} registrationId - Hook registration ID
   * @returns {boolean} Whether hook was unregistered
   */
  unregisterHook(registrationId) {
    if (!this.context || !this.context.hookSystem) {
      return false;
    }

    const success = this.context.hookSystem.unregister(registrationId);
    
    if (success) {
      this.hooks.delete(registrationId);
      
      if (this.logger) {
        this.logger.debug('Hook unregistered', {
          operation: 'unregisterHook',
          pluginId: this.id,
          registrationId
        });
      }
    }

    return success;
  }

  /**
   * Execute a hook
   * @param {string} hookName - Hook name
   * @param {any} payload - Hook payload
   * @returns {Promise<any>} Hook result
   */
  async executeHook(hookName, payload) {
    if (!this.context || !this.context.hookSystem) {
      throw new Error('Plugin not initialized or hook system not available');
    }

    return this.context.hookSystem.execute(hookName, payload);
  }

  /**
   * Expose API methods
   * @param {Object} methods - API methods to expose
   */
  exposeAPI(methods) {
    this.api = { ...this.api, ...methods };
    
    if (this.logger) {
      this.logger.debug('API methods exposed', {
        operation: 'exposeAPI',
        pluginId: this.id,
        methods: Object.keys(methods)
      });
    }
  }

  /**
   * Get exposed API
   * @returns {Object} Exposed API methods
   */
  getAPI() {
    return { ...this.api };
  }

  /**
   * Send message to another plugin
   * @param {string} targetPluginId - Target plugin ID
   * @param {string} messageType - Message type
   * @param {any} payload - Message payload
   * @returns {Promise<any>} Message response
   */
  async sendMessage(targetPluginId, messageType, payload) {
    if (!this.context || !this.context.pluginManager) {
      throw new Error('Plugin not initialized or plugin manager not available');
    }

    return this.context.pluginManager.sendMessage(this.id, targetPluginId, messageType, payload);
  }

  /**
   * Broadcast message to all plugins
   * @param {string} messageType - Message type
   * @param {any} payload - Message payload
   * @param {string[]} excludePlugins - Plugin IDs to exclude
   * @returns {Promise<Object>} Broadcast results
   */
  async broadcastMessage(messageType, payload, excludePlugins = []) {
    if (!this.context || !this.context.pluginManager) {
      throw new Error('Plugin not initialized or plugin manager not available');
    }

    return this.context.pluginManager.broadcastMessage(this.id, messageType, payload, excludePlugins);
  }

  /**
   * Register message handler
   * @param {string} messageType - Message type to handle
   * @param {Function} handler - Message handler function
   */
  registerMessageHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    
    if (this.logger) {
      this.logger.debug('Message handler registered', {
        operation: 'registerMessageHandler',
        pluginId: this.id,
        messageType
      });
    }
  }

  /**
   * Handle incoming message
   * @param {string} messageType - Message type
   * @param {any} payload - Message payload
   * @param {string} senderPluginId - Sender plugin ID
   * @returns {Promise<any>} Message response
   * @internal
   */
  async handleMessage(messageType, payload, senderPluginId) {
    const handler = this.messageHandlers.get(messageType);
    
    if (!handler) {
      throw new Error(`No handler for message type '${messageType}' in plugin '${this.id}'`);
    }

    try {
      return await handler(payload, senderPluginId);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Message handler failed', {
          operation: 'handleMessage',
          pluginId: this.id,
          messageType,
          senderPluginId,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Subscribe to events
   * @param {string} eventPattern - Event pattern to subscribe to
   * @param {Function} handler - Event handler
   * @returns {string} Subscription ID
   */
  subscribe(eventPattern, handler) {
    if (!this.context || !this.context.eventBus) {
      throw new Error('Plugin not initialized or event bus not available');
    }

    const subscriptionId = this.context.eventBus.on(eventPattern, handler);
    this.subscriptions.push(subscriptionId);
    
    if (this.logger) {
      this.logger.debug('Event subscription created', {
        operation: 'subscribe',
        pluginId: this.id,
        eventPattern,
        subscriptionId
      });
    }

    return subscriptionId;
  }

  /**
   * Emit event
   * @param {string} eventName - Event name
   * @param {any} payload - Event payload
   */
  emit(eventName, payload) {
    if (!this.context || !this.context.eventBus) {
      throw new Error('Plugin not initialized or event bus not available');
    }

    this.context.eventBus.emit(eventName, {
      ...payload,
      source: this.id,
      plugin: true
    });
  }

  /**
   * Get plugin statistics
   * @returns {Object} Plugin statistics
   */
  getStats() {
    return {
      id: this.id,
      state: this.state,
      manifest: this.getManifest(),
      hooks: this.hooks.size,
      apiMethods: Object.keys(this.api).length,
      messageHandlers: this.messageHandlers.size,
      subscriptions: this.subscriptions.length,
      error: this.error ? this.error.message : null
    };
  }

  /**
   * Validate plugin dependencies
   * @private
   */
  async _validateDependencies(context) {
    for (const dependency of this.manifest.dependencies) {
      if (typeof dependency === 'string') {
        // Simple plugin dependency
        if (!context.pluginManager || !context.pluginManager.isLoaded(dependency)) {
          throw new Error(`Plugin dependency '${dependency}' is not loaded`);
        }
      } else if (typeof dependency === 'object') {
        // Complex dependency with version requirements
        const { plugin, version, optional } = dependency;
        
        if (!optional && (!context.pluginManager || !context.pluginManager.isLoaded(plugin))) {
          throw new Error(`Plugin dependency '${plugin}' is not loaded`);
        }
        
        if (version && context.pluginManager && context.pluginManager.isLoaded(plugin)) {
          const loadedPlugin = context.pluginManager.getPlugin(plugin);
          if (!this._isVersionCompatible(loadedPlugin.getManifest().version, version)) {
            throw new Error(`Plugin dependency '${plugin}' version mismatch. Required: ${version}, Found: ${loadedPlugin.getManifest().version}`);
          }
        }
      }
    }
  }

  /**
   * Validate plugin permissions
   * @private
   */
  async _validatePermissions(context) {
    if (!context.permissionManager) {
      return; // No permission system available
    }

    for (const permission of this.manifest.permissions) {
      if (!context.permissionManager.hasPermission(this.id, permission)) {
        throw new Error(`Plugin '${this.id}' does not have permission '${permission}'`);
      }
    }
  }

  /**
   * Register hooks from manifest
   * @private
   */
  async _registerHooks(context) {
    for (const hookConfig of this.manifest.hooks) {
      if (typeof hookConfig === 'string') {
        // Simple hook name - plugin must implement the handler
        const handlerName = `on${hookConfig.charAt(0).toUpperCase() + hookConfig.slice(1)}`;
        if (typeof this[handlerName] === 'function') {
          this.registerHook(hookConfig, this[handlerName].bind(this));
        }
      } else if (typeof hookConfig === 'object') {
        // Complex hook configuration
        const { name, handler, options } = hookConfig;
        if (typeof this[handler] === 'function') {
          this.registerHook(name, this[handler].bind(this), options);
        }
      }
    }
  }

  /**
   * Expose API from manifest
   * @private
   */
  async _exposeAPI(context) {
    const apiMethods = {};
    
    for (const [methodName, methodConfig] of Object.entries(this.manifest.api)) {
      if (typeof methodConfig === 'string') {
        // Simple method name mapping
        if (typeof this[methodConfig] === 'function') {
          apiMethods[methodName] = this[methodConfig].bind(this);
        }
      } else if (typeof methodConfig === 'object') {
        // Complex method configuration
        const { method, permissions } = methodConfig;
        if (typeof this[method] === 'function') {
          apiMethods[methodName] = this._wrapAPIMethod(this[method].bind(this), permissions);
        }
      }
    }
    
    this.exposeAPI(apiMethods);
  }

  /**
   * Wrap API method with permission checking
   * @private
   */
  _wrapAPIMethod(method, permissions = []) {
    return async (...args) => {
      // Check permissions if permission manager is available
      if (this.context.permissionManager && permissions.length > 0) {
        for (const permission of permissions) {
          if (!this.context.permissionManager.hasPermission(this.id, permission)) {
            throw new Error(`Insufficient permissions for API method. Required: ${permission}`);
          }
        }
      }
      
      return method(...args);
    };
  }

  /**
   * Unregister all hooks
   * @private
   */
  async _unregisterHooks() {
    for (const registrationId of this.hooks.keys()) {
      this.unregisterHook(registrationId);
    }
  }

  /**
   * Clean up event subscriptions
   * @private
   */
  _cleanupSubscriptions() {
    if (this.context && this.context.eventBus) {
      for (const subscriptionId of this.subscriptions) {
        try {
          this.context.eventBus.off(subscriptionId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    this.subscriptions = [];
  }

  /**
   * Check version compatibility
   * @private
   */
  _isVersionCompatible(actualVersion, requiredVersion) {
    // Simple version comparison - can be enhanced with semver
    return actualVersion >= requiredVersion;
  }
}