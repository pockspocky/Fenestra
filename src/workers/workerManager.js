import { Worker } from 'worker_threads';
import { getBounds, getAllWindows } from '../systems/windowManager.js';
import { canOpenDoor, handleFailedOpen, handleDoorToggle } from '../systems/doorKeySystem.js';
import { isLevel1Completed } from '../systems/gameLogic.js';
import '../../logger.js'; // Import logging system

let worker = null;
let overlapTimer = null;

/**
 * Initialize Worker
 */
export function initializeWorker() {
  worker = new Worker(new URL('../../nodeWorker.mjs', import.meta.url));
  
  // Worker message handler
  worker.on('message', (msg) => {
    console.debug('Received message from worker thread:', msg);
    
    if (msg.type === 'overlapResult') {
      const { ratio, doorId, keyId, threshold } = msg;
      console.debug(`[WORKER] Overlap ratio: ${ratio.toFixed(4)}`);
      
      if (ratio >= threshold) {
        // Check door opening permission
        if (canOpenDoor(doorId, keyId)) {
          console.log(`[LEVEL1] ${keyId} overlaps with ${doorId}, attempting to toggle door...`);
          handleDoorToggle(doorId, keyId);
        } else {
          console.warn(`[LEVEL1] ${keyId} cannot open ${doorId} (insufficient permission)`);
          handleFailedOpen(doorId, keyId);
        }
      }
    }
  });
  
  console.debug('[WORKER] Worker initialized');
}

/**
 * Start overlap detection loop
 */
export function startOverlapLoop() {
  if (overlapTimer) {
    console.debug('[OVERLAP] Overlap detection loop already running, skipping start');
    return;
  }

  console.debug('[OVERLAP] Setting up timer, checking every 1000ms');
  overlapTimer = setInterval(() => {
    // Check all doors and keys for overlap
    const windows = getAllWindows();

    for (const [doorId, doorWin] of windows) {
      // Use fRole property instead of ID string matching
      if (!doorWin || doorWin.fRole !== 'door') continue;

      for (const [keyId, keyWin] of windows) {
        // Use fRole property instead of ID string matching
        if (!keyWin || keyWin.fRole !== 'key') continue;

        const doorBounds = doorWin.getBounds();
        const keyBounds = keyWin.getBounds();

        // Send to Worker to calculate overlap
        if (worker) {
          worker.postMessage({
            type: 'calculateOverlap',
            doorBounds: doorBounds,
            keyBounds: keyBounds,
            doorId: doorId,
            keyId: keyId,
            threshold: 0.6
          });
        }
      }
    }
  }, 1000);

  console.debug('[OVERLAP] Overlap detection loop started');
}

/**
 * Stop overlap detection loop
 */
export function stopOverlapLoop() {
  if (overlapTimer) {
    clearInterval(overlapTimer);
    overlapTimer = null;
    console.debug('[OVERLAP] Overlap detection loop stopped');
  }
}

/**
 * Restart overlap detection loop
 */
export function restartOverlapLoop() {
  stopOverlapLoop();
  startOverlapLoop();
}

/**
 * Get Worker status
 * @returns {Object} Worker status information
 */
export function getWorkerStatus() {
  return {
    workerExists: worker !== null,
    timerExists: overlapTimer !== null,
    level1Completed: isLevel1Completed()
  };
}

/**
 * Clean up Worker resources
 */
export function cleanupWorker() {
  stopOverlapLoop();
  
  if (worker) {
    worker.terminate();
    worker = null;
    console.debug('[WORKER] Worker terminated');
  }
}

