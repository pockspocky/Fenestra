/**
 * Hotkey Manager Module
 * 
 * Manages global hotkeys for save and exit operations.
 * Provides user feedback through system notifications.
 * 
 * Features:
 * - Platform-specific hotkey bindings (Ctrl/Cmd)
 * - Manual save via hotkey (Ctrl+S / Cmd+S)
 * - Exit with auto-save via hotkey (Ctrl+Q / Cmd+Q)
 * - User notifications for save/exit operations
 * - Graceful error handling and logging
 * 
 * Requirements Coverage:
 * - 7.1: Manual save hotkey triggers game state save
 * - 7.2: Display confirmation message after save
 * - 7.3: Log successful save operations
 * - 7.4: Display error message on save failure
 * - 7.5: Use standard key combinations
 * - 8.1: Exit hotkey initiates shutdown
 * - 8.2: Save state before closing
 * - 8.3: Same key combination across platforms
 * - 8.4: Close all windows gracefully
 * - 8.5: Log warnings for hotkey conflicts
 */

import { app, globalShortcut, Notification } from 'electron';
import '../../logger.js';
import { saveGameState } from './gameStateManager.js';
import { isGameStarted } from '../../main.js';

// Platform detection
const isMac = process.platform === 'darwin';

// Hotkey configuration
const HOTKEYS = {
  SAVE: isMac ? 'Command+S' : 'Control+S',
  EXIT: isMac ? 'Command+Q' : 'Control+Q'
};

// Track registration status
let hotkeyRegistrationStatus = {
  save: false,
  exit: false
};

/**
 * Register all game hotkeys
 * @returns {Object} Registration results
 */
export function registerGameHotkeys() {
  console.log('[HOTKEY] Registering game hotkeys...');
  
  const results = {
    success: true,
    registered: [],
    failed: [],
    warnings: []
  };
  
  // Register save hotkey
  try {
    const saveRegistered = globalShortcut.register(HOTKEYS.SAVE, handleSaveHotkey);
    
    if (saveRegistered) {
      hotkeyRegistrationStatus.save = true;
      results.registered.push(HOTKEYS.SAVE);
      console.log(`[HOTKEY] Save hotkey registered: ${HOTKEYS.SAVE}`);
    } else {
      results.failed.push(HOTKEYS.SAVE);
      results.warnings.push(`Failed to register save hotkey ${HOTKEYS.SAVE} - may be in use by another application`);
      console.warn(`[HOTKEY] Failed to register save hotkey: ${HOTKEYS.SAVE}`);
    }
  } catch (error) {
    results.failed.push(HOTKEYS.SAVE);
    results.warnings.push(`Error registering save hotkey: ${error.message}`);
    console.error('[HOTKEY] Error registering save hotkey:', error);
  }
  
  // Register exit hotkey
  try {
    const exitRegistered = globalShortcut.register(HOTKEYS.EXIT, handleExitHotkey);
    
    if (exitRegistered) {
      hotkeyRegistrationStatus.exit = true;
      results.registered.push(HOTKEYS.EXIT);
      console.log(`[HOTKEY] Exit hotkey registered: ${HOTKEYS.EXIT}`);
    } else {
      results.failed.push(HOTKEYS.EXIT);
      results.warnings.push(`Failed to register exit hotkey ${HOTKEYS.EXIT} - may be in use by another application`);
      console.warn(`[HOTKEY] Failed to register exit hotkey: ${HOTKEYS.EXIT}`);
    }
  } catch (error) {
    results.failed.push(HOTKEYS.EXIT);
    results.warnings.push(`Error registering exit hotkey: ${error.message}`);
    console.error('[HOTKEY] Error registering exit hotkey:', error);
  }
  
  // Update overall success status
  results.success = results.registered.length > 0;
  
  console.log('[HOTKEY] Hotkey registration complete', {
    registered: results.registered.length,
    failed: results.failed.length
  });
  
  return results;
}

/**
 * Unregister all game hotkeys
 * @returns {void}
 */
export function unregisterGameHotkeys() {
  console.log('[HOTKEY] Unregistering game hotkeys...');
  
  try {
    // Unregister specific hotkeys
    if (hotkeyRegistrationStatus.save) {
      globalShortcut.unregister(HOTKEYS.SAVE);
      hotkeyRegistrationStatus.save = false;
      console.log(`[HOTKEY] Save hotkey unregistered: ${HOTKEYS.SAVE}`);
    }
    
    if (hotkeyRegistrationStatus.exit) {
      globalShortcut.unregister(HOTKEYS.EXIT);
      hotkeyRegistrationStatus.exit = false;
      console.log(`[HOTKEY] Exit hotkey unregistered: ${HOTKEYS.EXIT}`);
    }
    
    console.log('[HOTKEY] All game hotkeys unregistered');
  } catch (error) {
    console.error('[HOTKEY] Error unregistering hotkeys:', error);
  }
}

/**
 * Handle manual save hotkey (Requirements 7.1, 7.2, 7.3, 7.4)
 * @returns {Promise<void>}
 */
async function handleSaveHotkey() {
  console.log('[HOTKEY] Save hotkey triggered');


  
  try {
    // Save game state with notification support (Requirement 7.4)
    if (isGameStarted()) {
      console.log('[HOTKEY] Game started. Saving.');
      const result = await saveGameState(null, { showNotification: true });
      return;
  }
    
    if (result.success) {
      // Log successful save (Requirement 7.3)
      console.log('[HOTKEY] Game state saved successfully via hotkey', {
        windowCount: result.windowCount,
        relationshipCount: result.relationshipCount,
        failedWindows: result.failedWindows
      });
      
      // Display confirmation message (Requirement 7.2)
      showNotification(
        'Game Saved',
        `Progress saved successfully (${result.windowCount} windows)`,
        'success'
      );
    } else {
      // Display error message (Requirement 7.4)
      console.error('[HOTKEY] Save failed via hotkey:', { 
        message: result.message,
        error: result.error 
      });
      showNotification(
        'Save Failed',
        `Could not save game: ${result.message}`,
        'error'
      );
    }
  } catch (error) {
    console.error('[HOTKEY] Error during save hotkey handling:', { 
      error: error.message,
      stack: error.stack 
    });
    showNotification(
      'Save Error',
      `An error occurred while saving: ${error.message}`,
      'error'
    );
  }
}

/**
 * Handle exit hotkey (Requirements 8.1, 8.2, 8.4)
 * @returns {Promise<void>}
 */
async function handleExitHotkey() {
  console.log('[HOTKEY] Exit hotkey triggered (Requirement 8.1)');
  
  try {
    // Save game state before exiting (Requirement 8.2)
    console.log('[HOTKEY] Saving game state before exit...');
    if (isGameStarted()) {
      console.log('[HOTKEY] Game started. Saving');
      const result = await saveGameState(null, { showNotification: false });
    }
    
    if (result.success) {
      console.log('[HOTKEY] Game state saved successfully before exit', {
        windowCount: result.windowCount,
        relationshipCount: result.relationshipCount
      });
      showNotification(
        'Exiting',
        'Game saved. Closing application...',
        'info'
      );
    } else {
      console.warn('[HOTKEY] Save failed before exit:', { 
        message: result.message,
        error: result.error 
      });
      showNotification(
        'Exit Warning',
        'Could not save game, but closing anyway',
        'warning'
      );
    }
    
    // Give notification time to display, then close all windows gracefully (Requirement 8.4)
    setTimeout(() => {
      console.log('[HOTKEY] Quitting application (Requirement 8.4)');
      app.quit();
    }, 500);
    
  } catch (error) {
    console.error('[HOTKEY] Error during exit hotkey handling:', { 
      error: error.message,
      stack: error.stack 
    });
    showNotification(
      'Exit Error',
      'Error during exit, closing anyway',
      'error'
    );
    
    // Still quit even if there's an error
    setTimeout(() => {
      app.quit();
    }, 500);
  }
}

/**
 * Show notification to user
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info/success/error/warning)
 * @returns {void}
 */
function showNotification(title, message, type = 'info') {
  console.log(`[HOTKEY] Showing notification [${type}]: ${title} - ${message}`);
  
  try {
    // Check if notifications are supported
    if (!Notification.isSupported()) {
      console.warn('[HOTKEY] Notifications not supported on this platform');
      return;
    }
    
    const notification = new Notification({
      title,
      body: message,
      silent: type === 'info', // Only make sound for non-info notifications
      urgency: type === 'error' ? 'critical' : 'normal'
    });
    
    notification.show();
    
    console.debug('[HOTKEY] Notification displayed successfully');
  } catch (error) {
    console.error('[HOTKEY] Error showing notification:', error);
    // Fallback to console output
    console.log(`[NOTIFICATION] ${title}: ${message}`);
  }
}

/**
 * Get hotkey registration status
 * @returns {Object} Registration status
 */
export function getHotkeyStatus() {
  return {
    save: {
      key: HOTKEYS.SAVE,
      registered: hotkeyRegistrationStatus.save
    },
    exit: {
      key: HOTKEYS.EXIT,
      registered: hotkeyRegistrationStatus.exit
    }
  };
}

/**
 * Get configured hotkeys
 * @returns {Object} Hotkey configuration
 */
export function getHotkeys() {
  return { ...HOTKEYS };
}
