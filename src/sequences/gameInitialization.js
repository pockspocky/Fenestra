/**
 * Game Initialization Sequence Module
 * 
 * This module handles the configurable email-based game initialization sequence
 * that runs when a new game is started. It orchestrates timing, email client control,
 * and email delivery to provide a clean game opening experience.
 * 
 * Requirements: 1.1, 1.2
 */

import fs from 'fs';
import path from 'path';
import electron from 'electron';
import { getGameDataDirectory, getConfig } from '../core/config.js';

const { dialog } = electron;

// Default configuration values
const DEFAULT_INITIAL_DELAY = 2000;
const DEFAULT_EMAIL_DELAY = 1000;
const DEFAULT_INITIAL_EMAIL_FILE = 'welcome.json';

/**
 * Non-blocking delay utility for sequence timing
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after specified time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates that an email object contains all required fields
 * 
 * @param {Object} emailData - Parsed email JSON object
 * @returns {Object} Validation result with valid flag and list of missing fields
 * @returns {boolean} returns.valid - True if all required fields present
 * @returns {string[]} returns.missingFields - Array of missing field names
 */
function validateEmailStructure(emailData) {
  const requiredFields = [
    'id',
    'senderName',
    'senderEmail',
    'subject',
    'timestamp',
    'isRead'
  ];

  const missingFields = requiredFields.filter(field => emailData[field] === undefined);

  // Check for body or bodyFile - at least one must be present
  if (!emailData.body && !emailData.bodyFile) {
    missingFields.push('body or bodyFile');
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Reads and validates game initialization configuration
 * 
 * Extracts initialDelay, emailDelay, and initialEmailFile from the
 * gameInitialization section of .fenestra-config.json. Uses default
 * values for missing or invalid configuration.
 * 
 * @returns {Object} Configuration object with validated values
 * @returns {number} returns.initialDelay - Delay before opening email client (ms)
 * @returns {number} returns.emailDelay - Delay before sending email (ms)
 * @returns {string} returns.initialEmailFile - Email filename to send
 * 
 * Requirements: 3.4, 3.5, 3.6
 */
function readInitializationConfig() {
  try {
    const config = getConfig();
    const initConfig = config.gameInitialization || {};
    
    // Extract and validate initialDelay
    let initialDelay = DEFAULT_INITIAL_DELAY;
    if (typeof initConfig.initialDelay === 'number' && initConfig.initialDelay >= 0) {
      initialDelay = initConfig.initialDelay;
    } else if (initConfig.initialDelay !== undefined) {
      console.warn('[GAME_INIT] Invalid initialDelay value, using default:', DEFAULT_INITIAL_DELAY);
    }
    
    // Extract and validate emailDelay
    let emailDelay = DEFAULT_EMAIL_DELAY;
    if (typeof initConfig.emailDelay === 'number' && initConfig.emailDelay >= 0) {
      emailDelay = initConfig.emailDelay;
    } else if (initConfig.emailDelay !== undefined) {
      console.warn('[GAME_INIT] Invalid emailDelay value, using default:', DEFAULT_EMAIL_DELAY);
    }
    
    // Extract and validate initialEmailFile
    let initialEmailFile = DEFAULT_INITIAL_EMAIL_FILE;
    if (typeof initConfig.initialEmailFile === 'string' && initConfig.initialEmailFile.length > 0) {
      initialEmailFile = initConfig.initialEmailFile;
    } else if (initConfig.initialEmailFile !== undefined) {
      console.warn('[GAME_INIT] Invalid initialEmailFile value, using default:', DEFAULT_INITIAL_EMAIL_FILE);
    }
    
    return {
      initialDelay,
      emailDelay,
      initialEmailFile
    };
    
  } catch (error) {
    console.error('[GAME_INIT] Failed to read configuration, using defaults:', {
      operation: 'readInitializationConfig',
      error: error.message,
      stack: error.stack,
      impact: 'using default configuration values'
    });
    return {
      initialDelay: DEFAULT_INITIAL_DELAY,
      emailDelay: DEFAULT_EMAIL_DELAY,
      initialEmailFile: DEFAULT_INITIAL_EMAIL_FILE
    };
  }
}

/**
 * Copies an email file from the pending directory to the active directory
 * 
 * @param {string} emailFileName - Name of the email JSON file (e.g., "welcome.json")
 * @returns {Promise<Object>} Result object with success flag and message
 * @returns {boolean} returns.success - True if email was sent successfully
 * @returns {string} returns.message - Success or error message
 * @returns {string} [returns.error] - Error details if operation failed
 * 
 * Requirements: 5.3, 5.4, 6.2, 6.3, 6.4
 */
async function sendInitialEmail(emailFileName) {
  try {
    // Construct source path using path.join for cross-platform compatibility
    const sourcePath = path.join(process.cwd(), 'emailsPending', emailFileName);
    
    // Construct destination path using getGameDataDirectory
    const destPath = path.join(getGameDataDirectory(), 'emails', emailFileName);
    
    // Check if file exists before attempting to read
    if (!fs.existsSync(sourcePath)) {
      const errorMsg = `Email file not found: ${emailFileName}`;
      console.error('[GAME_INIT] Email file not found:', {
        operation: 'sendInitialEmail',
        emailFile: emailFileName,
        sourcePath: sourcePath,
        error: errorMsg,
        impact: 'continuing without sending email'
      });
      
      // Show user dialog for file not found error (if dialog is available)
      if (dialog && dialog.showMessageBox) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Email File Missing',
          message: 'Could not find initial email',
          detail: `The file "${emailFileName}" was not found in emailsPending/. The game will continue without sending the initial email.`,
          buttons: ['OK']
        });
      }
      
      return { success: false, message: errorMsg, error: errorMsg };
    }
    
    // Read email file from source path
    const fileContent = await fs.promises.readFile(sourcePath, 'utf8');
    
    // Parse JSON content with try-catch for parse errors
    let emailData;
    try {
      emailData = JSON.parse(fileContent);
    } catch (parseError) {
      const errorMsg = `Invalid JSON in email file: ${emailFileName}`;
      console.error('[GAME_INIT] JSON parse error:', {
        operation: 'sendInitialEmail',
        emailFile: emailFileName,
        sourcePath: sourcePath,
        error: parseError.message,
        stack: parseError.stack,
        impact: 'continuing without sending email'
      });
      
      // Show user dialog for JSON parse error (if dialog is available)
      if (dialog && dialog.showMessageBox) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Email File Invalid',
          message: 'Could not parse initial email',
          detail: `The file "${emailFileName}" contains invalid JSON. The game will continue without sending the initial email.`,
          buttons: ['OK']
        });
      }
      
      return { success: false, message: errorMsg, error: parseError.message };
    }
    
    // Validate email structure
    const validation = validateEmailStructure(emailData);
    if (!validation.valid) {
      const errorMsg = `Email file missing required fields: ${validation.missingFields.join(', ')}`;
      console.error('[GAME_INIT] Email validation failed:', {
        operation: 'sendInitialEmail',
        emailFile: emailFileName,
        sourcePath: sourcePath,
        missingFields: validation.missingFields,
        error: errorMsg,
        impact: 'continuing without sending email'
      });
      
      // Show user dialog for validation failure (if dialog is available)
      if (dialog && dialog.showMessageBox) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Email File Incomplete',
          message: 'Initial email is missing required fields',
          detail: `The file "${emailFileName}" is missing: ${validation.missingFields.join(', ')}. The game will continue without sending the initial email.`,
          buttons: ['OK']
        });
      }
      
      return { success: false, message: errorMsg, error: errorMsg };
    }
    
    // Create destination directory if needed
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true });
    
    console.log('[GAME_INIT] Copying email file', { 
      from: sourcePath, 
      to: destPath,
      timestamp: new Date().toISOString()
    });
    
    // Copy file to destination
    await fs.promises.copyFile(sourcePath, destPath);
    
    console.log('[GAME_INIT] Email file copied successfully', {
      destPath,
      timestamp: new Date().toISOString()
    });
    
    // Verify the file exists and is readable
    try {
      const stats = await fs.promises.stat(destPath);
      console.log('[GAME_INIT] Email file verified', {
        size: stats.size,
        modified: stats.mtime.toISOString()
      });
    } catch (verifyError) {
      console.warn('[GAME_INIT] Could not verify copied file', {
        error: verifyError.message
      });
    }
    
    console.log('[GAME_INIT] Email sent successfully:', emailFileName);
    return { success: true, message: 'Email sent successfully' };
    
  } catch (error) {
    console.error('[GAME_INIT] Failed to send initial email:', {
      operation: 'sendInitialEmail',
      emailFile: emailFileName,
      sourcePath: path.join(process.cwd(), 'emailsPending', emailFileName),
      destPath: path.join(getGameDataDirectory(), 'emails', emailFileName),
      error: error.message,
      stack: error.stack,
      impact: 'continuing without sending email'
    });
    
    // Show user dialog for file copy error or other unexpected errors (if dialog is available)
    if (dialog && dialog.showMessageBox) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Email Send Failed',
        message: 'Could not send initial email',
        detail: 'An unexpected error occurred while copying the email file. The game will continue normally.',
        buttons: ['OK']
      });
    }
    
    return { success: false, message: 'Failed to send initial email', error: error.message };
  }
}

/**
 * Orchestrates the complete initialization sequence with timing and email client control
 * 
 * This is the main entry point for the game initialization sequence. It:
 * 1. Reads configuration from .fenestra-config.json
 * 2. Waits for the configured initial delay
 * 3. Opens the email client if not already open
 * 4. Waits for the configured email delay
 * 5. Sends the configured initial email
 * 
 * @returns {Promise<Object>} Result object with success flag and message
 * @returns {boolean} returns.success - True if sequence completed successfully
 * @returns {string} returns.message - Success or error message
 * @returns {string} [returns.error] - Error details if operation failed
 * 
 * Requirements: 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 8.1, 8.2
 */
async function runInitializationSequence() {
  try {
    console.log('[GAME_INIT] Starting initialization sequence');
    
    // Read configuration
    const config = readInitializationConfig();
    console.log('[GAME_INIT] Configuration loaded:', config);
    
    // Wait for initial delay before opening email client
    console.log(`[GAME_INIT] Waiting ${config.initialDelay}ms before opening email client...`);
    await delay(config.initialDelay);
    
    // Import email system functions dynamically
    const { getEmailWindow, toggleEmailWindow } = await import('../systems/emailSystem.js');
    
    // Check if email window is open
    const emailWindow = getEmailWindow();
    const isWindowOpen = emailWindow && !emailWindow.isDestroyed();
    
    if (!isWindowOpen) {
      console.log('[GAME_INIT] Email client not open, opening now...');
      try {
        const result = toggleEmailWindow();
        if (result.success) {
          console.log('[GAME_INIT] Email client opened successfully');
        } else {
          console.warn('[GAME_INIT] Email client failed to open:', result.error);
          
          // Show user dialog for email client error (if dialog is available)
          if (dialog && dialog.showMessageBox) {
            dialog.showMessageBox({
              type: 'warning',
              title: 'Email Client Error',
              message: 'Could not open email client',
              detail: 'The initialization sequence will continue, but the email client may not be available.',
              buttons: ['OK']
            });
          }
          // Continue anyway - don't block game startup
        }
      } catch (error) {
        console.error('[GAME_INIT] Error opening email client:', {
          operation: 'toggleEmailWindow',
          error: error.message,
          stack: error.stack,
          impact: 'continuing without email client'
        });
        // Continue silently - don't block game startup
      }
    } else {
      console.log('[GAME_INIT] Email client already open, skipping toggle');
    }
    
    // Wait for email delay before sending email
    console.log(`[GAME_INIT] Waiting ${config.emailDelay}ms before sending email...`);
    await delay(config.emailDelay);
    
    // Wait for email watcher to be ready before sending email
    console.log('[GAME_INIT] Ensuring email watcher is ready...');
    try {
      const { waitForWatcherReady } = await import('../storage/emailStorage.js');
      await waitForWatcherReady();
      console.log('[GAME_INIT] Email watcher confirmed ready');
    } catch (error) {
      console.warn('[GAME_INIT] Could not wait for watcher ready:', error.message);
      // Continue anyway - watcher might not be initialized
    }
    
    // Send initial email
    console.log(`[GAME_INIT] Sending initial email: ${config.initialEmailFile}`);
    const emailResult = await sendInitialEmail(config.initialEmailFile);
    
    if (emailResult.success) {
      console.log('[GAME_INIT] Initialization sequence completed successfully');
      return { success: true, message: 'Initialization sequence completed successfully' };
    } else {
      console.warn('[GAME_INIT] Initialization sequence completed with email send failure');
      return { 
        success: true, // Still return success since we don't want to block game startup
        message: 'Initialization sequence completed but email send failed',
        error: emailResult.error
      };
    }
    
  } catch (error) {
    console.error('[GAME_INIT] Initialization sequence failed:', {
      operation: 'runInitializationSequence',
      error: error.message,
      stack: error.stack,
      impact: 'returning failure result'
    });
    
    // Show user dialog for unexpected errors (if dialog is available)
    if (dialog && dialog.showMessageBox) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Initialization Error',
        message: 'Game initialization encountered an error',
        detail: 'The game will continue, but some initialization steps may not have completed.',
        buttons: ['OK']
      });
    }
    
    return { 
      success: false, 
      message: 'Initialization sequence failed', 
      error: error.message 
    };
  }
}

// Export public functions
export { delay, validateEmailStructure, sendInitialEmail, readInitializationConfig, runInitializationSequence };
