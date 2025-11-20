import fs from 'node:fs';
import path from 'node:path';
import { getGameDataDirectory } from './config.js';
import { getAllWindows } from './windowManager.js';
import { serializeWindow } from './windowStorage.js';
import '../../logger.js';

// Storage configuration
const STORAGE_DIR = '.fenestra-storage';
const SAVE_FILE_NAME = 'game-state.json';
const BACKUP_FILE_NAME = 'game-state.backup.json';
const STATE_VERSION = '1.0';

/**
 * Get the full path to the save file
 * @param {string} customPath - Optional custom save path
 * @returns {string} Full path to save file
 */
function getSaveFilePath(customPath = null) {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
  }
  
  const gameDataDir = getGameDataDirectory();
  const storageDir = path.join(gameDataDir, STORAGE_DIR);
  return path.join(storageDir, SAVE_FILE_NAME);
}

/**
 * Get the full path to the backup file
 * @returns {string} Full path to backup file
 */
function getBackupFilePath() {
  const gameDataDir = getGameDataDirectory();
  const storageDir = path.join(gameDataDir, STORAGE_DIR);
  return path.join(storageDir, BACKUP_FILE_NAME);
}

/**
 * Ensure storage directory exists
 * @returns {string} Storage directory path
 */
function ensureStorageDirectory() {
  const gameDataDir = getGameDataDirectory();
  const storageDir = path.join(gameDataDir, STORAGE_DIR);

  if (!fs.existsSync(storageDir)) {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
      console.log(`[GAME_STATE] Created storage directory: ${storageDir}`);
    } catch (error) {
      console.error(`[GAME_STATE] Failed to create storage directory:`, error);
      throw new Error(`Failed to create storage directory: ${error.message}`);
    }
  }

  return storageDir;
}

/**
 * Save complete game state to disk
 * @param {string} savePath - Optional custom save path
 * @returns {Promise<Object>} Save operation result
 */
export async function saveGameState(savePath = null) {
  console.log('[GAME_STATE] Starting game state save operation');
  
  try {
    // Ensure storage directory exists
    ensureStorageDirectory();
    
    // Get all windows
    const windows = getAllWindows();
    console.log(`[GAME_STATE] Found ${windows.size} windows to serialize`);
    
    // Serialize all windows
    const serializedWindows = [];
    for (const [windowId, win] of windows) {
      if (win.isDestroyed()) {
        console.warn(`[GAME_STATE] Window ${windowId} is destroyed, skipping`);
        continue;
      }
      
      try {
        const windowData = serializeWindow(windowId);
        if (windowData) {
          serializedWindows.push(windowData);
          console.debug(`[GAME_STATE] Serialized window: ${windowId}`);
        } else {
          console.warn(`[GAME_STATE] Failed to serialize window: ${windowId}`);
        }
      } catch (error) {
        console.error(`[GAME_STATE] Error serializing window ${windowId}:`, error);
        // Continue with other windows
      }
    }
    
    // Get door-key relationships (will be implemented in task 2)
    const relationships = exportRelationshipState();
    
    // Get game logic state (will be implemented in task 3)
    const gameLogicState = exportGameLogicState();
    
    // Build complete game state
    const gameState = {
      version: STATE_VERSION,
      timestamp: new Date().toISOString(),
      metadata: {
        windowCount: serializedWindows.length,
        relationshipCount: Object.keys(relationships.doorKeyRelations || {}).length,
        description: 'Fenestra game save'
      },
      windows: serializedWindows,
      relationships: relationships,
      gameLogic: gameLogicState
    };
    
    // Get save file path
    const saveFilePath = getSaveFilePath(savePath);
    
    // Write to file
    const jsonString = JSON.stringify(gameState, null, 2);
    fs.writeFileSync(saveFilePath, jsonString, 'utf8');
    
    console.log(`[GAME_STATE] Game state saved successfully to: ${saveFilePath}`);
    console.log(`[GAME_STATE] Saved ${serializedWindows.length} windows and ${Object.keys(relationships.doorKeyRelations || {}).length} relationships`);
    
    return {
      success: true,
      message: 'Game state saved successfully',
      filePath: saveFilePath,
      windowCount: serializedWindows.length,
      relationshipCount: Object.keys(relationships.doorKeyRelations || {}).length
    };
    
  } catch (error) {
    console.error('[GAME_STATE] Failed to save game state:', error);
    return {
      success: false,
      message: `Failed to save game state: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Load game state from disk
 * @param {string} savePath - Optional custom load path
 * @returns {Promise<Object>} Load operation result with state data
 */
export async function loadGameState(savePath = null) {
  console.log('[GAME_STATE] Starting game state load operation');
  
  try {
    const saveFilePath = getSaveFilePath(savePath);
    
    // Check if save file exists
    if (!fs.existsSync(saveFilePath)) {
      console.warn(`[GAME_STATE] Save file not found: ${saveFilePath}`);
      return {
        success: false,
        message: 'No saved game state found',
        notFound: true
      };
    }
    
    // Read save file
    const fileContent = fs.readFileSync(saveFilePath, 'utf8');
    
    // Parse JSON
    let gameState;
    try {
      gameState = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[GAME_STATE] Failed to parse save file JSON:', parseError);
      
      // Create backup of corrupted file
      await createBackupOfCorruptedFile(saveFilePath);
      
      return {
        success: false,
        message: 'Save file is corrupted (invalid JSON)',
        corrupted: true,
        error: parseError.message
      };
    }
    
    // Validate game state structure
    const validation = validateGameState(gameState);
    if (!validation.isValid) {
      console.error('[GAME_STATE] Invalid game state structure:', validation.errors);
      
      // Create backup of corrupted file
      await createBackupOfCorruptedFile(saveFilePath);
      
      return {
        success: false,
        message: `Invalid game state: ${validation.errors.join(', ')}`,
        corrupted: true,
        errors: validation.errors
      };
    }
    
    console.log(`[GAME_STATE] Game state loaded successfully`);
    console.log(`[GAME_STATE] Loaded ${gameState.windows?.length || 0} windows and ${Object.keys(gameState.relationships?.doorKeyRelations || {}).length} relationships`);
    
    return {
      success: true,
      message: 'Game state loaded successfully',
      data: gameState,
      filePath: saveFilePath,
      windowCount: gameState.windows?.length || 0,
      relationshipCount: Object.keys(gameState.relationships?.doorKeyRelations || {}).length
    };
    
  } catch (error) {
    console.error('[GAME_STATE] Failed to load game state:', error);
    return {
      success: false,
      message: `Failed to load game state: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check if saved game state exists
 * @returns {boolean} True if save file exists
 */
export function hasSavedState() {
  const saveFilePath = getSaveFilePath();
  const exists = fs.existsSync(saveFilePath);
  console.debug(`[GAME_STATE] Save file exists: ${exists}`);
  return exists;
}

/**
 * Get save file metadata
 * @returns {Object|null} Metadata including timestamp, window count, or null if no save exists
 */
export function getSaveMetadata() {
  console.debug('[GAME_STATE] Getting save file metadata');
  
  try {
    const saveFilePath = getSaveFilePath();
    
    if (!fs.existsSync(saveFilePath)) {
      console.debug('[GAME_STATE] No save file found');
      return null;
    }
    
    // Get file stats
    const stats = fs.statSync(saveFilePath);
    
    // Try to read and parse the file to get metadata
    try {
      const fileContent = fs.readFileSync(saveFilePath, 'utf8');
      const gameState = JSON.parse(fileContent);
      
      // Validate basic structure
      const validation = validateGameState(gameState);
      
      return {
        exists: true,
        timestamp: gameState.timestamp || stats.mtime.toISOString(),
        windowCount: gameState.windows?.length || 0,
        relationshipCount: Object.keys(gameState.relationships?.doorKeyRelations || {}).length,
        fileSize: stats.size,
        isValid: validation.isValid,
        filePath: saveFilePath
      };
      
    } catch (error) {
      // File exists but can't be parsed
      console.warn('[GAME_STATE] Save file exists but cannot be parsed:', error.message);
      return {
        exists: true,
        timestamp: stats.mtime.toISOString(),
        windowCount: 0,
        relationshipCount: 0,
        fileSize: stats.size,
        isValid: false,
        filePath: saveFilePath
      };
    }
    
  } catch (error) {
    console.error('[GAME_STATE] Error getting save metadata:', error);
    return null;
  }
}

/**
 * Delete saved game state
 * @returns {Promise<Object>} Delete operation result
 */
export async function deleteSavedState() {
  console.log('[GAME_STATE] Deleting saved game state');
  
  try {
    const saveFilePath = getSaveFilePath();
    
    if (!fs.existsSync(saveFilePath)) {
      console.warn('[GAME_STATE] No save file to delete');
      return {
        success: true,
        message: 'No save file exists',
        notFound: true
      };
    }
    
    // Delete the file
    fs.unlinkSync(saveFilePath);
    
    console.log(`[GAME_STATE] Save file deleted: ${saveFilePath}`);
    
    return {
      success: true,
      message: 'Save file deleted successfully',
      filePath: saveFilePath
    };
    
  } catch (error) {
    console.error('[GAME_STATE] Failed to delete save file:', error);
    return {
      success: false,
      message: `Failed to delete save file: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Validate game state structure
 * @param {Object} gameState - Game state to validate
 * @returns {Object} Validation result
 */
function validateGameState(gameState) {
  const errors = [];
  
  // Check required top-level fields
  if (!gameState) {
    errors.push('Game state is null or undefined');
    return { isValid: false, errors };
  }
  
  if (!gameState.version) {
    errors.push('Missing version field');
  }
  
  if (!gameState.timestamp) {
    errors.push('Missing timestamp field');
  }
  
  if (!gameState.metadata) {
    errors.push('Missing metadata field');
  }
  
  if (!gameState.windows) {
    errors.push('Missing windows field');
  } else if (!Array.isArray(gameState.windows)) {
    errors.push('Windows field must be an array');
  }
  
  if (!gameState.relationships) {
    errors.push('Missing relationships field');
  }
  
  // Version compatibility check
  if (gameState.version && gameState.version !== STATE_VERSION) {
    errors.push(`Version mismatch: expected ${STATE_VERSION}, got ${gameState.version}`);
  }
  
  const isValid = errors.length === 0;
  
  if (isValid) {
    console.debug('[GAME_STATE] Game state validation passed');
  } else {
    console.warn('[GAME_STATE] Game state validation failed:', errors);
  }
  
  return {
    isValid,
    errors
  };
}

/**
 * Create backup of corrupted save file
 * @param {string} saveFilePath - Path to corrupted save file
 * @returns {Promise<void>}
 */
async function createBackupOfCorruptedFile(saveFilePath) {
  try {
    const backupFilePath = getBackupFilePath();
    
    // Copy corrupted file to backup
    fs.copyFileSync(saveFilePath, backupFilePath);
    
    console.log(`[GAME_STATE] Created backup of corrupted file: ${backupFilePath}`);
  } catch (error) {
    console.error('[GAME_STATE] Failed to create backup of corrupted file:', error);
  }
}

/**
 * Export relationship state from door-key system
 * This is a placeholder that will be implemented in task 2
 * @returns {Object} Relationship state
 */
function exportRelationshipState() {
  // Placeholder - will be implemented in task 2
  console.debug('[GAME_STATE] Exporting relationship state (placeholder)');
  return {
    doorKeyRelations: {},
    keyDoorRelations: {},
    encryptedItems: [],
    doorStates: {},
    oneTimeKeys: {
      keys: [],
      usedKeys: [],
      closeAfterUse: []
    },
    multiKeyDoors: {}
  };
}

/**
 * Export game logic state
 * This is a placeholder that will be implemented in task 3
 * @returns {Object} Game logic state
 */
function exportGameLogicState() {
  // Placeholder - will be implemented in task 3
  console.debug('[GAME_STATE] Exporting game logic state (placeholder)');
  return {
    level1Completed: false
  };
}
