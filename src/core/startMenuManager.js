import { BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import '../../logger.js';
import { hasSavedState, getSaveMetadata, loadGameState, deleteSavedState } from './systems/gameStateManager.js';
import { createDemoDoorsAndKeys } from './systems/gameLogic.js';
import { deserializeWindow } from './windowStorage.js';
import { importRelationshipState } from './systems/doorKeySystem.js';
import { importGameLogicState } from './systems/gameLogic.js';
import { getGameDataDirectory } from './config.js';

// Start menu state
let startMenuWindow = null;
let isMenuActive = false;
let gameStartedCallback = null;

/**
 * Clear all files from the storage directory
 * @returns {Promise<Object>} Result object with files removed count and any errors
 */
export async function clearStorageDirectory() {
  console.log('[START_MENU] Clearing storage directory');
  
  const result = {
    success: true,
    filesRemoved: 0,
    errors: []
  };
  
  try {
    // Get storage directory path
    const gameDataDir = getGameDataDirectory();
    const storageDir = path.join(gameDataDir, '.fenestra-storage');
    
    console.log(`[START_MENU] Storage directory path: ${storageDir}`);
    
    // Check if directory exists
    if (!fs.existsSync(storageDir)) {
      console.log('[START_MENU] Storage directory does not exist, nothing to clear');
      return result;
    }
    
    // Read all files in directory
    const files = fs.readdirSync(storageDir);
    console.log(`[START_MENU] Found ${files.length} files in storage directory`);
    
    // Delete each file individually
    for (const file of files) {
      const filePath = path.join(storageDir, file);
      
      try {
        // Check if it's a file (not a directory)
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          result.filesRemoved++;
          console.log(`[START_MENU] Deleted file: ${file}`);
        } else {
          console.log(`[START_MENU] Skipping non-file: ${file}`);
        }
      } catch (error) {
        const errorMsg = `Failed to delete ${file}: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`[START_MENU] ${errorMsg}`);
      }
    }
    
    console.log(`[START_MENU] Storage clearing complete: ${result.filesRemoved} files removed, ${result.errors.length} errors`);
    
    // Set success to false if there were errors
    if (result.errors.length > 0) {
      result.success = false;
    }
    
    return result;
    
  } catch (error) {
    console.error('[START_MENU] Failed to clear storage directory:', error);
    result.success = false;
    result.errors.push(`Storage clearing failed: ${error.message}`);
    return result;
  }
}

/**
 * Create and display start menu window
 * @returns {Promise<BrowserWindow>} Start menu window
 */
export async function createStartMenu() {
  console.log('[START_MENU] Creating start menu window');
  
  // If start menu already exists, focus and return it
  if (startMenuWindow && !startMenuWindow.isDestroyed()) {
    startMenuWindow.show();
    startMenuWindow.focus();
    console.log('[START_MENU] Start menu already exists, focusing');
    return startMenuWindow;
  }
  
  // Check if saved state exists
  const saveExists = hasSavedState();
  const saveMetadata = saveExists ? getSaveMetadata() : null;
  
  console.log(`[START_MENU] Save state exists: ${saveExists}`);
  if (saveMetadata) {
    console.log(`[START_MENU] Save metadata:`, {
      timestamp: saveMetadata.timestamp,
      windowCount: saveMetadata.windowCount,
      isValid: saveMetadata.isValid
    });
  }
  
  // Create start menu window
  startMenuWindow = new BrowserWindow({
    width: 600,
    height: 800,
    center: true,
    resizable: false,
    frame: true,
    title: 'Fenestra - Start Menu',
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  
  // Load start menu HTML with save state information
  const queryParams = {
    saveExists: saveExists.toString(),
    saveTimestamp: saveMetadata?.timestamp || '',
    saveWindowCount: saveMetadata?.windowCount?.toString() || '0',
    saveIsValid: saveMetadata?.isValid?.toString() || 'false'
  };
  
  const htmlPath = path.join(process.cwd(), 'renderer', 'startMenu.html');
  await startMenuWindow.loadFile(htmlPath, { query: queryParams });
  
  // Set menu as active
  isMenuActive = true;
  
  // Handle window close
  startMenuWindow.on('closed', () => {
    console.log('[START_MENU] Start menu window closed');
    startMenuWindow = null;
    isMenuActive = false;
  });
  
  console.log('[START_MENU] Start menu window created successfully');
  return startMenuWindow;
}

/**
 * Close start menu window
 * @returns {void}
 */
export function closeStartMenu() {
  console.log('[START_MENU] Closing start menu');
  
  if (startMenuWindow && !startMenuWindow.isDestroyed()) {
    startMenuWindow.close();
    startMenuWindow = null;
  }
  
  isMenuActive = false;
  console.log('[START_MENU] Start menu closed');
}

/**
 * Handle new game selection
 * @returns {Promise<Object>} Operation result
 */
export async function handleNewGame() {
  console.log('[START_MENU] Handling new game selection');
  
  try {
    // Check if saved state exists (Requirement 1.1)
    if (hasSavedState()) {
      console.log('[START_MENU] Saved state exists, displaying confirmation dialog');
      
      // Display confirmation dialog (Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 2.5)
      let response;
      try {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Start New Game?',
          message: 'Start New Game?',
          detail: 'This will delete your current saved game. Are you sure you want to start a new game?',
          buttons: ['Cancel', 'Start New Game'],
          defaultId: 0,  // Default to Cancel for safety (Requirement 2.3)
          cancelId: 0,   // Escape key maps to Cancel (Requirement 2.5)
          noLink: true   // Prevent button grouping on macOS
        });
        
        response = result.response;
        console.log(`[START_MENU] User response to confirmation dialog: ${response === 0 ? 'Cancel' : 'Start New Game'}`);
        
      } catch (error) {
        // Error handling for dialog display failures (Requirement 5.5)
        console.error('[START_MENU] Failed to display confirmation dialog:', {
          error: error.message,
          stack: error.stack
        });
        console.log('[START_MENU] Proceeding with new game as fallback');
        // Proceed with new game as fallback (safer than blocking user)
        response = 1;
      }
      
      // Handle user cancellation (Requirement 1.4, 5.4)
      if (response === 0) {
        console.log('[START_MENU] User cancelled new game action');
        return {
          success: false,
          cancelled: true,
          message: 'New game cancelled by user'
        };
      }
    } else {
      // No saved state exists, proceed directly (Requirement 1.5)
      console.log('[START_MENU] No saved state exists, proceeding directly to new game');
    }
    
    // Close start menu
    closeStartMenu();
    
    // Clear storage directory before creating demo content (Requirements 1.3, 5.3)
    console.log('[START_MENU] Clearing storage directory before creating demo content');
    const clearResult = await clearStorageDirectory();
    
    // Log storage clearing results (Requirement 4.5)
    console.log(`[START_MENU] Storage cleared: ${clearResult.filesRemoved} files removed, ${clearResult.errors.length} errors`);
    
    // Handle storage clearing errors but continue with demo content (Requirement 5.6)
    if (!clearResult.success || clearResult.errors.length > 0) {
      console.warn('[START_MENU] Storage clearing encountered errors, but continuing with demo content creation');
      clearResult.errors.forEach(error => {
        console.error(`[START_MENU] Storage clearing error: ${error}`);
      });
    }
    
    // Delete any existing saved state
    if (hasSavedState()) {
      console.log('[START_MENU] Deleting existing saved state');
      const deleteResult = await deleteSavedState();
      if (deleteResult.success) {
        console.log('[START_MENU] Existing save deleted successfully');
      } else {
        console.warn('[START_MENU] Failed to delete existing save:', deleteResult.message);
      }
    }
    
    // Initialize demo content after storage is cleared (Requirements 1.3, 5.3)
    console.log('[START_MENU] Creating demo content');
    createDemoDoorsAndKeys();
    
    // Notify that game has started
    if (gameStartedCallback) {
      gameStartedCallback();
    }
    
    console.log('[START_MENU] New game started successfully');
    return {
      success: true,
      message: 'New game started successfully',
      storageCleared: {
        filesRemoved: clearResult.filesRemoved,
        errors: clearResult.errors
      }
    };
    
  } catch (error) {
    console.error('[START_MENU] Failed to start new game:', error);
    return {
      success: false,
      message: `Failed to start new game: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Handle continue game selection
 * @returns {Promise<Object>} Operation result
 */
export async function handleContinueGame() {
  console.log('[START_MENU] Handling continue game selection');
  
  try {
    // Check if saved state exists (Requirement 6.1)
    if (!hasSavedState()) {
      console.warn('[START_MENU] No saved state found');
      return {
        success: false,
        message: 'No saved game state found'
      };
    }
    
    // Close start menu
    closeStartMenu();
    
    // Load game state with user notifications enabled (Requirement 6.3)
    console.log('[START_MENU] Loading saved game state');
    const loadResult = await loadGameState(null, { showNotification: true });
    
    // Handle load failure with fallback to demo content (Requirement 6.2, 6.3, 4.5)
    if (!loadResult.success) {
      console.error('[START_MENU] Failed to load game state:', { 
        message: loadResult.message,
        reason: loadResult.reason,
        corrupted: loadResult.corrupted,
        backupCreated: loadResult.backupCreated
      });
      
      // Fall back to demo content (Requirement 4.5)
      console.log('[START_MENU] Falling back to demo content');
      createDemoDoorsAndKeys();
      
      // Notify that game has started (even with fallback)
      if (gameStartedCallback) {
        gameStartedCallback();
      }
      
      return {
        success: false,
        message: `Failed to load saved game: ${loadResult.message}. Loaded demo content instead.`,
        fallbackToDemo: true,
        reason: loadResult.reason
      };
    }
    
    const gameState = loadResult.data;
    console.log(`[START_MENU] Game state loaded: ${gameState.windows?.length || 0} windows, ${Object.keys(gameState.relationships?.doorKeyRelations || {}).length} relationships`);
    
    // Restore windows
    console.log('[START_MENU] Restoring windows');
    const restoredWindows = [];
    const failedWindows = [];
    
    for (const windowData of gameState.windows || []) {
      try {
        const windowId = windowData.metadata?.originalId || windowData.windowConfig?.id;
        console.log(`[START_MENU] Restoring window: ${windowId}`);
        
        const restoreResult = deserializeWindow(windowData, { forceNewId: false });
        
        if (restoreResult.success) {
          restoredWindows.push(windowId);
          console.log(`[START_MENU] Window restored successfully: ${windowId}`);
        } else {
          failedWindows.push(windowId);
          console.warn(`[START_MENU] Failed to restore window ${windowId}:`, restoreResult.message);
        }
      } catch (error) {
        const windowId = windowData.metadata?.originalId || 'unknown';
        failedWindows.push(windowId);
        console.error(`[START_MENU] Error restoring window ${windowId}:`, error);
      }
    }
    
    console.log(`[START_MENU] Windows restored: ${restoredWindows.length} succeeded, ${failedWindows.length} failed`);
    
    // Restore door-key relationships
    if (gameState.relationships) {
      console.log('[START_MENU] Restoring door-key relationships');
      try {
        importRelationshipState(gameState.relationships);
        console.log('[START_MENU] Relationships restored successfully');
      } catch (error) {
        console.error('[START_MENU] Failed to restore relationships:', error);
      }
    }
    
    // Restore game logic state
    if (gameState.gameLogic) {
      console.log('[START_MENU] Restoring game logic state');
      try {
        importGameLogicState(gameState.gameLogic);
        console.log('[START_MENU] Game logic state restored successfully');
      } catch (error) {
        console.error('[START_MENU] Failed to restore game logic state:', error);
      }
    }
    
    // Build result message
    let message = `Game loaded successfully: ${restoredWindows.length} windows restored`;
    if (failedWindows.length > 0) {
      message += `, ${failedWindows.length} windows failed to restore`;
    }
    
    // Notify that game has started
    if (gameStartedCallback) {
      gameStartedCallback();
    }
    
    console.log('[START_MENU] Continue game completed successfully');
    return {
      success: true,
      message,
      restoredWindows: restoredWindows.length,
      failedWindows: failedWindows.length,
      totalWindows: gameState.windows?.length || 0
    };
    
  } catch (error) {
    console.error('[START_MENU] Failed to continue game:', { 
      error: error.message,
      stack: error.stack 
    });
    
    // Fall back to demo content (Requirement 4.5)
    console.log('[START_MENU] Falling back to demo content due to error');
    try {
      createDemoDoorsAndKeys();
      console.log('[START_MENU] Demo content created successfully as fallback');
    } catch (demoError) {
      console.error('[START_MENU] Failed to create demo content:', { 
        error: demoError.message,
        stack: demoError.stack 
      });
    }
    
    // Notify that game has started (even with fallback)
    if (gameStartedCallback) {
      gameStartedCallback();
    }
    
    return {
      success: false,
      message: `Failed to continue game: ${error.message}. Loaded demo content instead.`,
      error: error.message,
      fallbackToDemo: true
    };
  }
}

/**
 * Check if start menu is currently displayed
 * @returns {boolean} True if start menu is active
 */
export function isStartMenuActive() {
  return isMenuActive && startMenuWindow && !startMenuWindow.isDestroyed();
}

/**
 * Get start menu window
 * @returns {BrowserWindow|null} Start menu window or null
 */
export function getStartMenuWindow() {
  return startMenuWindow;
}

/**
 * Set callback to be invoked when game starts (new or continue)
 * @param {Function} callback - Callback function to invoke when game starts
 * @returns {void}
 */
export function setGameStartedCallback(callback) {
  gameStartedCallback = callback;
  console.log('[START_MENU] Game started callback registered');
}
