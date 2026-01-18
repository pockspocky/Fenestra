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
import { domainEvents, FS_EVENTS } from '../../events/domainEvents.js';

// Re-export event constants for backward compatibility
export { FS_EVENTS as FILE_SYSTEM_EVENTS };

// Export all functions
export function registerFileSavedCallback(callback, options = {}) {
  return domainEvents.on(FS_EVENTS.FILE_SAVED, callback, options);
}

export function registerFileLoadedCallback(callback, options = {}) {
  return domainEvents.on(FS_EVENTS.FILE_LOADED, callback, options);
}

export function registerFileDeletedCallback(callback, options = {}) {
  return domainEvents.on(FS_EVENTS.FILE_DELETED, callback, options);
}

export function registerDirectoryChangedCallback(callback, options = {}) {
  return domainEvents.on(FS_EVENTS.DIRECTORY_CHANGED, callback, options);
}

export function registerValidationFailedCallback(callback, options = {}) {
  return domainEvents.on(FS_EVENTS.VALIDATION_FAILED, callback, options);
}

export function unregisterFileSystemCallback(registrationId) {
  return domainEvents.off(registrationId);
}

export function clearFileSystemCallbacks(entityId) {
  return domainEvents.cleanup(entityId);
}

export function triggerFileSaved(filePath, data = {}) {
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-saved', { filePath });
  return domainEvents.emit(FS_EVENTS.FILE_SAVED, {
    entityId: filePath,
    filePath,
    timestamp: Date.now(),
    source: 'fileSystem',
    ...data
  });
}

export function triggerFileLoaded(filePath, data = {}) {
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-loaded', { filePath });
  return domainEvents.emit(FS_EVENTS.FILE_LOADED, {
    entityId: filePath,
    filePath,
    timestamp: Date.now(),
    source: 'fileSystem',
    ...data
  });
}

export function triggerFileDeleted(filePath, data = {}) {
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering file-deleted', { filePath });
  return domainEvents.emit(FS_EVENTS.FILE_DELETED, {
    entityId: filePath,
    filePath,
    timestamp: Date.now(),
    source: 'fileSystem',
    ...data
  });
}

export function triggerDirectoryChanged(data = {}) {
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering directory-changed');
  return domainEvents.emit(FS_EVENTS.DIRECTORY_CHANGED, {
    timestamp: Date.now(),
    source: 'fileSystem',
    ...data
  });
}

export function triggerValidationFailed(data = {}) {
  console.debug('[FILE_SYSTEM_CALLBACK] Triggering validation-failed');
  return domainEvents.emit(FS_EVENTS.VALIDATION_FAILED, {
    timestamp: Date.now(),
    source: 'fileSystem',
    ...data
  });
}