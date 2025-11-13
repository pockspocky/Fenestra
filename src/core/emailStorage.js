/**
 * Email Storage Manager
 * Handles email JSON file management, validation, and inbox directory monitoring
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import chokidar from 'chokidar';
import '../../logger.js';

// In-memory email cache
const emailCache = new Map();

// File watcher instance
let watcher = null;

// Inbox directory path
let inboxPath = null;

// Watcher callback
let watcherCallback = null;

/**
 * Validates email JSON structure according to schema
 * @param {Object} jsonData - Email data to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateEmailJson(jsonData) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Required fields validation
  const requiredFields = [
    { name: 'id', type: 'string' },
    { name: 'senderName', type: 'string' },
    { name: 'senderEmail', type: 'string' },
    { name: 'subject', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'isRead', type: 'boolean' }
  ];

  for (const field of requiredFields) {
    if (!(field.name in jsonData)) {
      validation.errors.push(`Missing required field: ${field.name}`);
      continue;
    }

    if (typeof jsonData[field.name] !== field.type) {
      validation.errors.push(`Field ${field.name} must be of type ${field.type}`);
    }
  }

  // Validate email format for senderEmail
  if (jsonData.senderEmail && typeof jsonData.senderEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(jsonData.senderEmail)) {
      validation.errors.push('senderEmail must be a valid email format');
    }
  }

  // Validate timestamp format (ISO 8601)
  if (jsonData.timestamp && typeof jsonData.timestamp === 'string') {
    const date = new Date(jsonData.timestamp);
    if (isNaN(date.getTime())) {
      validation.errors.push('timestamp must be in ISO 8601 format');
    }
  }

  // Validate optional fields
  if (jsonData.recipientEmail && typeof jsonData.recipientEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(jsonData.recipientEmail)) {
      validation.warnings.push('recipientEmail should be a valid email format');
    }
  }

  // Validate bodyType if present
  if (jsonData.bodyType && !['text', 'html'].includes(jsonData.bodyType)) {
    validation.errors.push('bodyType must be either "text" or "html"');
  }

  // Validate priority if present
  if (jsonData.priority && !['low', 'normal', 'high'].includes(jsonData.priority)) {
    validation.warnings.push('priority should be "low", "normal", or "high"');
  }

  // Validate attachments array if present
  if (jsonData.attachments) {
    if (!Array.isArray(jsonData.attachments)) {
      validation.errors.push('attachments must be an array');
    } else {
      jsonData.attachments.forEach((attachment, index) => {
        if (!attachment.fileName || typeof attachment.fileName !== 'string') {
          validation.errors.push(`attachments[${index}].fileName is required and must be a string`);
        }
        if (typeof attachment.fileSize !== 'number') {
          validation.errors.push(`attachments[${index}].fileSize is required and must be a number`);
        }
        if (!attachment.filePath || typeof attachment.filePath !== 'string') {
          validation.errors.push(`attachments[${index}].filePath is required and must be a string`);
        }
      });
    }
  }

  // Validate actions array if present
  if (jsonData.actions) {
    if (!Array.isArray(jsonData.actions)) {
      validation.errors.push('actions must be an array');
    } else {
      const validActionTypes = ['createWindow', 'createDoor', 'createLens', 'executeFunction', 'openPath'];
      jsonData.actions.forEach((action, index) => {
        if (!action.label || typeof action.label !== 'string') {
          validation.errors.push(`actions[${index}].label is required and must be a string`);
        }
        if (!action.type || typeof action.type !== 'string') {
          validation.errors.push(`actions[${index}].type is required and must be a string`);
        } else if (!validActionTypes.includes(action.type)) {
          validation.errors.push(`actions[${index}].type must be one of: ${validActionTypes.join(', ')}`);
        }
        if (!action.parameters || typeof action.parameters !== 'object') {
          validation.errors.push(`actions[${index}].parameters is required and must be an object`);
        }
      });
    }
  }

  validation.isValid = validation.errors.length === 0;
  return validation;
}

/**
 * Initializes email storage system with inbox directory
 * @param {string} customInboxPath - Optional custom inbox path
 * @returns {Promise<Object>} Initialization result with success flag and path
 */
export async function initializeEmailStorage(customInboxPath = null) {
  try {
    // Set inbox path
    inboxPath = customInboxPath || path.join(app.getPath('userData'), 'fenestra', 'inbox');
    
    console.log('[EMAIL] Initializing email storage', { inboxPath });

    // Create inbox directory if it doesn't exist
    try {
      await fs.access(inboxPath);
    } catch (error) {
      console.log('[EMAIL] Creating inbox directory', { inboxPath });
      await fs.mkdir(inboxPath, { recursive: true });
    }

    // Load existing emails into cache
    await loadEmailsIntoCache();

    console.log('[EMAIL] Email storage initialized', { 
      inboxPath, 
      emailCount: emailCache.size 
    });

    return {
      success: true,
      inboxPath,
      emailCount: emailCache.size
    };
  } catch (error) {
    console.error('[EMAIL] Failed to initialize email storage', {
      error: error.message,
      inboxPath
    });
    
    return {
      success: false,
      error: error.message,
      inboxPath
    };
  }
}

/**
 * Loads all email JSON files from inbox directory into cache
 * @private
 */
async function loadEmailsIntoCache() {
  try {
    const files = await fs.readdir(inboxPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    console.log('[EMAIL] Loading emails into cache', { 
      fileCount: jsonFiles.length 
    });

    for (const file of jsonFiles) {
      const filePath = path.join(inboxPath, file);
      await loadEmailFile(filePath);
    }

    console.log('[EMAIL] Emails loaded into cache', { 
      emailCount: emailCache.size 
    });
  } catch (error) {
    console.error('[EMAIL] Failed to load emails into cache', {
      error: error.message
    });
  }
}

/**
 * Loads a single email file and adds it to cache
 * @param {string} filePath - Path to email JSON file
 * @private
 */
async function loadEmailFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const emailData = JSON.parse(fileContent);

    // Validate email JSON
    const validation = validateEmailJson(emailData);
    
    if (!validation.isValid) {
      console.warn('[EMAIL] Invalid email JSON file', {
        filePath,
        errors: validation.errors
      });
      return;
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.log('[EMAIL] Email validation warnings', {
        filePath,
        warnings: validation.warnings
      });
    }

    // Add to cache
    emailCache.set(emailData.id, {
      ...emailData,
      _filePath: filePath,
      _fileName: path.basename(filePath)
    });

    console.log('[EMAIL] Email loaded', {
      emailId: emailData.id,
      subject: emailData.subject
    });
  } catch (error) {
    console.error('[EMAIL] Failed to load email file', {
      filePath,
      error: error.message
    });
  }
}

/**
 * Gets paginated list of emails sorted by timestamp descending
 * @param {number} limit - Maximum number of emails to return
 * @param {number} offset - Number of emails to skip
 * @returns {Promise<Array>} Array of email objects
 */
export async function getEmails(limit = 50, offset = 0) {
  try {
    // Convert cache to array and sort by timestamp descending
    const emails = Array.from(emailCache.values())
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA; // Descending order
      });

    // Apply pagination
    const paginatedEmails = emails.slice(offset, offset + limit);

    console.log('[EMAIL] Retrieved emails', {
      total: emails.length,
      limit,
      offset,
      returned: paginatedEmails.length
    });

    return paginatedEmails;
  } catch (error) {
    console.error('[EMAIL] Failed to get emails', {
      error: error.message,
      limit,
      offset
    });
    return [];
  }
}

/**
 * Gets a single email by ID
 * @param {string} emailId - Email ID to retrieve
 * @returns {Promise<Object|null>} Email object or null if not found
 */
export async function getEmailById(emailId) {
  try {
    const email = emailCache.get(emailId);
    
    if (!email) {
      console.log('[EMAIL] Email not found', { emailId });
      return null;
    }

    console.log('[EMAIL] Retrieved email', {
      emailId,
      subject: email.subject
    });

    return email;
  } catch (error) {
    console.error('[EMAIL] Failed to get email by ID', {
      emailId,
      error: error.message
    });
    return null;
  }
}

/**
 * Marks an email as read and updates the JSON file
 * @param {string} emailId - Email ID to mark as read
 * @returns {Promise<Object>} Result with success flag
 */
export async function markEmailAsRead(emailId) {
  try {
    const email = emailCache.get(emailId);
    
    if (!email) {
      console.warn('[EMAIL] Cannot mark email as read - not found', { emailId });
      return {
        success: false,
        error: 'Email not found'
      };
    }

    // Skip if already read
    if (email.isRead) {
      console.log('[EMAIL] Email already marked as read', { emailId });
      return {
        success: true,
        alreadyRead: true
      };
    }

    // Update in-memory cache
    email.isRead = true;

    // Update JSON file
    const filePath = email._filePath;
    const emailDataToSave = { ...email };
    delete emailDataToSave._filePath;
    delete emailDataToSave._fileName;

    await fs.writeFile(filePath, JSON.stringify(emailDataToSave, null, 2), 'utf8');

    console.log('[EMAIL] Email marked as read', {
      emailId,
      subject: email.subject
    });

    return {
      success: true,
      emailId
    };
  } catch (error) {
    console.error('[EMAIL] Failed to mark email as read', {
      emailId,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Starts watching inbox directory for changes
 * @param {Function} callback - Callback function to invoke on file changes
 * @returns {Object} Result with success flag
 */
export function watchInboxDirectory(callback) {
  try {
    if (!inboxPath) {
      console.error('[EMAIL] Cannot watch inbox - not initialized');
      return {
        success: false,
        error: 'Email storage not initialized'
      };
    }

    if (watcher) {
      console.log('[EMAIL] Inbox watcher already running');
      return {
        success: true,
        alreadyWatching: true
      };
    }

    // Store callback
    watcherCallback = callback;

    // Initialize chokidar watcher
    watcher = chokidar.watch(path.join(inboxPath, '*.json'), {
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file to stabilize
        pollInterval: 50
      }
    });

    // Handle new email files
    watcher.on('add', async (filePath) => {
      console.log('[EMAIL] New email file detected', { filePath });
      await loadEmailFile(filePath);
      
      if (watcherCallback) {
        const fileName = path.basename(filePath);
        watcherCallback('add', fileName);
      }
    });

    // Handle modified email files
    watcher.on('change', async (filePath) => {
      console.log('[EMAIL] Email file modified', { filePath });
      await loadEmailFile(filePath);
      
      if (watcherCallback) {
        const fileName = path.basename(filePath);
        watcherCallback('change', fileName);
      }
    });

    // Handle deleted email files
    watcher.on('unlink', (filePath) => {
      console.log('[EMAIL] Email file deleted', { filePath });
      
      // Remove from cache
      for (const [emailId, email] of emailCache.entries()) {
        if (email._filePath === filePath) {
          emailCache.delete(emailId);
          console.log('[EMAIL] Email removed from cache', { emailId });
          break;
        }
      }
      
      if (watcherCallback) {
        const fileName = path.basename(filePath);
        watcherCallback('unlink', fileName);
      }
    });

    // Handle watcher errors
    watcher.on('error', (error) => {
      console.error('[EMAIL] Inbox watcher error', {
        error: error.message
      });
    });

    console.log('[EMAIL] Inbox directory watcher started', { inboxPath });

    return {
      success: true,
      inboxPath
    };
  } catch (error) {
    console.error('[EMAIL] Failed to start inbox watcher', {
      error: error.message,
      inboxPath
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Stops watching inbox directory
 * @returns {Promise<Object>} Result with success flag
 */
export async function stopWatching() {
  try {
    if (!watcher) {
      console.log('[EMAIL] No watcher to stop');
      return {
        success: true,
        wasWatching: false
      };
    }

    await watcher.close();
    watcher = null;
    watcherCallback = null;

    console.log('[EMAIL] Inbox watcher stopped');

    return {
      success: true
    };
  } catch (error) {
    console.error('[EMAIL] Failed to stop inbox watcher', {
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gets the current inbox directory path
 * @returns {string|null} Inbox path or null if not initialized
 */
export function getInboxPath() {
  return inboxPath;
}

/**
 * Gets the current email cache size
 * @returns {number} Number of emails in cache
 */
export function getCacheSize() {
  return emailCache.size;
}

/**
 * Clears the email cache (for testing purposes)
 * @returns {void}
 */
export function clearCache() {
  emailCache.clear();
  console.log('[EMAIL] Email cache cleared');
}
