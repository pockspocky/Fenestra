import { ipcMain } from 'electron';
import {
  loadWelcomeButtonState,
  saveWelcomeButtonState,
  isWelcomeButtonClicked,
  resetWelcomeButtonState
} from '../storage/welcomeButtonStorage.js';
import {
  createDoor,
  createKey
} from '../systems/windowManager.js';
import {
  initializeDoorRelation,
  initializeKeyRelation
} from '../systems/doorKeySystem.js';
import { systemEvents } from '../events/systemEvents.js';
import '../../logger.js';

/**
 * Error codes for welcome button operations
 * 
 * These codes are used internally to identify specific error conditions
 * and map them to user-friendly messages.
 */
const ERROR_CODES = {
  ALREADY_CLICKED: 'ALREADY_CLICKED',
  STATE_LOAD_FAILED: 'STATE_LOAD_FAILED',
  STATE_SAVE_FAILED: 'STATE_SAVE_FAILED',
  WINDOW_CREATION_FAILED: 'WINDOW_CREATION_FAILED',
  DOOR_CREATION_FAILED: 'DOOR_CREATION_FAILED',
  KEY_CREATION_FAILED: 'KEY_CREATION_FAILED',
  INVALID_STATE: 'INVALID_STATE'
};

/**
 * User-friendly error messages
 * 
 * These messages are displayed to players when errors occur. They avoid
 * technical implementation details and provide actionable guidance.
 */
const USER_ERROR_MESSAGES = {
  ALREADY_CLICKED: 'You have already started your journey.',
  STATE_LOAD_FAILED: 'Could not load saved state. Starting fresh.',
  STATE_SAVE_FAILED: 'Could not save your progress. Please check disk space.',
  WINDOW_CREATION_FAILED: 'Could not create game windows. Please try again.',
  DOOR_CREATION_FAILED: 'Could not create the door window. Please try again.',
  KEY_CREATION_FAILED: 'Could not create the key window. Please try again.',
  INVALID_STATE: 'Game state is invalid. Please restart the game.',
  CRITICAL_ERROR: 'An unexpected error occurred. Please restart the game.'
};
/**
 * Format an error response with user-friendly message
 *
 * Creates a standardized error response object that includes both technical
 * details for logging and user-friendly messages for display. This ensures
 * consistent error formatting across all IPC handlers.
 *
 * @param {string} errorCode - Error code from ERROR_CODES constant
 * @param {string} technicalMessage - Technical error message for logging
 * @param {Object} [additionalFields] - Optional additional fields to include in response
 * @returns {Object} Formatted error response
 * @returns {boolean} returns.success - Always false for error responses
 * @returns {string} returns.error - Error code
 * @returns {string} returns.message - Technical error message
 * @returns {string} returns.userMessage - User-friendly error message
 *
 * @example
 * return formatErrorResponse(
 *   ERROR_CODES.STATE_LOAD_FAILED,
 *   error.message
 * );
 *
 * @example
 * return formatErrorResponse(
 *   ERROR_CODES.ALREADY_CLICKED,
 *   'Button has already been clicked',
 *   { alreadyClicked: true }
 * );
 */
function formatErrorResponse(errorCode, technicalMessage, additionalFields = {}) {
  return {
    success: false,
    error: errorCode,
    message: technicalMessage,
    userMessage: USER_ERROR_MESSAGES[errorCode] || USER_ERROR_MESSAGES.CRITICAL_ERROR,
    ...additionalFields
  };
}

/**
 * Initialize welcome button IPC handlers
 * 
 * Registers all IPC handlers for the welcome button feature. This should be
 * called during application startup, after the IPC system is initialized.
 * 
 * Registered Channels:
 * - 'welcome-button:get-state' - Query current button state
 * - 'welcome-button:click' - Handle button click event
 * - 'welcome-button:reset' - Reset state (testing/admin only)
 * 
 * @returns {Object} Result with success flag
 * @returns {boolean} returns.success - True if initialization succeeded
 * 
 * @example
 * const result = initializeWelcomeButtonHandlers();
 * if (result.success) {
 *   console.log('Welcome button handlers initialized');
 * }
 */
export function initializeWelcomeButtonHandlers() {
  console.log('[WELCOME_BUTTON] Initializing IPC handlers');

  // Register get-state handler
  ipcMain.handle('welcome-button:get-state', async () => {
    console.log('[WELCOME_BUTTON] Handling get-state request');

    try {
      // Load button state from storage
      const state = await loadWelcomeButtonState();

      console.log('[WELCOME_BUTTON] State loaded successfully:', { clicked: state.clicked, timestamp: state.timestamp });

      // Return success response with clicked flag and timestamp
      return {
        success: true,
        clicked: state.clicked,
        timestamp: state.timestamp
      };
    } catch (error) {
      // Handle storage errors
      console.error('[WELCOME_BUTTON] Failed to load state:', error);

      return formatErrorResponse(
        ERROR_CODES.STATE_LOAD_FAILED,
        error.message
      );
    }
  });

  // Register click handler
  ipcMain.handle('welcome-button:click', async () => {
    console.log('[WELCOME_BUTTON] Handling click request');

    try {
      // Load current button state from storage
      const state = await loadWelcomeButtonState();

      console.log('[WELCOME_BUTTON] Current state:', { clicked: state.clicked });

      // Check if button already clicked
      if (state.clicked === true) {
        console.log('[WELCOME_BUTTON] Button already clicked, rejecting request');

        return formatErrorResponse(
          ERROR_CODES.ALREADY_CLICKED,
          'Button has already been clicked',
          { alreadyClicked: true }
        );
      }

      // If not clicked, call createWelcomeWindows()
      console.log('[WELCOME_BUTTON] Creating welcome windows');
      const result = createWelcomeWindows();

      // If window creation fails, return error without saving state
      if (result.success === false) {
        console.error('[WELCOME_BUTTON] Window creation failed:', result.message);

        return formatErrorResponse(
          result.error || ERROR_CODES.WINDOW_CREATION_FAILED,
          result.message
        );
      }

      // If window creation succeeds, save clicked state to storage
      console.log('[WELCOME_BUTTON] Windows created successfully, saving state');
      const saveResult = await saveWelcomeButtonState(true, {
        windowsCreated: {
          door: result.door,
          key: result.key
        }
      });

      // Check if state save failed
      if (!saveResult.success) {
        console.error('[WELCOME_BUTTON] Failed to save state:', saveResult.message);
        // Note: Windows were created but state wasn't saved
        // This is a partial success - return success but log the issue
      }

      console.log('[WELCOME_BUTTON] Click handled successfully');

      // Emit event for email scheduling integration
      systemEvents.emit('welcome:button:clicked', {
        entityId: 'welcome-button',
        timestamp: Date.now(),
        source: 'welcomeButton'
      });
      console.log('[WELCOME_BUTTON] Emitted welcome:button:clicked event');

      // Return success response with window IDs
      return {
        success: true,
        message: 'Windows created successfully',
        windowsCreated: {
          door: result.door,
          key: result.key
        }
      };
    } catch (error) {
      // Handle unexpected errors
      console.error('[WELCOME_BUTTON] Unexpected error during click handling:', error);

      return formatErrorResponse(
        ERROR_CODES.INVALID_STATE,
        error.message
      );
    }
  });

  return {
    success: true
  };
}

/**
 * Cleanup welcome button IPC handlers
 * 
 * Removes all registered IPC handlers for the welcome button feature. This
 * should be called during application shutdown to prevent memory leaks.
 * 
 * @returns {void}
 * 
 * @example
 * cleanupWelcomeButtonHandlers();
 */
export function cleanupWelcomeButtonHandlers() {
  console.log('[WELCOME_BUTTON] Cleaning up IPC handlers');
  
  // Remove get-state handler
  ipcMain.removeHandler('welcome-button:get-state');
  console.log('[WELCOME_BUTTON] Removed get-state handler');
  
  // Remove click handler
  ipcMain.removeHandler('welcome-button:click');
  console.log('[WELCOME_BUTTON] Removed click handler');
  
  console.log('[WELCOME_BUTTON] Cleanup complete');
}
/**
 * Create welcome windows (door and key)
 *
 * Creates the door and key windows for the welcome flow. The door is created
 * first, followed by the key. Both windows are initialized with their
 * relationships in the door-key system.
 *
 * Window Specifications:
 * - Door: ID 'welcome-door', title 'Mysterious Door', closed and locked
 * - Key: ID 'welcome-key', title 'Ancient Key', linked to welcome-door
 *
 * Error Handling:
 * - If door creation fails, returns error without attempting key creation
 * - If key creation fails after door succeeds, logs error but returns partial success
 *
 * @returns {Object} Result with success flag and window IDs
 * @returns {boolean} returns.success - True if windows created successfully
 * @returns {string} [returns.door] - Door window ID (if created)
 * @returns {string} [returns.key] - Key window ID (if created, null if failed)
 * @returns {boolean} [returns.keyCreationFailed] - True if key creation failed but door succeeded
 * @returns {string} [returns.error] - Error code if operation failed
 * @returns {string} [returns.message] - Error message if operation failed
 *
 * @example
 * const result = createWelcomeWindows();
 * if (result.success) {
 *   console.log('Created door:', result.door);
 *   console.log('Created key:', result.key);
 * }
 */
function createWelcomeWindows() {
  console.log('[WELCOME_BUTTON] Creating welcome windows');

  // Create door window first (wrapped in try-catch)
  try {
    createDoor('welcome-door', 'Mysterious Door (locked)', false, {
      initialState: 'closed',
      isLocked: true
    });

    // Initialize door relation
    initializeDoorRelation('welcome-door');

    console.log('[WELCOME_BUTTON] Door window created successfully');
  } catch (error) {
    // If door creation fails, return error without creating key
    console.error('[WELCOME_BUTTON] Failed to create door window:', error);
    
    return {
      success: false,
      error: ERROR_CODES.DOOR_CREATION_FAILED,
      message: `Failed to create door window: ${error.message}`
    };
  }

  // Create key window (wrapped in try-catch)
  try {
    createKey('welcome-key', 'Ancient Key', false, ['welcome-door']);

    // Initialize key relation with door mapping
    initializeKeyRelation('welcome-key', ['welcome-door']);

    console.log('[WELCOME_BUTTON] Key window created successfully');
  } catch (error) {
    // If key creation fails, log error but return partial success (door was created)
    console.error('[WELCOME_BUTTON] Failed to create key window:', error);
    
    return {
      success: true,
      door: 'welcome-door',
      key: null,
      keyCreationFailed: true
    };
  }

  console.log('[WELCOME_BUTTON] Windows created successfully');

  // Return success result with window IDs
  return {
    success: true,
    door: 'welcome-door',
    key: 'welcome-key'
  };
}

/**
 * Get current button state (for testing/debugging)
 * 
 * Convenience function to query the current button state without going through
 * IPC. Useful for testing and debugging.
 * 
 * @returns {Promise<Object>} Button state
 * @returns {Promise<boolean>} returns.clicked - Whether button has been clicked
 * @returns {Promise<string|null>} returns.timestamp - ISO 8601 timestamp of click
 * @returns {Promise<Object|null>} returns.windowsCreated - Created window IDs
 * 
 * @example
 * const state = await getWelcomeButtonState();
 * console.log('Button clicked:', state.clicked);
 */
export async function getWelcomeButtonState() {
  return await loadWelcomeButtonState();
}

/**
 * Reset button state (for testing/new game)
 * 
 * Resets the button state to default (unclicked). This is primarily used for
 * testing, but could also be used to allow players to restart their game.
 * 
 * @returns {Promise<Object>} Result with success flag
 * @returns {Promise<boolean>} returns.success - True if reset succeeded
 * @returns {Promise<string>} [returns.error] - Error code if reset failed
 * @returns {Promise<string>} [returns.message] - Error message if reset failed
 * 
 * @example
 * const result = await resetWelcomeButtonState();
 * if (result.success) {
 *   console.log('Button state reset successfully');
 * }
 */
export async function resetWelcomeButtonStateHandler() {
  return await resetWelcomeButtonState();
}
