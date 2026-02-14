/**
 * Lens Window System
 * Manages synchronization between lens windows and content windows
 */

import '../../logger.js';
import {
  triggerLensCreated,
  triggerLensMoved,
  triggerLensDestroyed,
  triggerLensTrackingStarted,
  triggerLensTrackingStopped
} from '../core/callbacks/lensCallbacks.js';

// Store lens system mapping relationships
const lensSystems = new Map(); // lensId -> { lensWindow, targetWindow, targetWindowId }

/**
 * Register lens system
 * @param {string} lensId - Lens window ID
 * @param {BrowserWindow} lensWindow - Lens window object
 * @param {string} targetWindowId - Target window ID
 * @param {BrowserWindow} targetWindow - Target window object
 */
export function registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow) {
  console.log(`[LENS_SYS] Registering lens system: ${lensId} -> ${targetWindowId}`);
  
  if (lensSystems.has(lensId)) {
    console.warn(`[LENS_SYS] Lens ${lensId} already exists, will be overwritten`);
  }

  const system = {
    lensWindow,
    targetWindow,
    targetWindowId,
    isTracking: false,
    moveListener: null,
  };

  lensSystems.set(lensId, system);
  
  // Trigger lens created callback
  triggerLensCreated(lensId, {
    targetWindowId,
    lensWindow,
    targetWindow
  });
  
  // Start position tracking
  startPositionTracking(lensId, system);

  console.log(`[LENS_SYS] Lens system registered successfully, current total: ${lensSystems.size}`);
}

/**
 * Unregister lens system
 * @param {string} lensId - Lens window ID
 */
export function unregisterLensSystem(lensId) {
  console.log(`[LENS_SYS] Unregistering lens system: ${lensId}`);
  
  const system = lensSystems.get(lensId);
  if (!system) {
    console.warn(`[LENS_SYS] Lens ${lensId} does not exist`);
    return;
  }

  // Stop position tracking
  stopPositionTracking(lensId, system);

  // Trigger lens destroyed callback
  triggerLensDestroyed(lensId);

  lensSystems.delete(lensId);
  console.log(`[LENS_SYS] Lens system unregistered successfully, current total: ${lensSystems.size}`);
}

/**
 * Get lens system information
 * @param {string} lensId - Lens window ID
 * @returns {Object|null} Lens system information
 */
export function getLensSystemInfo(lensId) {
  const system = lensSystems.get(lensId);
  if (!system) {
    return null;
  }

  const { lensWindow, targetWindow, targetWindowId } = system;

  if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
    console.warn(`[LENS_SYS] Lens or target window destroyed: ${lensId}`);
    unregisterLensSystem(lensId);
    return null;
  }

  return {
    lensId,
    targetWindowId,
    lensBounds: lensWindow.getBounds(),
    targetBounds: targetWindow.getBounds(),
    isTracking: system.isTracking,
  };
}

/**
 * Get all lens systems
 * @returns {Array} Lens system list
 */
export function getAllLensSystems() {
  const systems = [];
  
  for (const [lensId, system] of lensSystems.entries()) {
    const info = getLensSystemInfo(lensId);
    if (info) {
      systems.push(info);
    }
  }

  return systems;
}

/**
 * Start position tracking
 * @param {string} lensId - Lens window ID
 * @param {Object} system - Lens system object
 */
function startPositionTracking(lensId, system) {
  if (system.isTracking) {
    console.warn(`[LENS_SYS] Lens ${lensId} is already being tracked`);
    return;
  }

  const { lensWindow, targetWindow } = system;

  // Listen for lens window movement
  const lensMoveListener = () => {
    if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
      stopPositionTracking(lensId, system);
      return;
    }

    const lensBounds = lensWindow.getBounds();
    const targetBounds = targetWindow.getBounds();

    // Calculate relative position
    const relativeX = lensBounds.x - targetBounds.x;
    const relativeY = lensBounds.y - targetBounds.y;

    console.debug(`[LENS_SYS] Lens ${lensId} moved: relative position (${relativeX}, ${relativeY})`);

    // Trigger lens moved callback
    triggerLensMoved(lensId, {
      x: lensBounds.x,
      y: lensBounds.y,
      relativeX,
      relativeY
    });

    // Notify lens window to update display area
    if (!lensWindow.isDestroyed()) {
      lensWindow.webContents.send('lens-position-update', {
        lensBounds,
        targetBounds,
        relativeX,
        relativeY,
      });
    }
  };

  // Listen for target window movement
  const targetMoveListener = () => {
    if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
      stopPositionTracking(lensId, system);
      return;
    }

    const targetBounds = targetWindow.getBounds();

    console.debug(`[LENS_SYS] Target window ${system.targetWindowId} moved`);

    // Notify lens window that target window has moved
    if (!lensWindow.isDestroyed()) {
      lensWindow.webContents.send('target-window-move', {
        windowId: system.targetWindowId,
        bounds: targetBounds,
      });
    }
  };

  // Register event listeners
  lensWindow.on('move', lensMoveListener);
  lensWindow.on('moved', lensMoveListener); // macOS uses 'moved'
  targetWindow.on('move', targetMoveListener);
  targetWindow.on('moved', targetMoveListener);

  // Save listener references
  system.moveListener = {
    lensMove: lensMoveListener,
    targetMove: targetMoveListener,
  };

  system.isTracking = true;
  console.log(`[LENS_SYS] Lens ${lensId} started position tracking`);

  // Trigger lens tracking started callback
  triggerLensTrackingStarted(lensId);

  // Trigger an immediate update
  lensMoveListener();
}

/**
 * Stop position tracking
 * @param {string} lensId - Lens window ID
 * @param {Object} system - Lens system object
 */
function stopPositionTracking(lensId, system) {
  if (!system.isTracking) {
    return;
  }

  const { lensWindow, targetWindow, moveListener } = system;

  // Remove event listeners
  if (moveListener && !lensWindow.isDestroyed()) {
    lensWindow.removeListener('move', moveListener.lensMove);
    lensWindow.removeListener('moved', moveListener.lensMove);
  }

  if (moveListener && !targetWindow.isDestroyed()) {
    targetWindow.removeListener('move', moveListener.targetMove);
    targetWindow.removeListener('moved', moveListener.targetMove);
  }

  system.isTracking = false;
  system.moveListener = null;

  // Trigger lens tracking stopped callback
  triggerLensTrackingStopped(lensId);

  console.log(`[LENS_SYS] Lens ${lensId} stopped position tracking`);
}

/**
 * Get current lens system count
 * @returns {number} Lens count
 */
export function getLensSystemCount() {
  return lensSystems.size;
}

/**
 * Check if lens ID already exists
 * @param {string} lensId - Lens window ID
 * @returns {boolean} Whether it exists
 */
export function lensSystemExists(lensId) {
  return lensSystems.has(lensId);
}


