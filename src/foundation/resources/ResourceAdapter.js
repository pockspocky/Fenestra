/**
 * Resource Adapter Abstract Base Class
 * 
 * Defines the interface that all resource adapters must implement.
 * Provides platform-agnostic resource operations.
 */

export class ResourceAdapter {
  /**
   * Load a resource
   * @param {string} path - Resource path
   * @param {Object} options - Load options
   * @returns {Promise<any>} Resource data
   */
  async load(path, options = {}) {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Save a resource
   * @param {string} path - Resource path
   * @param {any} data - Resource data
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async save(path, data, options = {}) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Delete a resource
   * @param {string} path - Resource path
   * @param {Object} options - Delete options
   * @returns {Promise<void>}
   */
  async delete(path, options = {}) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Check if a resource exists
   * @param {string} path - Resource path
   * @param {Object} options - Check options
   * @returns {Promise<boolean>} Whether resource exists
   */
  async exists(path, options = {}) {
    throw new Error('exists() must be implemented by subclass');
  }

  /**
   * List resources in a directory/collection
   * @param {string} path - Directory/collection path
   * @param {Object} options - List options
   * @returns {Promise<string[]>} Array of resource paths
   */
  async list(path, options = {}) {
    throw new Error('list() must be implemented by subclass');
  }

  /**
   * Watch a resource for changes (optional)
   * @param {string} path - Resource path to watch
   * @param {Function} callback - Callback function for changes
   * @param {Object} options - Watch options
   * @returns {void}
   */
  watch(path, callback, options = {}) {
    // Optional method - not all adapters need to support watching
    console.warn(`[ResourceAdapter] Watch not supported by ${this.constructor.name}`);
  }

  /**
   * Stop watching a resource (optional)
   * @param {string} path - Resource path to stop watching
   * @returns {void}
   */
  unwatch(path) {
    // Optional method - not all adapters need to support watching
  }

  /**
   * Get adapter-specific metadata for a resource (optional)
   * @param {string} path - Resource path
   * @param {Object} options - Options
   * @returns {Promise<Object>} Resource metadata
   */
  async getMetadata(path, options = {}) {
    // Optional method - return empty metadata by default
    return {};
  }

  /**
   * Get adapter statistics (optional)
   * @returns {Promise<Object>} Adapter statistics
   */
  async getStats() {
    // Optional method - return basic info by default
    return {
      adapterType: this.constructor.name,
      supportsWatch: typeof this.watch === 'function',
      supportsMetadata: typeof this.getMetadata === 'function'
    };
  }
}