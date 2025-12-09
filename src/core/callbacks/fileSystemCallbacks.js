/**
 * File System Callbacks Integration Module
 * 
 * Provides callback integration for file system events including
 * file save, load, delete operations, directory navigation, and validation failures.
 * 
 * @module callbacks/fileSystemCallbacks
 */

import path from 'node:path';
import '../../../logger.js';
import { callbackRegistry } from '../callbackRegistry.js';

/**
 * File system event types
 */
export const FILE_SYSTEM_EVENTS = {
  FILE_SAVED: 'file-saved',
  FILE_LOADED: 'file-loaded',
  FILE_DELETED: 'file-deleted',
  DIRECTORY_CHANGED: 'directory-changed',
  VALIDATION_FAILED: 'validation-failed'
};

/**
 * Register a callback for file saved events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - File path for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * // Register global file saved callback
 * const regId = registerFileSavedCallback((eventType, eventData) => {
 *   console.log('File saved:', eventData.data.filePath);
 * });
 * 
 * @example
 * // Register entity-specific callback with priority
 * const regId = registerFileSavedCallback(
 *   (eventType, eventData) => {
 *     console.log('Specific file saved');
 *   },
 *   { entityId: '/path/to/file.txt', priority: 10 }
 * );
 */
export function registerFileSavedCallback(callback, options = {}) {
  return callbackRegistry.register(FILE_SYSTEM_EVENTS.FILE_SAVED, callback, options);
}

/**
 * Register a callback for file loaded events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - File path for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerFileLoadedCallback((eventType, eventData) => {
 *   console.log('File loaded:', eventData.data.filePath);
 * });
 */
export function registerFileLoadedCallback(callback, options = {}) {
  return callbackRegistry.register(FILE_SYSTEM_EVENTS.FILE_LOADED, callback, options);
}

/**
 * Register a callback for file deleted events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - File path for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerFileDeletedCallback((eventType, eventData) => {
 *   console.log('File deleted:', eventData.data.filePath);
 * });
 */
export function registerFileDeletedCallback(callback, options = {}) {
  return callbackRegistry.register(FILE_SYSTEM_EVENTS.FILE_DELETED, callback, options);
}

/**
 * Register a callback for directory changed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Directory path for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerDirectoryChangedCallback((eventType, eventData) => {
 *   console.log('Directory changed:', eventData.data.newPath);
 * });
 */
export function registerDirectoryChangedCallback(callback, options = {}) {
  return callbackRegistry.register(FILE_SYSTEM_EVENTS.DIRECTORY_CHANGED, callback, options);
}

/**
 * Register a callback for validation failed events
 * 
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Registration options
 * @param {string} [options.entityId] - Path for entity-specific callback
 * @param {number} [options.priority=0] - Execution priority
 * @param {boolean} [options.once=false] - Execute only once
 * @returns {string} Registration ID for unregistering
 * 
 * @example
 * registerValidationFailedCallback((eventType, eventData) => {
 *   console.log('Validation failed:', eventData.data.error);
 * });
 */
export function registerValidationFailedCallback(callback, options = {}) {
  return callbackRegistry.register(FILE_SYSTEM_EVENTS.VALIDATION_FAILED, callback, options);
}

/**
 * Unregister a file system callback
 * 
 * @param {string} registrationId - Registration ID returned from register function
 * @returns {boolean} True if callback was found and removed
 * 
 * @example
 * const regId = registerFileSavedCallback(callback);
 * unregisterFileSystemCallback(regId);
 */
export function unregisterFileSystemCallback(registrationId) {
  return callbackRegistry.unregister(registrationId);
}

/**
 * Clear all callbacks for a specific file or directory path
 * 
 * @param {string} filePath - File or directory path
 * @returns {number} Number of callbacks removed
 * 
 * @example
 * clearFileSystemCallbacks('/path/to/file.txt');
 */
export function clearFileSystemCallbacks(filePath) {
  return callbackRegistry.clearEntity(filePath);
}

/**
 * Trigger file saved event
 * 
 * @param {string} filePath - File path (normalized using path.join/resolve)
 * @param {*} data - File data that was saved
 * @returns {Object} Execution result
 */
export function triggerFileSaved(filePath, data = null) {
  // Normalize path for cross-platform compatibility
  const normalizedPath = path.resolve(filePath);
  
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-saved event', { 
    filePath: normalizedPath 
  });
  
  return callbackRegistry.execute(FILE_SYSTEM_EVENTS.FILE_SAVED, {
    entityId: normalizedPath,
    timestamp: Date.now(),
    source: 'fileSystem',
    data: {
      filePath: normalizedPath,
      data
    }
  });
}

/**
 * Trigger file loaded event
 * 
 * @param {string} filePath - File path (normalized using path.join/resolve)
 * @param {*} content - File content that was loaded
 * @returns {Object} Execution result
 */
export function triggerFileLoaded(filePath, content = null) {
  // Normalize path for cross-platform compatibility
  const normalizedPath = path.resolve(filePath);
  
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-loaded event', { 
    filePath: normalizedPath 
  });
  
  return callbackRegistry.execute(FILE_SYSTEM_EVENTS.FILE_LOADED, {
    entityId: normalizedPath,
    timestamp: Date.now(),
    source: 'fileSystem',
    data: {
      filePath: normalizedPath,
      content
    }
  });
}

/**
 * Trigger file deleted event
 * 
 * @param {string} filePath - File path (normalized using path.join/resolve)
 * @returns {Object} Execution result
 */
export function triggerFileDeleted(filePath) {
  // Normalize path for cross-platform compatibility
  const normalizedPath = path.resolve(filePath);
  
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-deleted event', { 
    filePath: normalizedPath 
  });
  
  return callbackRegistry.execute(FILE_SYSTEM_EVENTS.FILE_DELETED, {
    entityId: normalizedPath,
    timestamp: Date.now(),
    source: 'fileSystem',
    data: {
      filePath: normalizedPath
    }
  });
}

/**
 * Trigger directory changed event
 * 
 * @param {string} newPath - New directory path (normalized using path.join/resolve)
 * @param {string} oldPath - Previous directory path (optional)
 * @returns {Object} Execution result
 */
export function triggerDirectoryChanged(newPath, oldPath = null) {
  // Normalize paths for cross-platform compatibility
  const normalizedNewPath = path.resolve(newPath);
  const normalizedOldPath = oldPath ? path.resolve(oldPath) : null;
  
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering directory-changed event', { 
    newPath: normalizedNewPath,
    oldPath: normalizedOldPath
  });
  
  return callbackRegistry.execute(FILE_SYSTEM_EVENTS.DIRECTORY_CHANGED, {
    entityId: normalizedNewPath,
    timestamp: Date.now(),
    source: 'fileSystem',
    data: {
      newPath: normalizedNewPath,
      oldPath: normalizedOldPath
    },
    previousState: normalizedOldPath
  });
}

/**
 * Trigger validation failed event
 * 
 * @param {string} targetPath - Path that failed validation (normalized using path.join/resolve)
 * @param {Object} errorDetails - Validation error details
 * @returns {Object} Execution result
 */
export function triggerValidationFailed(targetPath, errorDetails = {}) {
  // Normalize path for cross-platform compatibility
  const normalizedPath = path.resolve(targetPath);
  
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering validation-failed event', { 
    targetPath: normalizedPath,
    error: errorDetails.error || errorDetails.message
  });
  
  return callbackRegistry.execute(FILE_SYSTEM_EVENTS.VALIDATION_FAILED, {
    entityId: normalizedPath,
    timestamp: Date.now(),
    source: 'fileSystem',
    data: {
      targetPath: normalizedPath,
      error: errorDetails.error || errorDetails.message || 'Validation failed',
      errorCode: errorDetails.errorCode || errorDetails.code,
      details: errorDetails
    }
  });
}
