/**
 * Memory Resource Adapter
 * 
 * Simple in-memory resource adapter for testing and development.
 * Stores resources in memory with optional change notifications.
 */

import { ResourceAdapter } from '../ResourceAdapter.js';
import { randomUUID } from 'crypto';

export class MemoryResourceAdapter extends ResourceAdapter {
  constructor(options = {}) {
    super();
    this.storage = new Map(); // path -> { data, metadata }
    this.watchers = new Map(); // path -> Set of callbacks
    this.simulateAsync = options.simulateAsync !== false; // Default to true
    this.delay = options.delay || 10; // Simulate async delay
    this.serializeData = options.serializeData !== false; // Default to true
  }

  /**
   * Load a resource
   * @param {string} path - Resource path
   * @param {Object} options - Load options
   * @returns {Promise<any>} Resource data
   */
  async load(path, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    const stored = this.storage.get(path);
    
    if (!stored) {
      throw new Error(`Resource not found: ${path}`);
    }

    // Simulate deserialization if enabled
    return this.serializeData 
      ? JSON.parse(JSON.stringify(stored.data))
      : stored.data;
  }

  /**
   * Save a resource
   * @param {string} path - Resource path
   * @param {any} data - Resource data
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async save(path, data, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    const existed = this.storage.has(path);
    
    // Simulate serialization if enabled
    const dataToStore = this.serializeData 
      ? JSON.parse(JSON.stringify(data))
      : data;

    this.storage.set(path, {
      data: dataToStore,
      metadata: {
        created: existed ? this.storage.get(path).metadata.created : Date.now(),
        modified: Date.now(),
        size: JSON.stringify(dataToStore).length,
        ...options.metadata
      }
    });

    // Notify watchers
    await this._notifyWatchers(path, existed ? 'changed' : 'created', { data });
  }

  /**
   * Delete a resource
   * @param {string} path - Resource path
   * @param {Object} options - Delete options
   * @returns {Promise<void>}
   */
  async delete(path, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    if (!this.storage.has(path)) {
      throw new Error(`Resource not found: ${path}`);
    }

    this.storage.delete(path);

    // Notify watchers
    await this._notifyWatchers(path, 'deleted', {});
  }

  /**
   * Check if a resource exists
   * @param {string} path - Resource path
   * @param {Object} options - Check options
   * @returns {Promise<boolean>} Whether resource exists
   */
  async exists(path, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    return this.storage.has(path);
  }

  /**
   * List resources in a directory/collection
   * @param {string} path - Directory/collection path
   * @param {Object} options - List options
   * @returns {Promise<string[]>} Array of resource paths
   */
  async list(path, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    const allPaths = Array.from(this.storage.keys());
    
    // Simple prefix matching for directory-like behavior
    if (path === '' || path === '/') {
      return allPaths;
    }
    
    const prefix = path.endsWith('/') ? path : path + '/';
    return allPaths.filter(p => p.startsWith(prefix));
  }

  /**
   * Watch a resource for changes
   * @param {string} path - Resource path to watch
   * @param {Function} callback - Callback function for changes
   * @param {Object} options - Watch options
   * @returns {void}
   */
  watch(path, callback, options = {}) {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }
    
    this.watchers.get(path).add(callback);
  }

  /**
   * Stop watching a resource
   * @param {string} path - Resource path to stop watching
   * @returns {void}
   */
  unwatch(path) {
    this.watchers.delete(path);
  }

  /**
   * Get resource metadata
   * @param {string} path - Resource path
   * @param {Object} options - Options
   * @returns {Promise<Object>} Resource metadata
   */
  async getMetadata(path, options = {}) {
    if (this.simulateAsync) {
      await this._delay();
    }

    const stored = this.storage.get(path);
    
    if (!stored) {
      throw new Error(`Resource not found: ${path}`);
    }

    return { ...stored.metadata };
  }

  /**
   * Get adapter statistics
   * @returns {Promise<Object>} Adapter statistics
   */
  async getStats() {
    if (this.simulateAsync) {
      await this._delay();
    }

    const paths = Array.from(this.storage.keys());
    const totalSize = paths.reduce((size, path) => {
      const stored = this.storage.get(path);
      return size + stored.metadata.size;
    }, 0);

    return {
      adapterType: 'MemoryResourceAdapter',
      supportsWatch: true,
      supportsMetadata: true,
      resourceCount: paths.length,
      totalSize,
      averageSize: paths.length > 0 ? Math.round(totalSize / paths.length) : 0,
      watchedPaths: Array.from(this.watchers.keys())
    };
  }

  /**
   * Clear all resources (useful for testing)
   * @returns {Promise<void>}
   */
  async clear() {
    if (this.simulateAsync) {
      await this._delay();
    }

    // Notify watchers of deletions
    for (const path of this.storage.keys()) {
      await this._notifyWatchers(path, 'deleted', {});
    }

    this.storage.clear();
    this.watchers.clear();
  }

  /**
   * Simulate async delay
   * @private
   */
  async _delay() {
    return new Promise(resolve => setTimeout(resolve, this.delay));
  }

  /**
   * Notify watchers of resource changes
   * @private
   */
  async _notifyWatchers(path, eventType, eventData) {
    const callbacks = this.watchers.get(path);
    if (!callbacks) return;

    const event = {
      type: eventType,
      path,
      timestamp: Date.now(),
      data: eventData
    };

    for (const callback of callbacks) {
      try {
        await callback(event);
      } catch (error) {
        console.error(`[MemoryResourceAdapter] Watcher callback error for ${path}:`, error);
      }
    }
  }
}