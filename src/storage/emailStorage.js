/**
 * Email Storage Manager
 * Handles email JSON file management, validation, and inbox directory monitoring
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { app } from 'electron';
import chokidar from 'chokidar';
import '../../logger.js';
import { joinPaths, validatePathCharacters, normalizePath } from '../utils/pathUtils.js';
import { 
  triggerEmailReceived, 
  triggerEmailRead, 
  triggerInboxChanged, 
  triggerEmailValidationFailed 
} from '../core/callbacks/emailCallbacks.js';
import { emailSchemaValidator } from '../security/emailSchemaValidator.js';
import { getGameDataDirectory } from '../core/config.js';
import { loadHtmlFile, ensureTemplatesDirectory } from './htmlFileLoader.js';

// Error codes for email storage operations
const EMAIL_ERROR_CODES = {
  INBOX_NOT_INITIALIZED: 'INBOX_NOT_INITIALIZED',
  INBOX_INACCESSIBLE: 'INBOX_INACCESSIBLE',
  INBOX_CREATION_FAILED: 'INBOX_CREATION_FAILED',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_PERMISSION_ERROR: 'FILE_PERMISSION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  WATCHER_ERROR: 'WATCHER_ERROR'
};

// In-memory email cache
const emailCache = new Map();

// File watcher instance
let watcher = null;

// Inbox directory path
let inboxPath = null;

// Watcher callback
let watcherCallback = null;

// Track read-only status
let isReadOnly = false;

// Track watcher ready state
let watcherReady = false;
let watcherReadyPromise = null;

/**
 * Validates email JSON structure according to schema
 * @param {Object} jsonData - Email data to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateEmailJson(jsonData) {
  try {
    // Use the new schema validator for comprehensive validation
    const schemaValidation = emailSchemaValidator.validateEmailJson(jsonData);
    
    if (!schemaValidation.isValid) {
      console.warn('[EMAIL] Schema validation failed', {
        errors: schemaValidation.errors,
        emailId: jsonData?.id
      });
    }

    // Convert schema validation result to legacy format for compatibility
    return {
      isValid: schemaValidation.isValid,
      errors: schemaValidation.errors,
      warnings: schemaValidation.warnings
    };
  } catch (error) {
    console.error('[EMAIL] Email validation error', {
      error: error.message,
      emailId: jsonData?.id
    });

    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings: []
    };
  }
}

/**
 * Checks if a path is accessible and validates permissions
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<Object>} Access check result
 */
async function checkDirectoryAccess(dirPath) {
  try {
    // Check if directory exists
    await fs.access(dirPath, fsSync.constants.F_OK);
    
    // Check read permission
    try {
      await fs.access(dirPath, fsSync.constants.R_OK);
    } catch (error) {
      return {
        accessible: false,
        error: EMAIL_ERROR_CODES.FILE_PERMISSION_ERROR,
        message: `No read permission for directory: ${dirPath}`,
        canCreate: false
      };
    }
    
    // Check write permission
    try {
      await fs.access(dirPath, fsSync.constants.W_OK);
    } catch (error) {
      return {
        accessible: true,
        error: EMAIL_ERROR_CODES.FILE_PERMISSION_ERROR,
        message: `No write permission for directory: ${dirPath}`,
        canCreate: false,
        readOnly: true
      };
    }
    
    return {
      accessible: true,
      canCreate: true,
      readOnly: false
    };
  } catch (error) {
    // Directory doesn't exist
    return {
      accessible: false,
      exists: false,
      canCreate: true
    };
  }
}

/**
 * Initializes email storage system with inbox directory
 * @param {string} customInboxPath - Optional custom inbox path
 * @returns {Promise<Object>} Initialization result with success flag and path
 */
export async function initializeEmailStorage(customInboxPath = null) {
  try {
    // Set inbox path - use game data directory for email storage
    // Use cross-platform path construction
    const gameDataDir = getGameDataDirectory();
    inboxPath = customInboxPath || joinPaths(gameDataDir, 'emails');
    
    console.log('[EMAIL] Initializing email storage', { inboxPath });

    // Validate inbox path
    if (!inboxPath || typeof inboxPath !== 'string') {
      const error = {
        success: false,
        error: EMAIL_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid inbox path provided',
        userMessage: 'Email system configuration error. Please restart the application.'
      };
      console.error('[EMAIL] Invalid inbox path', error);
      return error;
    }

    // Validate path characters for Windows compatibility
    const pathValidation = validatePathCharacters(inboxPath);
    if (!pathValidation.isValid) {
      const error = {
        success: false,
        error: EMAIL_ERROR_CODES.VALIDATION_ERROR,
        message: `Invalid inbox path: ${pathValidation.errors.join(', ')}`,
        userMessage: 'Email inbox path contains invalid characters.',
        validationErrors: pathValidation.errors
      };
      console.error('[EMAIL] Invalid inbox path characters', error);
      return error;
    }

    // Normalize path for consistent handling across platforms
    inboxPath = normalizePath(inboxPath);

    // Check directory access
    const accessCheck = await checkDirectoryAccess(inboxPath);
    
    if (!accessCheck.accessible && !accessCheck.canCreate) {
      const error = {
        success: false,
        error: EMAIL_ERROR_CODES.INBOX_INACCESSIBLE,
        message: accessCheck.message || `Inbox directory is inaccessible: ${inboxPath}`,
        userMessage: `Cannot access email inbox at: ${inboxPath}\n\nPlease check directory permissions.`,
        inboxPath
      };
      console.error('[EMAIL] Inbox directory inaccessible', error);
      return error;
    }

    // Create inbox directory if it doesn't exist
    if (!accessCheck.accessible && accessCheck.canCreate) {
      try {
        console.log('[EMAIL] Creating inbox directory', { inboxPath });
        await fs.mkdir(inboxPath, { recursive: true });
        
        // Verify creation was successful
        const verifyAccess = await checkDirectoryAccess(inboxPath);
        if (!verifyAccess.accessible) {
          throw new Error('Directory created but not accessible');
        }
        isReadOnly = verifyAccess.readOnly || false;
      } catch (error) {
        const errorResponse = {
          success: false,
          error: EMAIL_ERROR_CODES.INBOX_CREATION_FAILED,
          message: `Failed to create inbox directory: ${error.message}`,
          userMessage: `Could not create email inbox at: ${inboxPath}\n\nError: ${error.message}`,
          inboxPath,
          originalError: error.message
        };
        console.error('[EMAIL] Failed to create inbox directory', errorResponse);
        return errorResponse;
      }
    } else {
      isReadOnly = accessCheck.readOnly || false;
    }

    // Warn if directory is read-only
    if (isReadOnly) {
      console.warn('[EMAIL] Inbox directory is read-only', {
        inboxPath,
        message: 'Emails cannot be marked as read'
      });
    }

    // Load existing emails into cache
    try {
      await loadEmailsIntoCache();
    } catch (error) {
      console.warn('[EMAIL] Failed to load some emails into cache', {
        error: error.message,
        inboxPath
      });
      // Continue initialization even if some emails fail to load
    }

    console.log('[EMAIL] Email storage initialized', { 
      inboxPath, 
      emailCount: emailCache.size,
      readOnly: isReadOnly
    });

    return {
      success: true,
      inboxPath,
      emailCount: emailCache.size,
      readOnly: isReadOnly
    };
  } catch (error) {
    const errorResponse = {
      success: false,
      error: EMAIL_ERROR_CODES.INBOX_INACCESSIBLE,
      message: `Email storage initialization failed: ${error.message}`,
      userMessage: `Failed to initialize email system.\n\nError: ${error.message}`,
      inboxPath,
      originalError: error.message
    };
    console.error('[EMAIL] Failed to initialize email storage', errorResponse);
    return errorResponse;
  }
}

/**
 * Loads all email JSON files from inbox directory into cache
 * @private
 */
async function loadEmailsIntoCache() {
  if (!inboxPath) {
    console.error('[EMAIL] Cannot load emails - inbox not initialized');
    throw new Error('Inbox not initialized');
  }

  try {
    const files = await fs.readdir(inboxPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    console.log('[EMAIL] Loading emails into cache', { 
      fileCount: jsonFiles.length 
    });

    let loadedCount = 0;
    let failedCount = 0;

    for (const file of jsonFiles) {
      const filePath = joinPaths(inboxPath, file);
      try {
        await loadEmailFile(filePath);
        loadedCount++;
      } catch (error) {
        failedCount++;
        console.warn('[EMAIL] Failed to load email file', {
          file,
          error: error.message
        });
        // Continue loading other files
      }
    }

    console.log('[EMAIL] Emails loaded into cache', { 
      total: jsonFiles.length,
      loaded: loadedCount,
      failed: failedCount,
      emailCount: emailCache.size 
    });
  } catch (error) {
    console.error('[EMAIL] Failed to read inbox directory', {
      error: error.message,
      inboxPath
    });
    throw error;
  }
}

/**
 * Checks if a file is readable
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file is readable
 */
async function isFileReadable(filePath) {
  try {
    await fs.access(filePath, fsSync.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Loads a single email file and adds it to cache
 * @param {string} filePath - Path to email JSON file
 * @private
 */
async function loadEmailFile(filePath) {
  try {
    // Check file permissions before reading
    const readable = await isFileReadable(filePath);
    if (!readable) {
      console.warn('[EMAIL] File is not readable, skipping', {
        filePath,
        error: EMAIL_ERROR_CODES.FILE_PERMISSION_ERROR
      });
      return;
    }

    // Read file content
    let fileContent;
    try {
      fileContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      console.error('[EMAIL] Failed to read email file', {
        filePath,
        error: error.message,
        errorCode: EMAIL_ERROR_CODES.FILE_READ_ERROR
      });
      return;
    }

    // Parse JSON
    let emailData;
    try {
      emailData = JSON.parse(fileContent);
    } catch (error) {
      console.warn('[EMAIL] Malformed JSON file, skipping', {
        filePath,
        error: error.message,
        errorCode: EMAIL_ERROR_CODES.INVALID_JSON,
        userMessage: `Email file ${path.basename(filePath)} contains invalid JSON and will be skipped`
      });
      return;
    }

    // Validate email JSON
    const validation = validateEmailJson(emailData);
    
    if (!validation.isValid) {
      console.warn('[EMAIL] Invalid email JSON file, skipping', {
        filePath,
        errors: validation.errors,
        errorCode: EMAIL_ERROR_CODES.VALIDATION_ERROR,
        userMessage: `Email file ${path.basename(filePath)} is invalid and will be skipped`
      });
      
      // Trigger validation failed callback
      triggerEmailValidationFailed(filePath, validation);
      
      return;
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.log('[EMAIL] Email validation warnings', {
        filePath,
        warnings: validation.warnings
      });
    }

    // Load HTML file if bodyType is "html-file"
    if (emailData.bodyType === 'html-file' && emailData.bodyFile) {
      try {
        const projectRoot = path.resolve(process.cwd());
        const templatesDir = path.join(projectRoot, 'game-data', 'emails', 'templates');
        
        // Ensure templates directory exists
        await ensureTemplatesDirectory(templatesDir);
        
        // Load HTML file
        const htmlResult = await loadHtmlFile(emailData.bodyFile, projectRoot, templatesDir);
        
        if (htmlResult.success) {
          // Store HTML content in a separate field
          emailData._htmlContent = htmlResult.content;
          emailData._htmlFilePath = htmlResult.filePath;
          
          console.log('[EMAIL] HTML file loaded successfully', {
            emailId: emailData.id,
            bodyFile: emailData.bodyFile,
            htmlFilePath: htmlResult.filePath
          });
        } else {
          // Store error information
          emailData._htmlLoadError = htmlResult.error;
          emailData._htmlErrorMessage = htmlResult.userMessage;
          
          console.warn('[EMAIL] Failed to load HTML file', {
            emailId: emailData.id,
            bodyFile: emailData.bodyFile,
            error: htmlResult.error,
            userMessage: htmlResult.userMessage
          });
        }
      } catch (error) {
        // Store error information for unexpected errors
        emailData._htmlLoadError = error.message;
        emailData._htmlErrorMessage = `Failed to load HTML file: ${error.message}`;
        
        console.error('[EMAIL] Unexpected error loading HTML file', {
          emailId: emailData.id,
          bodyFile: emailData.bodyFile,
          error: error.message
        });
      }
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

    // Trigger email received callback
    triggerEmailReceived(emailData);
  } catch (error) {
    console.error('[EMAIL] Unexpected error loading email file', {
      filePath,
      error: error.message,
      stack: error.stack
    });
    throw error;
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
    // Validate parameters
    if (typeof limit !== 'number' || limit < 0) {
      console.warn('[EMAIL] Invalid limit parameter, using default', { limit });
      limit = 50;
    }
    
    if (typeof offset !== 'number' || offset < 0) {
      console.warn('[EMAIL] Invalid offset parameter, using default', { offset });
      offset = 0;
    }

    // Convert cache to array and sort by timestamp descending
    const emails = Array.from(emailCache.values())
      .sort((a, b) => {
        try {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return dateB - dateA; // Descending order
        } catch (error) {
          console.warn('[EMAIL] Error sorting emails by timestamp', {
            emailA: a.id,
            emailB: b.id,
            error: error.message
          });
          return 0;
        }
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
 * Formats an HTML load error as styled HTML for display in email body
 * @param {string} error - Technical error message
 * @param {string} bodyFile - Path to the HTML file that failed to load
 * @returns {string} Formatted HTML error message
 * @private
 */
function formatHtmlLoadError(error, bodyFile) {
  return `
    <div style="padding: 20px; background-color: #2d2d2d; border-left: 4px solid #ff6b6b; color: #e0e0e0;">
      <h3 style="color: #ff6b6b; margin-bottom: 12px;">⚠️ Failed to Load Email Template</h3>
      <p style="margin-bottom: 8px;">The email template file could not be loaded.</p>
      <p style="margin-bottom: 8px;"><strong>File:</strong> <code style="background-color: #1e1e1e; padding: 2px 6px; border-radius: 3px;">${bodyFile}</code></p>
      <p style="margin-bottom: 0;"><strong>Error:</strong> ${error}</p>
    </div>
  `;
}

/**
 * Gets a single email by ID
 * @param {string} emailId - Email ID to retrieve
 * @returns {Promise<Object|null>} Email object or null if not found
 */
export async function getEmailById(emailId) {
  try {
    // Validate email ID
    if (!emailId || typeof emailId !== 'string') {
      console.warn('[EMAIL] Invalid email ID provided', { emailId });
      return null;
    }

    const email = emailCache.get(emailId);
    
    if (!email) {
      console.log('[EMAIL] Email not found', { 
        emailId,
        errorCode: EMAIL_ERROR_CODES.EMAIL_NOT_FOUND
      });
      return null;
    }

    // Create a copy to avoid modifying the cached email
    const emailData = { ...email };
    
    // Replace body with HTML content if available
    if (emailData._htmlContent) {
      emailData.body = emailData._htmlContent;
      emailData.bodyType = 'html'; // Treat as HTML for rendering
    } else if (emailData._htmlLoadError) {
      // Replace body with formatted error message
      emailData.body = formatHtmlLoadError(emailData._htmlLoadError, emailData.bodyFile);
      emailData.bodyType = 'html'; // Render error as HTML
    }
    
    // Remove internal fields before returning
    delete emailData._htmlContent;
    delete emailData._htmlFilePath;
    delete emailData._htmlLoadError;
    delete emailData._htmlErrorMessage;
    delete emailData._filePath;
    delete emailData._fileName;

    console.log('[EMAIL] Retrieved email', {
      emailId,
      subject: emailData.subject
    });

    return emailData;
  } catch (error) {
    console.error('[EMAIL] Failed to get email by ID', {
      emailId,
      error: error.message
    });
    return null;
  }
}

/**
 * Writes file with retry logic and exponential backoff for Windows file locking
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<void>}
 * @private
 */
async function writeFileWithRetry(filePath, content, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return; // Success
    } catch (error) {
      lastError = error;
      
      // Check if error is due to file locking (common on Windows)
      const isLockError = error.code === 'EBUSY' || 
                          error.code === 'EPERM' || 
                          error.code === 'EACCES';
      
      if (isLockError && attempt < maxRetries - 1) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempt);
        console.log('[EMAIL] File locked, retrying write', {
          filePath,
          attempt: attempt + 1,
          maxRetries,
          delayMs: delay,
          errorCode: error.code
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Not a lock error or max retries reached
        throw error;
      }
    }
  }
  
  // All retries failed
  throw lastError;
}

/**
 * Marks an email as read and updates the JSON file
 * @param {string} emailId - Email ID to mark as read
 * @returns {Promise<Object>} Result with success flag
 */
export async function markEmailAsRead(emailId) {
  try {
    // Validate email ID
    if (!emailId || typeof emailId !== 'string') {
      return {
        success: false,
        error: EMAIL_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid email ID provided'
      };
    }

    // Check if inbox is read-only
    if (isReadOnly) {
      console.warn('[EMAIL] Cannot mark email as read - inbox is read-only', { emailId });
      return {
        success: false,
        error: EMAIL_ERROR_CODES.FILE_PERMISSION_ERROR,
        message: 'Inbox directory is read-only',
        userMessage: 'Cannot mark email as read due to insufficient permissions'
      };
    }

    const email = emailCache.get(emailId);
    
    if (!email) {
      console.warn('[EMAIL] Cannot mark email as read - not found', { 
        emailId,
        errorCode: EMAIL_ERROR_CODES.EMAIL_NOT_FOUND
      });
      return {
        success: false,
        error: EMAIL_ERROR_CODES.EMAIL_NOT_FOUND,
        message: 'Email not found'
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

    try {
      // Check write permission before attempting
      try {
        await fs.access(filePath, fsSync.constants.W_OK);
      } catch (error) {
        throw new Error(`No write permission for file: ${filePath}`);
      }

      // Write file with retry logic for Windows file locking
      await writeFileWithRetry(filePath, JSON.stringify(emailDataToSave, null, 2));
    } catch (error) {
      // Revert in-memory change if file write fails
      email.isRead = false;
      
      console.error('[EMAIL] Failed to update email file', {
        emailId,
        filePath,
        error: error.message,
        errorCode: EMAIL_ERROR_CODES.FILE_WRITE_ERROR
      });
      
      return {
        success: false,
        error: EMAIL_ERROR_CODES.FILE_WRITE_ERROR,
        message: `Failed to update email file: ${error.message}`,
        userMessage: 'Could not mark email as read. Please check file permissions.'
      };
    }

    console.log('[EMAIL] Email marked as read', {
      emailId,
      subject: email.subject
    });

    // Trigger email read callback
    triggerEmailRead(emailId, { subject: email.subject });

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
      error: EMAIL_ERROR_CODES.FILE_WRITE_ERROR,
      message: error.message,
      userMessage: 'An error occurred while marking email as read'
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
      console.error('[EMAIL] Cannot watch inbox - not initialized', {
        errorCode: EMAIL_ERROR_CODES.INBOX_NOT_INITIALIZED
      });
      return {
        success: false,
        error: EMAIL_ERROR_CODES.INBOX_NOT_INITIALIZED,
        message: 'Email storage not initialized'
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

    // Create a promise that resolves when watcher is ready
    watcherReadyPromise = new Promise((resolve) => {
      // Initialize chokidar watcher with cross-platform configuration
      try {
        // Watch the directory instead of glob pattern for better compatibility
        watcher = chokidar.watch(inboxPath, {
          persistent: true,
          ignoreInitial: true, // Don't trigger for existing files
          ignored: /(^|[\/\\])\../, // Ignore dotfiles
          awaitWriteFinish: {
            stabilityThreshold: 100, // Wait 100ms for file to stabilize
            pollInterval: 50 // Poll every 50ms
          },
          depth: 0, // Don't watch subdirectories
          // Cross-platform optimizations
          usePolling: false, // Use native fs.watch (more efficient)
          alwaysStat: true, // Stat files to ensure they're complete
          atomic: true, // Handle atomic writes
          disableGlobbing: true // Disable globbing since we're watching a directory
        });
        
        // Resolve the promise when watcher is ready
        watcher.on('ready', () => {
          watcherReady = true;
          console.log('[EMAIL] Inbox directory watcher ready and monitoring', { 
            inboxPath,
            watchedPaths: watcher.getWatched()
          });
          resolve();
        });
      } catch (error) {
        console.error('[EMAIL] Failed to create file watcher', {
          error: error.message,
          errorCode: EMAIL_ERROR_CODES.WATCHER_ERROR
        });
        resolve(); // Resolve anyway to not block
        return {
          success: false,
          error: EMAIL_ERROR_CODES.WATCHER_ERROR,
          message: `Failed to create file watcher: ${error.message}`
        };
      }
    });

    // Handle new email files
    watcher.on('add', async (filePath) => {
      // Only process .json files
      if (!filePath.endsWith('.json')) {
        console.log('[EMAIL] Ignoring non-JSON file', { filePath });
        return;
      }
      
      console.log('[EMAIL] New email file detected', { filePath });
      console.log('[EMAIL] Current cache size before add:', emailCache.size);
      
      try {
        await loadEmailFile(filePath);
        
        const fileName = path.basename(filePath);
        console.log('[EMAIL] Email file loaded successfully', { fileName, cacheSize: emailCache.size });
        
        // Trigger inbox changed callback
        triggerInboxChanged('add', fileName);
        console.log('[EMAIL] Triggered inbox changed callback');
        
        if (watcherCallback) {
          console.log('[EMAIL] Calling watcher callback');
          watcherCallback('add', fileName);
        } else {
          console.warn('[EMAIL] No watcher callback registered');
        }
      } catch (error) {
        console.error('[EMAIL] Error processing new email file', {
          filePath,
          error: error.message,
          stack: error.stack
        });
      }
    });

    // Handle modified email files
    watcher.on('change', async (filePath) => {
      // Only process .json files
      if (!filePath.endsWith('.json')) {
        return;
      }
      
      console.log('[EMAIL] Email file modified', { filePath });
      try {
        await loadEmailFile(filePath);
        
        const fileName = path.basename(filePath);
        
        // Trigger inbox changed callback
        triggerInboxChanged('change', fileName);
        
        if (watcherCallback) {
          watcherCallback('change', fileName);
        }
      } catch (error) {
        console.error('[EMAIL] Error processing modified email file', {
          filePath,
          error: error.message
        });
      }
    });

    // Handle deleted email files
    watcher.on('unlink', (filePath) => {
      // Only process .json files
      if (!filePath.endsWith('.json')) {
        return;
      }
      
      console.log('[EMAIL] Email file deleted', { filePath });
      
      try {
        // Remove from cache
        for (const [emailId, email] of emailCache.entries()) {
          if (email._filePath === filePath) {
            emailCache.delete(emailId);
            console.log('[EMAIL] Email removed from cache', { emailId });
            break;
          }
        }
        
        const fileName = path.basename(filePath);
        
        // Trigger inbox changed callback
        triggerInboxChanged('unlink', fileName);
        
        if (watcherCallback) {
          watcherCallback('unlink', fileName);
        }
      } catch (error) {
        console.error('[EMAIL] Error processing deleted email file', {
          filePath,
          error: error.message
        });
      }
    });

    // Handle watcher errors
    watcher.on('error', (error) => {
      console.error('[EMAIL] Inbox watcher error', {
        error: error.message,
        stack: error.stack,
        errorCode: EMAIL_ERROR_CODES.WATCHER_ERROR,
        userMessage: 'Email monitoring encountered an error. New emails may not appear automatically.'
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
      inboxPath,
      errorCode: EMAIL_ERROR_CODES.WATCHER_ERROR
    });
    
    return {
      success: false,
      error: EMAIL_ERROR_CODES.WATCHER_ERROR,
      message: error.message,
      userMessage: 'Failed to start email monitoring. New emails may not appear automatically.'
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
 * Cleans up old incorrect directories from previous versions
 * Removes game-data/test-dir and project-root/inbox directories
 * Logs errors but does not throw to allow application to continue
 * @returns {void}
 */
export function cleanupOldDirectories() {
  const projectRoot = process.cwd();
  const oldInboxPath = path.join(projectRoot, 'inbox');
  const oldTestDirPath = path.join(projectRoot, 'game-data', 'test-dir');
  
  // Remove old inbox directory
  if (fsSync.existsSync(oldInboxPath)) {
    try {
      fsSync.rmSync(oldInboxPath, { recursive: true, force: true });
      console.log('[CLEANUP] Removed old inbox directory');
    } catch (error) {
      console.error('[CLEANUP] Failed to remove old inbox directory:', error);
    }
  }
  
  // Remove old test-dir directory
  if (fsSync.existsSync(oldTestDirPath)) {
    try {
      fsSync.rmSync(oldTestDirPath, { recursive: true, force: true });
      console.log('[CLEANUP] Removed old test-dir directory');
    } catch (error) {
      console.error('[CLEANUP] Failed to remove old test-dir directory:', error);
    }
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
 * Waits for the inbox watcher to be ready
 * @returns {Promise<void>} Promise that resolves when watcher is ready
 */
export async function waitForWatcherReady() {
  if (watcherReady) {
    console.log('[EMAIL] Watcher already ready');
    return;
  }
  
  if (watcherReadyPromise) {
    console.log('[EMAIL] Waiting for watcher to be ready...');
    await watcherReadyPromise;
    console.log('[EMAIL] Watcher is now ready');
  } else {
    console.warn('[EMAIL] No watcher initialized, cannot wait for ready state');
  }
}

/**
 * Gets the current email cache size
 * @returns {number} Number of emails in cache
 */
export function getCacheSize() {
  return emailCache.size;
}

/**
 * Gets read-only status of inbox
 * @returns {boolean} True if inbox is read-only
 */
export function isInboxReadOnly() {
  return isReadOnly;
}

/**
 * Clears the email cache (for testing purposes)
 * @returns {void}
 */
export function clearCache() {
  emailCache.clear();
  console.log('[EMAIL] Email cache cleared');
}
