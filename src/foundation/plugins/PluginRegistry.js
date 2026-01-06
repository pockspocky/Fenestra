/**
 * Plugin Registry for Discovery and Metadata Management
 * 
 * Manages plugin discovery, validation, and metadata. Provides a centralized
 * registry for available plugins and their capabilities.
 */

export class PluginRegistry {
  constructor(options = {}) {
    this.plugins = new Map(); // pluginId -> plugin metadata
    this.categories = new Map(); // category -> Set of plugin IDs
    this.tags = new Map(); // tag -> Set of plugin IDs
    this.dependencies = new Map(); // pluginId -> Set of dependency IDs
    this.dependents = new Map(); // pluginId -> Set of dependent IDs
    this.logger = options.logger;
  }

  /**
   * Register a plugin in the registry
   * @param {string} pluginId - Plugin ID
   * @param {Object} manifest - Plugin manifest
   * @param {Object} metadata - Additional metadata
   */
  register(pluginId, manifest, metadata = {}) {
    const pluginMetadata = {
      id: pluginId,
      manifest: { ...manifest },
      metadata: {
        registeredAt: Date.now(),
        source: metadata.source || 'unknown',
        path: metadata.path || null,
        ...metadata
      },
      status: 'registered' // 'registered', 'loaded', 'active', 'error'
    };

    this.plugins.set(pluginId, pluginMetadata);

    // Index by category
    if (manifest.category) {
      if (!this.categories.has(manifest.category)) {
        this.categories.set(manifest.category, new Set());
      }
      this.categories.get(manifest.category).add(pluginId);
    }

    // Index by tags
    if (manifest.tags && Array.isArray(manifest.tags)) {
      for (const tag of manifest.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag).add(pluginId);
      }
    }

    // Index dependencies
    if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
      const deps = new Set();
      
      for (const dep of manifest.dependencies) {
        const depId = typeof dep === 'string' ? dep : dep.plugin;
        deps.add(depId);
        
        // Add to dependents map
        if (!this.dependents.has(depId)) {
          this.dependents.set(depId, new Set());
        }
        this.dependents.get(depId).add(pluginId);
      }
      
      this.dependencies.set(pluginId, deps);
    }

    if (this.logger) {
      this.logger.debug('Plugin registered in registry', {
        operation: 'registerPlugin',
        pluginId,
        category: manifest.category,
        tags: manifest.tags,
        dependencies: manifest.dependencies?.length || 0
      });
    }
  }

  /**
   * Unregister a plugin from the registry
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} Whether plugin was unregistered
   */
  unregister(pluginId) {
    const pluginMetadata = this.plugins.get(pluginId);
    if (!pluginMetadata) {
      return false;
    }

    // Remove from main registry
    this.plugins.delete(pluginId);

    // Remove from category index
    if (pluginMetadata.manifest.category) {
      const categoryPlugins = this.categories.get(pluginMetadata.manifest.category);
      if (categoryPlugins) {
        categoryPlugins.delete(pluginId);
        if (categoryPlugins.size === 0) {
          this.categories.delete(pluginMetadata.manifest.category);
        }
      }
    }

    // Remove from tag index
    if (pluginMetadata.manifest.tags) {
      for (const tag of pluginMetadata.manifest.tags) {
        const tagPlugins = this.tags.get(tag);
        if (tagPlugins) {
          tagPlugins.delete(pluginId);
          if (tagPlugins.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    // Remove from dependency maps
    this.dependencies.delete(pluginId);
    this.dependents.delete(pluginId);

    // Remove from other plugins' dependents
    for (const [depId, dependents] of this.dependents) {
      dependents.delete(pluginId);
    }

    if (this.logger) {
      this.logger.debug('Plugin unregistered from registry', {
        operation: 'unregisterPlugin',
        pluginId
      });
    }

    return true;
  }

  /**
   * Get plugin metadata
   * @param {string} pluginId - Plugin ID
   * @returns {Object|null} Plugin metadata or null if not found
   */
  getPlugin(pluginId) {
    const metadata = this.plugins.get(pluginId);
    return metadata ? { ...metadata } : null;
  }

  /**
   * Check if plugin is registered
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} Whether plugin is registered
   */
  hasPlugin(pluginId) {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugins
   * @returns {Object[]} Array of plugin metadata
   */
  getAllPlugins() {
    return Array.from(this.plugins.values()).map(metadata => ({ ...metadata }));
  }

  /**
   * Get plugins by category
   * @param {string} category - Plugin category
   * @returns {Object[]} Array of plugin metadata
   */
  getPluginsByCategory(category) {
    const pluginIds = this.categories.get(category);
    if (!pluginIds) {
      return [];
    }

    return Array.from(pluginIds).map(id => this.getPlugin(id)).filter(Boolean);
  }

  /**
   * Get plugins by tag
   * @param {string} tag - Plugin tag
   * @returns {Object[]} Array of plugin metadata
   */
  getPluginsByTag(tag) {
    const pluginIds = this.tags.get(tag);
    if (!pluginIds) {
      return [];
    }

    return Array.from(pluginIds).map(id => this.getPlugin(id)).filter(Boolean);
  }

  /**
   * Search plugins by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Object[]} Array of matching plugin metadata
   */
  searchPlugins(criteria = {}) {
    let results = this.getAllPlugins();

    // Filter by name/description
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      results = results.filter(plugin => 
        plugin.manifest.name?.toLowerCase().includes(query) ||
        plugin.manifest.description?.toLowerCase().includes(query) ||
        plugin.id.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (criteria.category) {
      results = results.filter(plugin => plugin.manifest.category === criteria.category);
    }

    // Filter by tags
    if (criteria.tags && Array.isArray(criteria.tags)) {
      results = results.filter(plugin => {
        if (!plugin.manifest.tags) return false;
        return criteria.tags.some(tag => plugin.manifest.tags.includes(tag));
      });
    }

    // Filter by status
    if (criteria.status) {
      results = results.filter(plugin => plugin.status === criteria.status);
    }

    // Filter by author
    if (criteria.author) {
      results = results.filter(plugin => plugin.manifest.author === criteria.author);
    }

    // Sort results
    if (criteria.sortBy) {
      results.sort((a, b) => {
        const aValue = this._getNestedValue(a, criteria.sortBy);
        const bValue = this._getNestedValue(b, criteria.sortBy);
        
        if (criteria.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
    }

    // Limit results
    if (criteria.limit && criteria.limit > 0) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Get plugin dependencies
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of dependency plugin IDs
   */
  getDependencies(pluginId) {
    const deps = this.dependencies.get(pluginId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get plugins that depend on this plugin
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of dependent plugin IDs
   */
  getDependents(pluginId) {
    const dependents = this.dependents.get(pluginId);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * Calculate dependency resolution order
   * @param {string[]} pluginIds - Plugin IDs to resolve
   * @returns {string[]} Ordered array of plugin IDs
   */
  resolveDependencyOrder(pluginIds) {
    const resolved = [];
    const resolving = new Set();
    const visited = new Set();

    const resolve = (pluginId) => {
      if (visited.has(pluginId)) {
        return;
      }

      if (resolving.has(pluginId)) {
        throw new Error(`Circular dependency detected involving plugin: ${pluginId}`);
      }

      resolving.add(pluginId);

      // Resolve dependencies first
      const deps = this.getDependencies(pluginId);
      for (const dep of deps) {
        if (pluginIds.includes(dep)) {
          resolve(dep);
        }
      }

      resolving.delete(pluginId);
      visited.add(pluginId);
      resolved.push(pluginId);
    };

    for (const pluginId of pluginIds) {
      resolve(pluginId);
    }

    return resolved;
  }

  /**
   * Validate plugin dependencies
   * @param {string} pluginId - Plugin ID
   * @returns {Object} Validation result
   */
  validateDependencies(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return { isValid: false, errors: [`Plugin ${pluginId} not found`] };
    }

    const errors = [];
    const warnings = [];
    const deps = this.getDependencies(pluginId);

    for (const depId of deps) {
      if (!this.hasPlugin(depId)) {
        errors.push(`Dependency ${depId} is not registered`);
        continue;
      }

      const depPlugin = this.getPlugin(depId);
      
      // Check if dependency is in error state
      if (depPlugin.status === 'error') {
        warnings.push(`Dependency ${depId} is in error state`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update plugin status
   * @param {string} pluginId - Plugin ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   */
  updateStatus(pluginId, status, metadata = {}) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status = status;
      plugin.metadata = { ...plugin.metadata, ...metadata };
      
      if (this.logger) {
        this.logger.debug('Plugin status updated', {
          operation: 'updatePluginStatus',
          pluginId,
          status,
          metadata
        });
      }
    }
  }

  /**
   * Get all categories
   * @returns {string[]} Array of category names
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all tags
   * @returns {string[]} Array of tag names
   */
  getTags() {
    return Array.from(this.tags.keys());
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const statusCounts = {};
    const categoryCounts = {};
    const tagCounts = {};

    for (const plugin of this.plugins.values()) {
      // Count by status
      statusCounts[plugin.status] = (statusCounts[plugin.status] || 0) + 1;
      
      // Count by category
      if (plugin.manifest.category) {
        categoryCounts[plugin.manifest.category] = (categoryCounts[plugin.manifest.category] || 0) + 1;
      }
      
      // Count by tags
      if (plugin.manifest.tags) {
        for (const tag of plugin.manifest.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    return {
      totalPlugins: this.plugins.size,
      statusCounts,
      categoryCounts,
      tagCounts,
      totalCategories: this.categories.size,
      totalTags: this.tags.size,
      totalDependencies: Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0)
    };
  }

  /**
   * Clear the registry (useful for testing)
   */
  clear() {
    this.plugins.clear();
    this.categories.clear();
    this.tags.clear();
    this.dependencies.clear();
    this.dependents.clear();
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}