/**
 * Memory Persistence Adapter
 * 
 * Simple in-memory persistence adapter for testing and development.
 * Stores state in memory with optional serialization simulation.
 */

export class MemoryPersistenceAdapter {
  constructor(options = {}) {
    this.storage = new Map();
    this.simulateAsync = options.simulateAsync !== false; // Default to true
    this.delay = options.delay || 10; // Simulate async delay
    this.serializeData = options.serializeData !== false; // Default to true
  }

  /**
   * Save state snapshot
   * @param {Object} snapshot - State snapshot to save
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async save(snapshot, options = {}) {
    const key = options.key || 'default';
    
    if (this.simulateAsync) {
      await this._delay();
    }

    // Simulate serialization if enabled
    const dataToStore = this.serializeData 
      ? JSON.parse(JSON.stringify(snapshot))
      : snapshot;

    this.storage.set(key, {
      data: dataToStore,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    });
  }

  /**
   * Load state snapshot
   * @param {Object} options - Load options
   * @returns {Promise<Object>} State snapshot
   */
  async load(options = {}) {
    const key = options.key || 'default';
    
    if (this.simulateAsync) {
      await this._delay();
    }

    const stored = this.storage.get(key);
    
    if (!stored) {
      if (options.throwOnMissing !== false) {
        throw new Error(`No state found for key: ${key}`);
      }
      return {};
    }

    // Simulate deserialization if enabled
    return this.serializeData 
      ? JSON.parse(JSON.stringify(stored.data))
      : stored.data;
  }

  /**
   * Check if state exists for key
   * @param {Object} options - Check options
   * @returns {Promise<boolean>} Whether state exists
   */
  async exists(options = {}) {
    const key = options.key || 'default';
    
    if (this.simulateAsync) {
      await this._delay();
    }

    return this.storage.has(key);
  }

  /**
   * Delete state for key
   * @param {Object} options - Delete options
   * @returns {Promise<boolean>} Whether state was deleted
   */
  async delete(options = {}) {
    const key = options.key || 'default';
    
    if (this.simulateAsync) {
      await this._delay();
    }

    return this.storage.delete(key);
  }

  /**
   * List all stored keys
   * @returns {Promise<string[]>} Array of keys
   */
  async listKeys() {
    if (this.simulateAsync) {
      await this._delay();
    }

    return Array.from(this.storage.keys());
  }

  /**
   * Get metadata for stored state
   * @param {Object} options - Options
   * @returns {Promise<Object>} Metadata
   */
  async getMetadata(options = {}) {
    const key = options.key || 'default';
    
    if (this.simulateAsync) {
      await this._delay();
    }

    const stored = this.storage.get(key);
    
    if (!stored) {
      throw new Error(`No state found for key: ${key}`);
    }

    return {
      timestamp: stored.timestamp,
      metadata: stored.metadata
    };
  }

  /**
   * Clear all stored state
   * @returns {Promise<void>}
   */
  async clear() {
    if (this.simulateAsync) {
      await this._delay();
    }

    this.storage.clear();
  }

  /**
   * Get adapter statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    if (this.simulateAsync) {
      await this._delay();
    }

    const keys = Array.from(this.storage.keys());
    const totalSize = keys.reduce((size, key) => {
      const stored = this.storage.get(key);
      return size + JSON.stringify(stored.data).length;
    }, 0);

    return {
      keyCount: keys.length,
      keys,
      totalSize,
      averageSize: keys.length > 0 ? Math.round(totalSize / keys.length) : 0
    };
  }

  /**
   * Simulate async delay
   * @private
   */
  async _delay() {
    return new Promise(resolve => setTimeout(resolve, this.delay));
  }
}