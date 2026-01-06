/**
 * Electron Resource Adapter
 * 
 * Implements the ResourceAdapter interface using Node.js file system APIs.
 * Provides platform-specific resource operations for Electron applications.
 */

import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { ResourceAdapter } from '../../foundation/resources/ResourceAdapter.js';

export class ElectronResourceAdapter extends ResourceAdapter {
  constructor(options = {}) {
    super();
    this.basePath = options.basePath || process.cwd();
    this.logger = options.logger;
    this.actionCallbacks = options.actionCallbacks;
    this.watchers = new Map(); // path -> chokidar watcher
    this.watchCallbacks = new Map(); // path -> Set of callbacks
    
    this.logger?.debug('[ElectronResourceAdapter] Initialized', {
      basePath: this.basePath,
      options
    });
  }

  /**
   * Load a resource from the file system
   * @param {string} resourcePath - Resource path relative to base path
   * @param {Object} options - Load options
   * @returns {Promise<any>} Resource data
   */
  async load(resourcePath, options = {}) {
    const context = {
      action: 'resource-load',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-load', 'before', context);

      this.logger?.debug('[ElectronResourceAdapter] Loading resource', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      // Check if file exists
      await this._checkExists(fullPath);

      // Read file content
      const content = await fs.readFile(fullPath, options.encoding || 'utf8');

      // Parse content based on file extension or options
      let data = content;
      if (options.parse !== false) {
        data = this._parseContent(content, fullPath, options);
      }

      context.success = true;
      context.dataSize = typeof content === 'string' ? content.length : content.byteLength;
      
      await this.actionCallbacks?.trigger('resource-load', 'after', context);

      this.logger?.info('[ElectronResourceAdapter] Resource loaded successfully', {
        resourcePath,
        dataSize: context.dataSize,
        parsed: data !== content
      });

      return data;

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-load', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to load resource', {
        resourcePath,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Save a resource to the file system
   * @param {string} resourcePath - Resource path relative to base path
   * @param {any} data - Resource data
   * @param {Object} options - Save options
   * @returns {Promise<void>}
   */
  async save(resourcePath, data, options = {}) {
    const context = {
      action: 'resource-save',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-save', 'before', context);

      this.logger?.debug('[ElectronResourceAdapter] Saving resource', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Serialize data if needed
      let content = data;
      if (options.serialize !== false && typeof data !== 'string' && !Buffer.isBuffer(data)) {
        content = this._serializeContent(data, fullPath, options);
      }

      // Write file
      const writeOptions = {
        encoding: options.encoding || 'utf8',
        mode: options.mode,
        flag: options.flag || 'w'
      };

      await fs.writeFile(fullPath, content, writeOptions);

      context.success = true;
      context.dataSize = typeof content === 'string' ? content.length : content.byteLength;
      
      await this.actionCallbacks?.trigger('resource-save', 'after', context);

      this.logger?.info('[ElectronResourceAdapter] Resource saved successfully', {
        resourcePath,
        dataSize: context.dataSize
      });

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-save', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to save resource', {
        resourcePath,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Delete a resource from the file system
   * @param {string} resourcePath - Resource path relative to base path
   * @param {Object} options - Delete options
   * @returns {Promise<void>}
   */
  async delete(resourcePath, options = {}) {
    const context = {
      action: 'resource-delete',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-delete', 'before', context);

      this.logger?.debug('[ElectronResourceAdapter] Deleting resource', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      // Check if file exists
      const exists = await this._exists(fullPath);
      if (!exists && !options.force) {
        throw new Error(`Resource does not exist: ${resourcePath}`);
      }

      if (exists) {
        // Get file stats for logging
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          if (options.recursive) {
            await fs.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.rmdir(fullPath);
          }
        } else {
          await fs.unlink(fullPath);
        }

        context.wasDirectory = stats.isDirectory();
      }

      context.success = true;
      
      await this.actionCallbacks?.trigger('resource-delete', 'after', context);

      this.logger?.info('[ElectronResourceAdapter] Resource deleted successfully', {
        resourcePath,
        existed: exists
      });

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-delete', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to delete resource', {
        resourcePath,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Check if a resource exists
   * @param {string} resourcePath - Resource path relative to base path
   * @param {Object} options - Check options
   * @returns {Promise<boolean>} Whether resource exists
   */
  async exists(resourcePath, options = {}) {
    const context = {
      action: 'resource-exists',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-exists', 'before', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      const exists = await this._exists(fullPath);

      context.success = true;
      context.exists = exists;
      
      await this.actionCallbacks?.trigger('resource-exists', 'after', context);

      return exists;

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-exists', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to check resource existence', {
        resourcePath,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * List resources in a directory
   * @param {string} resourcePath - Directory path relative to base path
   * @param {Object} options - List options
   * @returns {Promise<string[]>} Array of resource paths
   */
  async list(resourcePath, options = {}) {
    const context = {
      action: 'resource-list',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-list', 'before', context);

      this.logger?.debug('[ElectronResourceAdapter] Listing resources', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      // Check if directory exists
      const exists = await this._exists(fullPath);
      if (!exists) {
        throw new Error(`Directory does not exist: ${resourcePath}`);
      }

      // Check if it's actually a directory
      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${resourcePath}`);
      }

      // Read directory contents
      let entries = await fs.readdir(fullPath, { withFileTypes: true });

      // Filter based on options
      if (options.filesOnly) {
        entries = entries.filter(entry => entry.isFile());
      } else if (options.directoriesOnly) {
        entries = entries.filter(entry => entry.isDirectory());
      }

      // Apply pattern filter if specified
      if (options.pattern) {
        const regex = new RegExp(options.pattern);
        entries = entries.filter(entry => regex.test(entry.name));
      }

      // Convert to paths
      const paths = entries.map(entry => {
        const entryPath = path.join(resourcePath, entry.name);
        return options.absolute ? this._resolvePath(entryPath) : entryPath;
      });

      // Sort if requested
      if (options.sort) {
        paths.sort();
      }

      context.success = true;
      context.entryCount = paths.length;
      
      await this.actionCallbacks?.trigger('resource-list', 'after', context);

      this.logger?.info('[ElectronResourceAdapter] Resources listed successfully', {
        resourcePath,
        entryCount: paths.length
      });

      return paths;

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-list', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to list resources', {
        resourcePath,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Watch a resource for changes
   * @param {string} resourcePath - Resource path to watch
   * @param {Function} callback - Callback function for changes
   * @param {Object} options - Watch options
   * @returns {void}
   */
  watch(resourcePath, callback, options = {}) {
    const context = {
      action: 'resource-watch-start',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      this.actionCallbacks?.trigger('resource-watch-start', 'before', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Watch before callback failed', { error: err.message });
      });

      this.logger?.debug('[ElectronResourceAdapter] Starting to watch resource', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      // Store callback
      if (!this.watchCallbacks.has(resourcePath)) {
        this.watchCallbacks.set(resourcePath, new Set());
      }
      this.watchCallbacks.get(resourcePath).add(callback);

      // Create watcher if it doesn't exist
      if (!this.watchers.has(resourcePath)) {
        const watchOptions = {
          persistent: options.persistent !== false,
          ignoreInitial: options.ignoreInitial !== false,
          followSymlinks: options.followSymlinks !== false,
          depth: options.depth,
          awaitWriteFinish: options.awaitWriteFinish || {
            stabilityThreshold: 100,
            pollInterval: 100
          }
        };

        const watcher = watch(fullPath, watchOptions);

        watcher.on('add', (filePath) => {
          this._notifyWatchers(resourcePath, 'add', filePath);
        });

        watcher.on('change', (filePath) => {
          this._notifyWatchers(resourcePath, 'change', filePath);
        });

        watcher.on('unlink', (filePath) => {
          this._notifyWatchers(resourcePath, 'unlink', filePath);
        });

        watcher.on('addDir', (dirPath) => {
          this._notifyWatchers(resourcePath, 'addDir', dirPath);
        });

        watcher.on('unlinkDir', (dirPath) => {
          this._notifyWatchers(resourcePath, 'unlinkDir', dirPath);
        });

        watcher.on('error', (error) => {
          this.logger?.error('[ElectronResourceAdapter] Watcher error', {
            resourcePath,
            error: error.message
          });
          this._notifyWatchers(resourcePath, 'error', null, error);
        });

        this.watchers.set(resourcePath, watcher);
      }

      context.success = true;
      this.actionCallbacks?.trigger('resource-watch-start', 'after', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Watch after callback failed', { error: err.message });
      });

      this.logger?.info('[ElectronResourceAdapter] Started watching resource', {
        resourcePath,
        callbackCount: this.watchCallbacks.get(resourcePath).size
      });

    } catch (error) {
      context.success = false;
      context.error = error;
      
      this.actionCallbacks?.trigger('resource-watch-start', 'error', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Watch error callback failed', { error: err.message });
      });

      this.logger?.error('[ElectronResourceAdapter] Failed to start watching resource', {
        resourcePath,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Stop watching a resource
   * @param {string} resourcePath - Resource path to stop watching
   * @returns {void}
   */
  unwatch(resourcePath) {
    const context = {
      action: 'resource-watch-stop',
      source: 'ElectronResourceAdapter',
      resourcePath
    };

    try {
      this.actionCallbacks?.trigger('resource-watch-stop', 'before', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Unwatch before callback failed', { error: err.message });
      });

      this.logger?.debug('[ElectronResourceAdapter] Stopping watch on resource', context);

      // Remove callbacks
      this.watchCallbacks.delete(resourcePath);

      // Close and remove watcher
      const watcher = this.watchers.get(resourcePath);
      if (watcher) {
        watcher.close();
        this.watchers.delete(resourcePath);
      }

      context.success = true;
      this.actionCallbacks?.trigger('resource-watch-stop', 'after', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Unwatch after callback failed', { error: err.message });
      });

      this.logger?.info('[ElectronResourceAdapter] Stopped watching resource', {
        resourcePath
      });

    } catch (error) {
      context.success = false;
      context.error = error;
      
      this.actionCallbacks?.trigger('resource-watch-stop', 'error', context).catch(err => {
        this.logger?.warn('[ElectronResourceAdapter] Unwatch error callback failed', { error: err.message });
      });

      this.logger?.error('[ElectronResourceAdapter] Failed to stop watching resource', {
        resourcePath,
        error: error.message
      });
    }
  }

  /**
   * Get resource metadata
   * @param {string} resourcePath - Resource path
   * @param {Object} options - Options
   * @returns {Promise<Object>} Resource metadata
   */
  async getMetadata(resourcePath, options = {}) {
    const context = {
      action: 'resource-metadata-get',
      source: 'ElectronResourceAdapter',
      resourcePath,
      options
    };

    try {
      await this.actionCallbacks?.trigger('resource-metadata-get', 'before', context);

      const fullPath = this._resolvePath(resourcePath);
      
      // Validate path security
      this._validatePath(fullPath);

      const exists = await this._exists(fullPath);
      if (!exists) {
        throw new Error(`Resource does not exist: ${resourcePath}`);
      }

      const stats = await fs.stat(fullPath);

      const metadata = {
        path: resourcePath,
        fullPath,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid
      };

      // Add file extension and MIME type for files
      if (stats.isFile()) {
        metadata.extension = path.extname(resourcePath);
        metadata.basename = path.basename(resourcePath, metadata.extension);
        metadata.mimeType = this._getMimeType(metadata.extension);
      }

      context.success = true;
      context.metadata = metadata;
      
      await this.actionCallbacks?.trigger('resource-metadata-get', 'after', context);

      return metadata;

    } catch (error) {
      context.success = false;
      context.error = error;
      
      await this.actionCallbacks?.trigger('resource-metadata-get', 'error', context);

      this.logger?.error('[ElectronResourceAdapter] Failed to get resource metadata', {
        resourcePath,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get adapter statistics
   * @returns {Promise<Object>} Adapter statistics
   */
  async getStats() {
    return {
      adapterType: 'ElectronResourceAdapter',
      basePath: this.basePath,
      supportsWatch: true,
      supportsMetadata: true,
      activeWatchers: this.watchers.size,
      watchedPaths: Array.from(this.watchers.keys())
    };
  }

  /**
   * Resolve resource path to full file system path
   * @param {string} resourcePath - Resource path
   * @returns {string} Full file system path
   * @private
   */
  _resolvePath(resourcePath) {
    return path.resolve(this.basePath, resourcePath);
  }

  /**
   * Validate path for security (prevent directory traversal)
   * @param {string} fullPath - Full file system path
   * @private
   */
  _validatePath(fullPath) {
    const normalizedPath = path.normalize(fullPath);
    const normalizedBase = path.normalize(this.basePath);
    
    if (!normalizedPath.startsWith(normalizedBase)) {
      throw new Error(`Path traversal detected: ${fullPath}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} fullPath - Full file system path
   * @returns {Promise<boolean>} Whether file exists
   * @private
   */
  async _exists(fullPath) {
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists and throw if not
   * @param {string} fullPath - Full file system path
   * @private
   */
  async _checkExists(fullPath) {
    const exists = await this._exists(fullPath);
    if (!exists) {
      throw new Error(`Resource does not exist: ${fullPath}`);
    }
  }

  /**
   * Parse content based on file extension
   * @param {string} content - File content
   * @param {string} fullPath - Full file path
   * @param {Object} options - Parse options
   * @returns {any} Parsed content
   * @private
   */
  _parseContent(content, fullPath, options) {
    const ext = path.extname(fullPath).toLowerCase();
    
    try {
      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.js':
        case '.mjs':
          // Don't auto-parse JavaScript files for security
          return content;
        default:
          return content;
      }
    } catch (error) {
      if (options.throwOnParseError !== false) {
        throw new Error(`Failed to parse ${ext} file: ${error.message}`);
      }
      return content;
    }
  }

  /**
   * Serialize content for saving
   * @param {any} data - Data to serialize
   * @param {string} fullPath - Full file path
   * @param {Object} options - Serialize options
   * @returns {string} Serialized content
   * @private
   */
  _serializeContent(data, fullPath, options) {
    const ext = path.extname(fullPath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return JSON.stringify(data, null, options.indent || 2);
      default:
        return String(data);
    }
  }

  /**
   * Get MIME type for file extension
   * @param {string} extension - File extension
   * @returns {string} MIME type
   * @private
   */
  _getMimeType(extension) {
    const mimeTypes = {
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Notify all watchers for a resource path
   * @param {string} resourcePath - Resource path
   * @param {string} event - Event type
   * @param {string} filePath - Changed file path
   * @param {Error} error - Error if applicable
   * @private
   */
  _notifyWatchers(resourcePath, event, filePath, error = null) {
    const callbacks = this.watchCallbacks.get(resourcePath);
    if (!callbacks) return;

    const eventData = {
      event,
      path: filePath,
      resourcePath,
      timestamp: Date.now(),
      error
    };

    for (const callback of callbacks) {
      try {
        callback(eventData);
      } catch (callbackError) {
        this.logger?.error('[ElectronResourceAdapter] Watch callback error', {
          resourcePath,
          event,
          error: callbackError.message
        });
      }
    }
  }

  /**
   * Cleanup all watchers
   */
  cleanup() {
    for (const [resourcePath, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        this.logger?.warn('[ElectronResourceAdapter] Error closing watcher', {
          resourcePath,
          error: error.message
        });
      }
    }
    
    this.watchers.clear();
    this.watchCallbacks.clear();
    
    this.logger?.info('[ElectronResourceAdapter] Cleanup completed', {
      watchersCleared: this.watchers.size
    });
  }
}