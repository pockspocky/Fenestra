/**
 * Resource Manager Implementation
 * 
 * Platform-agnostic resource management with caching, validation,
 * and change notifications. Integrates with action callback system.
 */

import { randomUUID } from 'crypto';

export class ResourceManager {
  constructor(options = {}) {
    this.adapter = options.adapter || null;
    this.cache = new Map(); // resource path -> cached data
    this.watchers = new Map(); // resource path -> Set of watchers
    this.actionCallbackSystem = options.actionCallbackSystem || null;
    this.cachePolicy = {
      maxSize: options.maxCacheSize || 100,
      ttl: options.cacheTtl || 5 * 60 * 1000, // 5 minutes default
      ...options.cachePolicy
    };
    this.validators = new Map(); // resource type -> validator function
  }

  /**
   * Load a resource
   * @param {string} path - Resource path
   * @param {Object} options - Load options
   * @returns {Promise<any>} Resource data
   */
  async load(path, options = {}) {
    // Check cache first
    if (!options.bypassCache && this._isCacheValid(path)) {
      const cached = this.cache.get(path);
      
      // Trigger action callback for cache hit
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-cache-hit', 'after', {
          source: 'ResourceManager',
          data: { path, options }
        });
      }
      
      return cached.data;
    }

    if (!this.adapter) {
      throw new Error('No resource adapter configured');
    }

    try {
      // Trigger before callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-load', 'before', {
          source: 'ResourceManager',
          data: { path, options }
        });
      }

      // Load from adapter
      const data = await this.adapter.load(path, options);
      
      // Validate if validator is registered
      await this._validateResource(path, data, options);
      
      // Cache the result
      this._cacheResource(path, data, options);
      
      // Trigger after callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-load', 'after', {
          source: 'ResourceManager',
          data: { path, data, options }
        });
      }

      return data;
    } catch (error) {
      // Trigger error callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-load', 'error', {
          source: 'ResourceManager',
          data: { path, options, error: error.message }
        });
      }
      
      throw new Error(`Failed to load resource '${path}': ${error.message}`);
    }
  }

  /**
   * Save a resource
   * @param {string} path - Resource path
   * @param {any} data - Resource data
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async save(path, data, options = {}) {
    if (!this.adapter) {
      throw new Error('No resource adapter configured');
    }

    try {
      // Validate before saving
      await this._validateResource(path, data, options);
      
      // Trigger before callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-save', 'before', {
          source: 'ResourceManager',
          data: { path, data, options }
        });
      }

      // Save using adapter
      await this.adapter.save(path, data, options);
      
      // Update cache
      this._cacheResource(path, data, options);
      
      // Notify watchers
      await this._notifyWatchers(path, 'changed', { data, options });
      
      // Trigger after callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-save', 'after', {
          source: 'ResourceManager',
          data: { path, data, options }
        });
      }

    } catch (error) {
      // Trigger error callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-save', 'error', {
          source: 'ResourceManager',
          data: { path, data, options, error: error.message }
        });
      }
      
      throw new Error(`Failed to save resource '${path}': ${error.message}`);
    }
  }

  /**
   * Delete a resource
   * @param {string} path - Resource path
   * @param {Object} options - Delete options
   * @returns {Promise<void>}
   */
  async delete(path, options = {}) {
    if (!this.adapter) {
      throw new Error('No resource adapter configured');
    }

    try {
      // Trigger before callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-delete', 'before', {
          source: 'ResourceManager',
          data: { path, options }
        });
      }

      // Delete using adapter
      await this.adapter.delete(path, options);
      
      // Remove from cache
      this.cache.delete(path);
      
      // Notify watchers
      await this._notifyWatchers(path, 'deleted', { options });
      
      // Trigger after callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-delete', 'after', {
          source: 'ResourceManager',
          data: { path, options }
        });
      }

    } catch (error) {
      // Trigger error callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('resource-delete', 'error', {
          source: 'ResourceManager',
          data: { path, options, error: error.message }
        });
      }
      
      throw new Error(`Failed to delete resource '${path}': ${error.message}`);
    }
  }

  /**
   * Check if a resource exists
   * @param {string} path - Resource path
   * @param {Object} options - Check options
   * @returns {Promise<boolean>} Whether resource exists
   */
  async exists(path, options = {}) {
    // Check cache first
    if (this.cache.has(path) && this._isCacheValid(path)) {
      return true;
    }

    if (!this.adapter) {
      throw new Error('No resource adapter configured');
    }

    try {
      return await this.adapter.exists(path, options);
    } catch (error) {
      throw new Error(`Failed to check existence of resource '${path}': ${error.message}`);
    }
  }

  /**
   * List resources in a directory/collection
   * @param {string} path - Directory/collection path
   * @param {Object} options - List options
   * @returns {Promise<string[]>} Array of resource paths
   */
  async list(path, options = {}) {
    if (!this.adapter) {
      throw new Error('No resource adapter configured');
    }

    try {
      return await this.adapter.list(path, options);
    } catch (error) {
      throw new Error(`Failed to list resources at '${path}': ${error.message}`);
    }
  }

  /**
   * Watch a resource for changes
   * @param {string} path - Resource path to watch
   * @param {Function} callback - Callback function for changes
   * @param {Object} options - Watch options
   * @returns {string} Watcher ID
   */
  watch(path, callback, options = {}) {
    const watcher = {
      id: randomUUID(),
      path,
      callback,
      options,
      metadata: options.metadata || {}
    };

    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }
    
    this.watchers.get(path).add(watcher);

    // Start adapter watching if this is the first watcher for this path
    if (this.watchers.get(path).size === 1 && this.adapter && this.adapter.watch) {
      this.adapter.watch(path, (event) => this._handleAdapterWatchEvent(path, event), options);
    }

    return watcher.id;
  }

  /**
   * Stop watching a resource
   * @param {string} watcherId - Watcher ID
   * @returns {boolean} Whether watcher was found and removed
   */
  unwatch(watcherId) {
    for (const [path, watchers] of this.watchers) {
      for (const watcher of watchers) {
        if (watcher.id === watcherId) {
          watchers.delete(watcher);
          
          // Stop adapter watching if no more watchers for this path
          if (watchers.size === 0) {
            this.watchers.delete(path);
            if (this.adapter && this.adapter.unwatch) {
              this.adapter.unwatch(path);
            }
          }
          
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Register a validator for a resource type
   * @param {string} resourceType - Resource type (e.g., 'json', 'image')
   * @param {Function} validator - Validator function
   */
  registerValidator(resourceType, validator) {
    this.validators.set(resourceType, validator);
  }

  /**
   * Invalidate cache for a resource
   * @param {string} path - Resource path
   */
  invalidateCache(path) {
    this.cache.delete(path);
  }

  /**
   * Clear entire cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    for (const [path, entry] of this.cache) {
      if (now - entry.timestamp <= this.cachePolicy.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
      
      // Estimate size (rough approximation)
      totalSize += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      totalSize,
      maxSize: this.cachePolicy.maxSize,
      ttl: this.cachePolicy.ttl
    };
  }

  /**
   * Get resource manager statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const watcherCounts = {};
    for (const [path, watchers] of this.watchers) {
      watcherCounts[path] = watchers.size;
    }

    return {
      hasAdapter: !!this.adapter,
      adapterType: this.adapter?.constructor?.name || 'unknown',
      cache: this.getCacheStats(),
      watchers: {
        totalPaths: this.watchers.size,
        totalWatchers: Array.from(this.watchers.values()).reduce((sum, watchers) => sum + watchers.size, 0),
        watcherCounts
      },
      validators: Array.from(this.validators.keys())
    };
  }

  /**
   * Set resource adapter
   * @param {Object} adapter - Resource adapter instance
   */
  setAdapter(adapter) {
    this.adapter = adapter;
  }

  /**
   * Set action callback system reference
   * @param {ActionCallbackSystem} actionCallbackSystem - Action callback system instance
   */
  setActionCallbackSystem(actionCallbackSystem) {
    this.actionCallbackSystem = actionCallbackSystem;
  }

  /**
   * Check if cached resource is still valid
   * @private
   */
  _isCacheValid(path) {
    const cached = this.cache.get(path);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) <= this.cachePolicy.ttl;
  }

  /**
   * Cache a resource
   * @private
   */
  _cacheResource(path, data, options) {
    // Don't cache if explicitly disabled
    if (options.noCache) return;
    
    // Evict expired entries if cache is full
    if (this.cache.size >= this.cachePolicy.maxSize) {
      this._evictExpiredEntries();
      
      // If still full, evict oldest entry
      if (this.cache.size >= this.cachePolicy.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(path, {
      data,
      timestamp: Date.now(),
      options
    });
  }

  /**
   * Evict expired cache entries
   * @private
   */
  _evictExpiredEntries() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [path, entry] of this.cache) {
      if (now - entry.timestamp > this.cachePolicy.ttl) {
        expiredKeys.push(path);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Validate resource data
   * @private
   */
  async _validateResource(path, data, options) {
    const resourceType = options.type || this._inferResourceType(path);
    const validator = this.validators.get(resourceType);
    
    if (validator) {
      try {
        const result = await validator(data, path, options);
        if (result && !result.isValid) {
          throw new Error(`Resource validation failed: ${result.errors?.join(', ') || 'Unknown validation error'}`);
        }
      } catch (error) {
        throw new Error(`Resource validation error: ${error.message}`);
      }
    }
  }

  /**
   * Infer resource type from path
   * @private
   */
  _inferResourceType(path) {
    const extension = path.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'json': 'json',
      'txt': 'text',
      'md': 'markdown',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image'
    };
    
    return typeMap[extension] || 'unknown';
  }

  /**
   * Handle watch events from adapter
   * @private
   */
  async _handleAdapterWatchEvent(path, event) {
    // Invalidate cache on change
    if (event.type === 'changed' || event.type === 'deleted') {
      this.invalidateCache(path);
    }
    
    // Notify watchers
    await this._notifyWatchers(path, event.type, event.data);
  }

  /**
   * Notify watchers of resource changes
   * @private
   */
  async _notifyWatchers(path, eventType, eventData) {
    const watchers = this.watchers.get(path);
    if (!watchers) return;

    const event = {
      type: eventType,
      path,
      timestamp: Date.now(),
      data: eventData
    };

    for (const watcher of watchers) {
      try {
        await watcher.callback(event);
      } catch (error) {
        console.error(`[ResourceManager] Watcher callback error for ${watcher.id}:`, error);
      }
    }
  }
}