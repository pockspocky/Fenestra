import { createDoor, createKey, getAllWindows } from './windowManager.js';
import { initializeDoorRelation, initializeKeyRelation, addEncryptedItem } from './doorKeySystem.js';
import { triggerStateReset, triggerLevelCompleted, triggerStateExported } from '../core/callbacks/gameStateCallbacks.js';
import '../../logger.js'; // Import logging system

// Game state
let level1Completed = false;

/**
 * Initialize game logic
 */
export function initializeGameLogic() {
  console.log('[GAME] Game logic initialized');
}

/**
 * Handle video window close event
 * @param {string} windowId - Window ID
 */
export function handleVideoWindowClosed(windowId) {
  if (windowId === 'video' && !level1Completed) {
    console.log('[GAME] Video window closed, triggering level 1 logic');
    
    const windows = getAllWindows();
    
    if (!windows.has('door1')) {
      console.debug('[GAME] Creating door window');
      createDoor('door1', 'Main Door', false, {
        initialState: 'closed',
        isLocked: false
      });
      initializeDoorRelation('door1');
    } else {
      console.debug('[GAME] Door window already exists, skipping creation');
    }
    
    if (!windows.has('key1')) {
      console.debug('[GAME] Creating key window');
      createKey('key1', 'Master Key', false);
      initializeKeyRelation('key1');
    } else {
      console.debug('[GAME] Key window already exists, skipping creation');
    }
  }
}

/**
 * Create demo doors and keys
 */
export function createDemoDoorsAndKeys() {
  console.log('[DEMO] Creating demo doors and keys...');
  
  // Create encrypted doors and corresponding keys
  createDoor('door1', 'Main Door (locked)', false, {
    initialState: 'closed',
    isLocked: true
  });
  
  createDoor('door2', 'Secret Room (locked)', true, {
    initialState: 'closed',
    isLocked: true
  });
  
  createDoor('door3', 'Back Door (locked)', true, {
    initialState: 'closed',
    isLocked: true
  });

  // Initialize door relationships
  initializeDoorRelation('door1');
  initializeDoorRelation('door2');
  initializeDoorRelation('door3');
  
  // Add encrypted items
  addEncryptedItem('door2');
  addEncryptedItem('door3');

  // Create keys
  createKey('key2', 'Secret Key', true, ['door2']);
  createKey('key3', 'Multi Key', true, ['door2', 'door3']);
  
  // Initialize key relationships
  initializeKeyRelation('key2', ['door2']);
  initializeKeyRelation('key3', ['door2', 'door3']);
  addEncryptedItem('key2');
  addEncryptedItem('key3');
  
  console.log('[DEMO] Demo doors and keys created successfully');
}

/**
 * Get level 1 completion status
 * @returns {boolean} Whether completed
 */
export function isLevel1Completed() {
  return level1Completed;
}

/**
 * Set level 1 completion status
 * @param {boolean} completed - Whether completed
 */
export function setLevel1Completed(completed) {
  const wasCompleted = level1Completed;
  level1Completed = completed;
  
  // Trigger level-completed callback if level was just completed
  if (completed && !wasCompleted) {
    triggerLevelCompleted('level-1', { completed: true });
  }
}

/**
 * Reset game state
 */
export function resetGameState() {
  level1Completed = false;
  console.log('[GAME] Game state reset');
  
  // Trigger state-reset callback
  triggerStateReset();
}

/**
 * Get game state information
 * @returns {Object} Game state
 */
export function getGameState() {
  return {
    level1Completed,
    windowsCount: getAllWindows().size
  };
}

/**
 * Export game logic state for serialization
 * @returns {Object} Complete game logic state
 */
export function exportGameLogicState() {
  console.log('[GAME] Exporting game logic state');
  
  const state = {
    level1Completed
  };
  
  console.log('[GAME] Game logic state exported', { state });
  
  // Trigger state-exported callback
  triggerStateExported({ exportedState: state });
  
  return state;
}

/**
 * Import and restore game logic state
 * @param {Object} state - Previously exported game logic state
 * @returns {void}
 */
export function importGameLogicState(state) {
  console.log('[GAME] Importing game logic state', { state });
  
  if (!state || typeof state !== 'object') {
    console.warn('[GAME] Invalid game logic state provided, skipping import');
    return;
  }
  
  // Restore level completion status
  if (typeof state.level1Completed === 'boolean') {
    level1Completed = state.level1Completed;
    console.log('[GAME] Restored level1Completed:', level1Completed);
  }
  
  console.log('[GAME] Game logic state imported successfully');
}

