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
import { createCallbackModule } from './callbackFactory.js';

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

// Create the callback module using the factory
const fileSystemCallbacks = createCallbackModule({
  eventTypes: FILE_SYSTEM_EVENTS,
  moduleName: 'fileSystem',
  debugPrefix: '[FILE_SYSTEM_CALLBACK]'
});

// Export all functions
export const registerFileSavedCallback = fileSystemCallbacks.registerFILE_SAVEDCallback;
export const registerFileLoadedCallback = fileSystemCallbacks.registerFILE_LOADEDCallback;
export const registerFileDeletedCallback = fileSystemCallbacks.registerFILE_DELETEDCallback;
export const registerDirectoryChangedCallback = fileSystemCallbacks.registerDIRECTORY_CHANGEDCallback;
export const registerValidationFailedCallback = fileSystemCallbacks.registerVALIDATION_FAILEDCallback;

export const unregisterFileSystemCallback = fileSystemCallbacks.unregister;
export const clearFileSystemCallbacks = fileSystemCallbacks.clear;

export function triggerFileSaved(filePath, data = {}) {
  return fileSystemCallbacks.triggerFILE_SAVED(filePath, { filePath, ...data });
}

export function triggerFileLoaded(filePath, data = {}) {
  return fileSystemCallbacks.triggerFILE_LOADED(filePath, { filePath, ...data });
}

export function triggerFileDeleted(filePath, data = {}) {
  return fileSystemCallbacks.triggerFILE_DELETED(filePath, { filePath, ...data });
}

export function triggerDirectoryChanged(data = {}) {
  return fileSystemCallbacks.triggerDIRECTORY_CHANGED(null, data);
}

export function triggerValidationFailed(data = {}) {
  return fileSystemCallbacks.triggerVALIDATION_FAILED(null, data);
}