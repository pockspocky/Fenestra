import fs from 'node:fs';
import path from 'node:path';
import { getGameDataDirectory } from '../core/config.js';
import { joinPaths } from '../utils/pathUtils.js';
import '../../logger.js';

// Storage configuration
const STATE_DIR = 'state';
const STATE_FILE = 'welcome-button-state.json';
const STATE_VERSION = 1;

/**
 * Get the full path to the welcome button state file
 * 
 * Constructs the absolute path to the state file by combining the game data directory,
 * state subdirectory, and state filename.
 * 
 * @returns {string} Full path to state file (e.g., /path/to/game-data/state/welcome-button-state.json)
 * 
 * @example
 * const path = getStateFilePath();
 * // Returns: '/home/user/game-data/state/welcome-button-state.json'
 */
function getStateFilePath() {
  const gameDataDir = getGameDataDirectory();
  return joinPaths(gameDataDir, STATE_DIR, STATE_FILE);
}

/**
 * Get the default welcome button state
 * 
 * Returns the initial state object used when no saved state exists or when
 * the state file is corrupted. This represents an unclicked button with no
 * associated windows.
 * 
 * @returns {Object} Default state object
 * @returns {boolean} returns.clicked - Always false (button not clicked)
 * @returns {null} returns.timestamp - Always null (no click timestamp)
 * @returns {null} returns.windowsCreated - Always null (no windows created)
 * @returns {number} returns.version - Current state version number
 * 
 * @example
 * const defaultState = getDefaultState();
 * // Returns: { clicked: false, timestamp: null, windowsCreated: null, version: 1 }
 */
function getDefaultState() {
  return {
    clicked: false,
    timestamp: null,
    windowsCreated: null,
    version: STATE_VERSION
  };
}
/**
 * Load welcome button state from storage
 * 
 * Reads the state file from disk and parses it as JSON. Handles various error
 * conditions gracefully by returning the default state. This function is safe
 * to call even if the state file doesn't exist or is corrupted.
 * 
 * @returns {Promise<Object>} State object with clicked flag, timestamp, windowsCreated, and version
 * @returns {Promise<boolean>} returns.clicked - Whether the button has been clicked
 * @returns {Promise<string|null>} returns.timestamp - ISO 8601 timestamp of click, or null if not clicked
 * @returns {Promise<Object|null>} returns.windowsCreated - Object with door and key IDs, or null if not clicked
 * @returns {Promise<number>} returns.version - State version number for future compatibility
 * 
 * @throws {never} This function never throws - all errors are handled internally
 * 
 * Error Conditions:
 * - File doesn't exist (ENOENT): Returns default state, creates state directory
 * - Corrupted JSON: Returns default state, logs warning
 * - Invalid state structure: Returns default state, logs warning
 * - Permission errors: Returns default state, logs warning
 * 
 * @example
 * const state = await loadWelcomeButtonState();
 * if (state.clicked) {
 *   console.log('Button was clicked at:', state.timestamp);
 * }
 */
export async function loadWelcomeButtonState() {
  const stateFilePath = getStateFilePath();
  const defaultState = getDefaultState();

  try {
    // Try to read the state file
    const fileContent = await fs.promises.readFile(stateFilePath, 'utf-8');

    // Try to parse JSON
    try {
      const state = JSON.parse(fileContent);

      // Validate that we have a valid state object
      if (typeof state === 'object' && state !== null && typeof state.clicked === 'boolean') {
        return state;
      } else {
        // Invalid state structure, return default
        console.warn('[WELCOME_BUTTON] Invalid state structure, using default state');
        return defaultState;
      }
    } catch (parseError) {
      // JSON parsing failed - corrupted file
      console.warn('[WELCOME_BUTTON] Corrupted state file, using default state:', parseError.message);
      return defaultState;
    }
  } catch (readError) {
    // File doesn't exist or can't be read
    if (readError.code === 'ENOENT') {
      // File doesn't exist - this is normal for first run
      // Create the state directory if it doesn't exist
      const stateDir = path.dirname(stateFilePath);
      try {
        await fs.promises.mkdir(stateDir, { recursive: true });
      } catch (mkdirError) {
        console.warn('[WELCOME_BUTTON] Could not create state directory:', mkdirError.message);
      }
      return defaultState;
    } else {
      // Other read error (permissions, etc.)
      console.warn('[WELCOME_BUTTON] Could not read state file:', readError.message);
      return defaultState;
    }
  }
}

/**
 * Check if welcome button has been clicked
 * 
 * Convenience function that loads the full state and returns only the clicked
 * boolean. This is useful when you only need to check the button status without
 * caring about timestamps or window IDs.
 * 
 * @returns {Promise<boolean>} True if button has been clicked, false otherwise
 * 
 * @throws {never} This function never throws - delegates error handling to loadWelcomeButtonState
 * 
 * Error Conditions:
 * - All error conditions from loadWelcomeButtonState apply
 * - On any error, returns false (default state)
 * 
 * @example
 * if (await isWelcomeButtonClicked()) {
 *   console.log('Button already clicked, skipping window creation');
 * }
 */
export async function isWelcomeButtonClicked() {
  const state = await loadWelcomeButtonState();
  return state.clicked;
}

/**
 * Reset welcome button state to default (for testing purposes)
 * 
 * Deletes the state file from disk, causing the next load to return the default
 * state. This is primarily used for testing and debugging. In production, this
 * could be used to allow players to restart their game.
 * 
 * @returns {Promise<Object>} Result object indicating success or failure
 * @returns {Promise<boolean>} returns.success - True if reset succeeded, false otherwise
 * @returns {Promise<string>} [returns.error] - Error code if reset failed (e.g., 'EACCES')
 * @returns {Promise<string>} [returns.message] - Human-readable error message if reset failed
 * 
 * @throws {never} This function never throws - all errors are caught and returned in result object
 * 
 * Error Conditions:
 * - File doesn't exist (ENOENT): Returns success (already in default state)
 * - Permission errors (EACCES): Returns failure with error details
 * - File system errors: Returns failure with error details
 * 
 * @example
 * const result = await resetWelcomeButtonState();
 * if (result.success) {
 *   console.log('State reset successfully');
 * } else {
 *   console.error('Reset failed:', result.message);
 * }
 */
export async function resetWelcomeButtonState() {
  const stateFilePath = getStateFilePath();

  try {
    // Try to delete the state file
    await fs.promises.unlink(stateFilePath);
    return {
      success: true
    };
  } catch (error) {
    // If file doesn't exist, that's fine - already in default state
    if (error.code === 'ENOENT') {
      return {
        success: true
      };
    }

    // Other errors (permissions, etc.)
    console.error('[WELCOME_BUTTON] Failed to reset state:', error.message);
    return {
      success: false,
      error: error.code || 'UNKNOWN_ERROR',
      message: error.message
    };
  }
}

/**
 * Save welcome button state to storage
 * 
 * Writes the button state to disk using an atomic write pattern (write to temp file,
 * then rename). This ensures the state file is never left in a partially-written state.
 * Automatically creates the state directory if it doesn't exist.
 * 
 * @param {boolean} clicked - Whether the button has been clicked
 * @param {Object} [metadata={}] - Optional metadata about the button click
 * @param {Object} [metadata.windowsCreated] - Object containing created window IDs
 * @param {string} [metadata.windowsCreated.door] - Door window ID (e.g., 'welcome-door')
 * @param {string} [metadata.windowsCreated.key] - Key window ID (e.g., 'welcome-key')
 * 
 * @returns {Promise<Object>} Result object indicating success or failure
 * @returns {Promise<boolean>} returns.success - True if save succeeded, false otherwise
 * @returns {Promise<string>} [returns.error] - Error code if save failed (e.g., 'ENOSPC', 'EACCES')
 * @returns {Promise<string>} [returns.message] - Human-readable error message if save failed
 * 
 * @throws {never} This function never throws - all errors are caught and returned in result object
 * 
 * Error Conditions:
 * - Disk full (ENOSPC): Returns failure, cleans up temp file
 * - Permission errors (EACCES): Returns failure, cleans up temp file
 * - Directory creation failure: Returns failure with error details
 * - Write failure: Returns failure, attempts to clean up temp file
 * 
 * Important Notes:
 * - Uses atomic write pattern (temp file + rename) to prevent corruption
 * - Automatically sets timestamp to current time when clicked=true
 * - Creates state directory if it doesn't exist
 * - Cleans up temporary file on error
 * 
 * @example
 * // Save clicked state with window IDs
 * const result = await saveWelcomeButtonState(true, {
 *   windowsCreated: { door: 'welcome-door', key: 'welcome-key' }
 * });
 * if (!result.success) {
 *   console.error('Failed to save state:', result.message);
 * }
 * 
 * @example
 * // Save unclicked state (for reset)
 * await saveWelcomeButtonState(false);
 */
export async function saveWelcomeButtonState(clicked, metadata = {}) {
  const stateFilePath = getStateFilePath();
  const stateDir = path.dirname(stateFilePath);
  const tempFilePath = `${stateFilePath}.tmp`;

  try {
    // Ensure state directory exists
    await fs.promises.mkdir(stateDir, { recursive: true });

    // Create state object
    const state = {
      clicked,
      timestamp: clicked ? new Date().toISOString() : null,
      windowsCreated: metadata.windowsCreated || null,
      version: STATE_VERSION
    };

    // Write to temporary file first (atomic write pattern)
    const stateJson = JSON.stringify(state, null, 2);
    await fs.promises.writeFile(tempFilePath, stateJson, 'utf-8');

    // Rename temp file to actual file (atomic operation on most systems)
    await fs.promises.rename(tempFilePath, stateFilePath);

    return {
      success: true
    };
  } catch (error) {
    console.error('[WELCOME_BUTTON] Failed to save state:', error.message);

    // Clean up temp file if it exists
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return {
      success: false,
      error: error.code || 'UNKNOWN_ERROR',
      message: error.message
    };
  }
}

