/**
 * Email System Manager
 * Manages email window lifecycle, global hotkey, and email system initialization
 */

import { globalShortcut } from 'electron';
import '../../logger.js';
import { createWindow } from './windowManager.js';
import { 
  initializeEmailStorage, 
  watchInboxDirectory, 
  stopWatching,
  getInboxPath 
} from './emailStorage.js';

// Email window reference
let emailWindow = null;

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

    // Initialize email storage
    const storageResult = await initializeEmailStorage(options.inboxPath);
    
    if (!storageResult.success) {
      console.error('[EMAIL_SYSTEM] Failed to initialize email storage', {
        error: storageResult.error
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
      console.log('[EMAIL_SYSTEM] Inbox file event', { event, fileName });
      
      // Notify email window if it's open
      if (emailWindow && !emailWindow.isDestroyed()) {
        emailWindow.webContents.send('email-inbox-update', { event, fileName });
      }
    });

    if (!watchResult.success) {
      console.warn('[EMAIL_SYSTEM] Failed to start inbox watcher', {
        error: watchResult.error
      });
    } else {
      console.log('[EMAIL_SYSTEM] Inbox watcher started');
    }

    // Register global hotkey
    const hotkeyRegistered = globalShortcut.register(EMAIL_HOTKEY, () => {
      console.log('[EMAIL_SYSTEM] Email hotkey triggered', { hotkey: EMAIL_HOTKEY });
      toggleEmailWindow();
    });

    if (hotkeyRegistered) {
      console.log('[EMAIL_SYSTEM] Email hotkey registered', { hotkey: EMAIL_HOTKEY });
    } else {
      console.warn('[EMAIL_SYSTEM] Failed to register email hotkey', { hotkey: EMAIL_HOTKEY });
    }

    console.log('[EMAIL_SYSTEM] Email system initialized successfully');

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
      otherContents: 'email.html'
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

    console.log('[EMAIL_SYSTEM] Email system cleanup completed');

    return {
      success: true,
      watcherStopped: stopWatchResult.success,
      hotkeyUnregistered: unregistered
    };
  } catch (error) {
    console.error('[EMAIL_SYSTEM] Email system cleanup failed', {
      error: error.message
    });
    
    return {
      success: false,
      error: `Email system cleanup failed: ${error.message}`
    };
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
