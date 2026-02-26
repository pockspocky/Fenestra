/**
 * Email System Manager
 * Manages email window lifecycle, global hotkey, and email system initialization
 */

import { globalShortcut } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import '../../logger.js';
import { createWindow } from './windowManager.js';
import { 
  initializeEmailStorage, 
  watchInboxDirectory, 
  stopWatching,
  getInboxPath 
} from '../storage/emailStorage.js';
import { memoryManager } from '../utils/memoryManager.js';
import { securityAuditSystem } from '../security/auditSystem.js';
import { emailSandbox } from '../security/emailSandbox.js';
import { emailSchemaValidator } from '../security/emailSchemaValidator.js';

// Email window reference
let emailWindow = null;

// Track if cleanup has been performed
let cleanupPerformed = false;

// Platform detection
const isMac = process.platform === 'darwin';

// Email hotkey configuration
const EMAIL_HOTKEY = isMac ? 'Command+E' : 'Control+E';

/**
 * Initializes the email system
 * Sets up email storage, inbox monitoring, and global hotkey
 * @param {Object} options - Initialization options
 * @param {string} options.inboxPath - Custom inbox path (optional)
 * @returns {Promise<Object>} Initialization result with success flag
 */
export async function initializeEmailSystem(options = {}) {
  try {
    console.log('[EMAIL_SYSTEM] Initializing email system...');

    // Register memory cleanup for email system
    memoryManager.registerCleanupHandler('emailSystem', () => {
      console.log('[EMAIL_SYSTEM] Cleaning up email system resources');
      cleanupEmailSystem();
    });

    // Email sandbox is already initialized as a singleton, no need to call initialize()
    console.log('[EMAIL_SYSTEM] Email sandbox ready');

    // Initialize email storage
    const storageResult = await initializeEmailStorage(options.inboxPath);
    
    if (!storageResult.success) {
      console.error('[EMAIL_SYSTEM] Failed to initialize email storage', {
        error: storageResult.error
      });
      
      // Log security event
      securityAuditSystem.logSecurityEvent('email_system', 'high', {
        component: 'EmailSystem',
        function: 'initializeEmailSystem',
        violationType: 'storage_initialization_failed',
        mitigationAction: 'system_initialization_aborted',
        inputData: storageResult.error
      });
      
      return {
        success: false,
        error: `Email storage initialization failed: ${storageResult.error}`
      };
    }

    console.log('[EMAIL_SYSTEM] Email storage initialized', {
      inboxPath: storageResult.inboxPath,
      emailCount: storageResult.emailCount
    });

    // Start watching inbox directory
    const watchResult = watchInboxDirectory((event, fileName) => {
      console.log('[EMAIL_SYSTEM] Inbox file event received', { event, fileName });
      
      // Validate email file if it's a new email
      if (event === 'add' && fileName.endsWith('.json')) {
        console.log('[EMAIL_SYSTEM] Validating new email file', { fileName });
        validateInboxEmail(fileName);
      }
      
      // Notify email window if it's open
      if (emailWindow && !emailWindow.isDestroyed()) {
        console.log('[EMAIL_SYSTEM] Sending email-inbox-update to renderer', { event, fileName });
        emailWindow.webContents.send('email-inbox-update', { event, fileName });
        console.log('[EMAIL_SYSTEM] IPC message sent successfully');
      } else {
        console.warn('[EMAIL_SYSTEM] Email window not available for notification', {
          windowExists: !!emailWindow,
          isDestroyed: emailWindow ? emailWindow.isDestroyed() : 'N/A'
        });
      }
    });

    if (!watchResult.success) {
      console.warn('[EMAIL_SYSTEM] Failed to start inbox watcher', {
        error: watchResult.error
      });
      
      // Log security event
      securityAuditSystem.logSecurityEvent('email_system', 'medium', {
        component: 'EmailSystem',
        function: 'initializeEmailSystem',
        violationType: 'inbox_watcher_failed',
        mitigationAction: 'system_continued_without_watcher',
        inputData: watchResult.error
      });
    } else {
      console.log('[EMAIL_SYSTEM] Inbox watcher started');
    }

    // Register global hotkey
    const hotkeyRegistered = globalShortcut.register(EMAIL_HOTKEY, () => {
      console.log('[EMAIL_SYSTEM] Email hotkey triggered', { hotkey: EMAIL_HOTKEY });
      
      // Log security event for hotkey usage
      securityAuditSystem.logSecurityEvent('email_system', 'low', {
        component: 'EmailSystem',
        function: 'hotkeyTriggered',
        violationType: 'authorized_hotkey_usage',
        mitigationAction: 'email_window_toggled',
        inputData: EMAIL_HOTKEY
      });
      
      toggleEmailWindow();
    });

    if (hotkeyRegistered) {
      console.log('[EMAIL_SYSTEM] Email hotkey registered', { hotkey: EMAIL_HOTKEY });
    } else {
      console.warn('[EMAIL_SYSTEM] Failed to register email hotkey', { hotkey: EMAIL_HOTKEY });
      
      // Log security event
      securityAuditSystem.logSecurityEvent('email_system', 'medium', {
        component: 'EmailSystem',
        function: 'initializeEmailSystem',
        violationType: 'hotkey_registration_failed',
        mitigationAction: 'system_continued_without_hotkey',
        inputData: EMAIL_HOTKEY
      });
    }

    console.log('[EMAIL_SYSTEM] Email system initialized successfully');

    // Log successful initialization
    securityAuditSystem.logSecurityEvent('email_system', 'low', {
      component: 'EmailSystem',
      function: 'initializeEmailSystem',
      violationType: 'authorized_system_initialization',
      mitigationAction: 'system_initialized_successfully',
      inputData: JSON.stringify({ inboxPath: storageResult.inboxPath, emailCount: storageResult.emailCount })
    });

    return {
      success: true,
      inboxPath: storageResult.inboxPath,
      emailCount: storageResult.emailCount,
      hotkeyRegistered
    };
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Email system initialization failed', {
      error: error.message
    });
    
    // Log security event
    securityAuditSystem.logSecurityEvent('email_system', 'high', {
      component: 'EmailSystem',
      function: 'initializeEmailSystem',
      violationType: 'system_initialization_exception',
      mitigationAction: 'initialization_failed',
      inputData: error.message
    });
    
    return {
      success: false,
      error: `Email system initialization failed: ${error.message}`
    };
  }
}

/**
 * Creates the email window
 * @returns {Object} Creation result with window reference
 */
export function createEmailWindow() {
  try {
    console.log('[EMAIL_SYSTEM] Creating email window...');

    // Check if email window already exists
    if (emailWindow && !emailWindow.isDestroyed()) {
      console.log('[EMAIL_SYSTEM] Email window already exists, focusing...');
      emailWindow.show();
      emailWindow.focus();
      return {
        success: true,
        window: emailWindow,
        alreadyExists: true
      };
    }

    // Create new email window
    const windowOptions = {
      width: 1000,
      height: 700,
      title: 'Email',
      resizable: true,
      otherContents: 'email.html',
      fRole: 'generic'  // Email windows use generic role
    };

    emailWindow = createWindow('email-window', windowOptions);

    if (!emailWindow || emailWindow.isDestroyed()) {
      console.error('[EMAIL_SYSTEM] Failed to create email window');
      return {
        success: false,
        error: 'Failed to create email window'
      };
    }

    // Set up window event handlers
    emailWindow.on('closed', () => {
      console.log('[EMAIL_SYSTEM] Email window closed');
      emailWindow = null;
    });

    emailWindow.on('ready-to-show', () => {
      console.log('[EMAIL_SYSTEM] Email window ready to show');
    });

    console.log('[EMAIL_SYSTEM] Email window created successfully');

    return {
      success: true,
      window: emailWindow
    };
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Failed to create email window', {
      error: error.message
    });
    
    return {
      success: false,
      error: `Email window creation failed: ${error.message}`
    };
  }
}

/**
 * Toggles email window visibility (show/hide/focus)
 * Opens window if it doesn't exist, focuses if hidden, hides if focused
 * @returns {Object} Toggle result with action taken
 */
export function toggleEmailWindow() {
  try {
    console.log('[EMAIL_SYSTEM] Toggling email window...');

    // If window doesn't exist, create it
    if (!emailWindow || emailWindow.isDestroyed()) {
      console.log('[EMAIL_SYSTEM] Email window does not exist, creating...');
      const createResult = createEmailWindow();
      
      return {
        success: createResult.success,
        action: 'created',
        error: createResult.error
      };
    }

    // If window exists but is hidden, show and focus it
    if (!emailWindow.isVisible()) {
      console.log('[EMAIL_SYSTEM] Email window hidden, showing...');
      emailWindow.show();
      emailWindow.focus();
      
      return {
        success: true,
        action: 'shown'
      };
    }

    // If window is visible but not focused, focus it
    if (!emailWindow.isFocused()) {
      console.log('[EMAIL_SYSTEM] Email window not focused, focusing...');
      emailWindow.focus();
      
      return {
        success: true,
        action: 'focused'
      };
    }

    // If window is visible and focused, hide it
    console.log('[EMAIL_SYSTEM] Email window focused, hiding...');
    emailWindow.hide();
    
    return {
      success: true,
      action: 'hidden'
    };
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Failed to toggle email window', {
      error: error.message
    });
    
    return {
      success: false,
      error: `Email window toggle failed: ${error.message}`
    };
  }
}

/**
 * Gets the current email window instance
 * @returns {BrowserWindow|null} Email window or null if not created
 */
export function getEmailWindow() {
  return emailWindow;
}

/**
 * Cleans up email system resources
 * Stops inbox watcher, unregisters hotkey, closes window
 * @returns {Promise<Object>} Cleanup result with success flag
 */
export async function cleanupEmailSystem() {
  try {
    // Prevent double cleanup
    if (cleanupPerformed) {
      console.log('[EMAIL_SYSTEM] Cleanup already performed, skipping');
      return {
        success: true,
        alreadyCleaned: true
      };
    }
    
    console.log('[EMAIL_SYSTEM] Cleaning up email system...');

    // Stop inbox watcher
    const stopWatchResult = await stopWatching();
    
    if (stopWatchResult.success) {
      console.log('[EMAIL_SYSTEM] Inbox watcher stopped');
    } else {
      console.warn('[EMAIL_SYSTEM] Failed to stop inbox watcher', {
        error: stopWatchResult.error
      });
    }

    // Cleanup email sandbox
    const sandboxCleanup = await emailSandbox.cleanup();
    if (sandboxCleanup.success) {
      console.log('[EMAIL_SYSTEM] Email sandbox cleaned up');
    } else {
      console.warn('[EMAIL_SYSTEM] Failed to cleanup email sandbox', {
        error: sandboxCleanup.error
      });
    }

    // Unregister global hotkey
    const unregistered = globalShortcut.unregister(EMAIL_HOTKEY);
    
    if (unregistered) {
      console.log('[EMAIL_SYSTEM] Email hotkey unregistered', { hotkey: EMAIL_HOTKEY });
    } else {
      console.warn('[EMAIL_SYSTEM] Failed to unregister email hotkey', { hotkey: EMAIL_HOTKEY });
    }

    // Close email window if it exists
    if (emailWindow && !emailWindow.isDestroyed()) {
      console.log('[EMAIL_SYSTEM] Closing email window...');
      emailWindow.close();
      emailWindow = null;
    }

    // Unregister memory cleanup
    memoryManager.unregisterCleanupHandler('emailSystem');

    // Mark cleanup as performed
    cleanupPerformed = true;

    console.log('[EMAIL_SYSTEM] Email system cleanup completed');

    // Log successful cleanup
    securityAuditSystem.logSecurityEvent('email_system', 'low', {
      component: 'EmailSystem',
      function: 'cleanupEmailSystem',
      violationType: 'authorized_system_cleanup',
      mitigationAction: 'system_cleaned_up_successfully',
      inputData: JSON.stringify({ watcherStopped: stopWatchResult.success, hotkeyUnregistered: unregistered })
    });

    return {
      success: true,
      watcherStopped: stopWatchResult.success,
      hotkeyUnregistered: unregistered,
      sandboxCleaned: sandboxCleanup.success
    };
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Email system cleanup failed', {
      error: error.message
    });
    
    // Log security event
    securityAuditSystem.logSecurityEvent('email_system', 'medium', {
      component: 'EmailSystem',
      function: 'cleanupEmailSystem',
      violationType: 'system_cleanup_failed',
      mitigationAction: 'cleanup_error_returned',
      inputData: error.message
    });
    
    return {
      success: false,
      error: `Email system cleanup failed: ${error.message}`
    };
  }
}

/**
 * Validates an email file in the inbox using schema validation
 * @param {string} fileName - Name of the email file
 * @returns {Promise<Object>} Validation result
 */
async function validateInboxEmail(fileName) {
  try {
    const inboxPath = getInboxPath();
    if (!inboxPath) {
      console.warn('[EMAIL_SYSTEM] Cannot validate email - inbox path not available');
      return { success: false, error: 'Inbox path not available' };
    }

    const filePath = path.join(inboxPath, fileName);
    
    // Read and validate email file
    const emailContent = fs.readFileSync(filePath, 'utf8');
    const emailData = JSON.parse(emailContent);
    
    // Validate using email schema validator
    const validation = emailSchemaValidator.validateEmail(emailData);
    
    if (!validation.isValid) {
      console.warn('[EMAIL_SYSTEM] Invalid email detected in inbox', {
        fileName,
        errors: validation.errors
      });
      
      // Log security event for invalid email
      securityAuditSystem.logSecurityEvent('email_validation', 'medium', {
        component: 'EmailSystem',
        function: 'validateInboxEmail',
        violationType: 'invalid_email_schema',
        mitigationAction: 'email_flagged_as_invalid',
        inputData: JSON.stringify(validation.errors)
      }, {
        fileName,
        filePath
      });
      
      return { success: false, errors: validation.errors };
    }
    
    console.log('[EMAIL_SYSTEM] Email validation passed', { fileName });
    
    // Log successful validation
    securityAuditSystem.logSecurityEvent('email_validation', 'low', {
      component: 'EmailSystem',
      function: 'validateInboxEmail',
      violationType: 'authorized_email_validation',
      mitigationAction: 'email_validated_successfully',
      inputData: fileName
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Error validating inbox email', {
      fileName,
      error: error.message
    });
    
    // Log security event for validation error
    securityAuditSystem.logSecurityEvent('email_validation', 'medium', {
      component: 'EmailSystem',
      function: 'validateInboxEmail',
      violationType: 'email_validation_error',
      mitigationAction: 'validation_failed',
      inputData: error.message
    }, {
      fileName
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Gets email system status information
 * @returns {Object} Status information
 */
export function getEmailSystemStatus() {
  return {
    windowExists: emailWindow !== null && !emailWindow.isDestroyed(),
    windowVisible: emailWindow && !emailWindow.isDestroyed() ? emailWindow.isVisible() : false,
    windowFocused: emailWindow && !emailWindow.isDestroyed() ? emailWindow.isFocused() : false,
    inboxPath: getInboxPath(),
    hotkey: EMAIL_HOTKEY,
    platform: process.platform
  };
}
