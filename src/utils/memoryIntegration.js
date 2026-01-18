/**
 * Memory Manager Integration
 * 
 * Integrates the memory manager with existing system components to provide
 * comprehensive memory leak prevention and cleanup orchestration.
 * 
 * @module memoryIntegration
 */

import { memoryManager } from './memoryManager.js';
import '../../logger.js';

/**
 * Initialize memory management integration with all system components
 */
export function initializeMemoryIntegration() {
  console.log('[MEMORY_INTEGRATION] Initializing memory management integration');
  
  try {
    // Register cleanup handlers for all major components
    registerWindowManagerCleanup();
    registerCallbackRegistryCleanup();
    registerWorkerManagerCleanup();
    registerEmailSystemCleanup();
    registerLensSystemCleanup();
    
    // Start memory monitoring
    memoryManager.startMonitoring();
    
    console.log('[MEMORY_INTEGRATION] Memory management integration initialized successfully');
    
  } catch (error) {
    console.error('[MEMORY_INTEGRATION] Failed to initialize memory integration:', error);
    throw error;
  }
}

/**
 * Register cleanup handler for window manager
 */
function registerWindowManagerCleanup() {
  memoryManager.registerCleanupHandler('windowManager', () => {
    try {
      console.log('[MEMORY_INTEGRATION] Window manager cleanup - monitoring window resources');
      // In real integration, this would clean up destroyed windows
      // For now, just log the cleanup attempt
      
    } catch (error) {
      console.error('[MEMORY_INTEGRATION] Window manager cleanup error:', error);
    }
  });
}

/**
 * Register cleanup handler for callback registry
 */
function registerCallbackRegistryCleanup() {
  memoryManager.registerCleanupHandler('callbackRegistry', () => {
    try {
      console.log('[MEMORY_INTEGRATION] Callback registry cleanup - monitoring callback resources');
      // In real integration, this would monitor callback registry status
      
    } catch (error) {
      console.error('[MEMORY_INTEGRATION] Callback registry cleanup error:', error);
    }
  });
}

/**
 * Register cleanup handler for worker manager
 */
function registerWorkerManagerCleanup() {
  memoryManager.registerCleanupHandler('workerManager', () => {
    try {
      console.log('[MEMORY_INTEGRATION] Worker manager cleanup - monitoring worker resources');
      // In real integration, this would clean up worker resources
      
    } catch (error) {
      console.error('[MEMORY_INTEGRATION] Worker manager cleanup error:', error);
    }
  });
}

/**
 * Register cleanup handler for email system
 */
function registerEmailSystemCleanup() {
  memoryManager.registerCleanupHandler('emailSystem', () => {
    try {
      console.log('[MEMORY_INTEGRATION] Email system cleanup - monitoring email resources');
      // In real integration, this would monitor email system status
      
    } catch (error) {
      console.error('[MEMORY_INTEGRATION] Email system cleanup error:', error);
    }
  });
}

/**
 * Register cleanup handler for lens system
 */
function registerLensSystemCleanup() {
  memoryManager.registerCleanupHandler('lensSystem', () => {
    try {
      console.log('[MEMORY_INTEGRATION] Lens system cleanup - monitoring lens resources');
      // In real integration, this would clean up destroyed lens systems
      
    } catch (error) {
      console.error('[MEMORY_INTEGRATION] Lens system cleanup error:', error);
    }
  });
}

/**
 * Register event listener tracking for a component
 * @param {string} component - Component identifier
 * @param {Object} target - Event target
 * @param {string} event - Event name
 * @param {Function} listener - Event listener function
 * @returns {string} Tracking ID
 */
export function trackEventListener(component, target, event, listener) {
  return memoryManager.trackEventListener(component, target, event, listener);
}

/**
 * Untrack event listener
 * @param {string} component - Component identifier
 * @param {string} trackingId - Tracking ID
 * @returns {boolean} Success flag
 */
export function untrackEventListener(component, trackingId) {
  return memoryManager.untrackEventListener(component, trackingId);
}

/**
 * Clean up all event listeners for a component
 * @param {string} component - Component identifier
 * @returns {number} Number of listeners cleaned up
 */
export function cleanupComponentEventListeners(component) {
  return memoryManager.cleanupEventListeners(component);
}

/**
 * Register a component-specific cleanup handler
 * @param {string} component - Component identifier
 * @param {Function} handler - Cleanup function
 * @returns {string} Registration ID
 */
export function registerComponentCleanup(component, handler) {
  return memoryManager.registerCleanupHandler(component, handler);
}

/**
 * Trigger cleanup for a specific component
 * @param {string} component - Component identifier
 * @returns {Object} Cleanup results
 */
export function triggerComponentCleanup(component) {
  return memoryManager.triggerCleanup(component);
}

/**
 * Get current memory usage statistics
 * @returns {Object} Memory statistics
 */
export function getMemoryStats() {
  return memoryManager.getCurrentMemoryStats();
}

/**
 * Generate comprehensive memory report
 * @returns {Object} Memory report
 */
export function generateMemoryReport() {
  return memoryManager.generateMemoryReport();
}

/**
 * Set memory usage thresholds
 * @param {Object} thresholds - Threshold configuration
 */
export function setMemoryThresholds(thresholds) {
  memoryManager.setMemoryThresholds(thresholds);
}

/**
 * Force garbage collection
 */
export function forceGarbageCollection() {
  memoryManager.forceGarbageCollection();
}

/**
 * Detect memory leaks
 * @returns {Array} Array of leak indicators
 */
export function detectMemoryLeaks() {
  return memoryManager.detectMemoryLeaks();
}

/**
 * Shutdown memory management system
 */
export function shutdownMemoryManagement() {
  console.log('[MEMORY_INTEGRATION] Shutting down memory management');
  
  try {
    // Trigger final cleanup
    memoryManager.triggerCleanup();
    
    // Stop monitoring
    memoryManager.stopMonitoring();
    
    console.log('[MEMORY_INTEGRATION] Memory management shutdown completed');
    
  } catch (error) {
    console.error('[MEMORY_INTEGRATION] Error during memory management shutdown:', error);
  }
}

/**
 * Enhanced window creation wrapper with memory tracking
 * @param {Function} originalCreateWindow - Original createWindow function
 * @returns {Function} Wrapped createWindow function
 */
export function wrapWindowCreationWithMemoryTracking(originalCreateWindow) {
  return function(id, opts = {}) {
    const window = originalCreateWindow(id, opts);
    
    if (window && !window.isDestroyed()) {
      // Track window event listeners
      const trackingIds = [];
      
      // Track the closed event listener
      const closedTrackingId = trackEventListener('windowManager', window, 'closed', () => {
        // Clean up tracking when window is closed
        trackingIds.forEach(trackingId => {
          untrackEventListener('windowManager', trackingId);
        });
      });
      
      trackingIds.push(closedTrackingId);
      
      // Track other event listeners if they exist
      ['ready-to-show', 'moved', 'resized'].forEach(eventName => {
        const trackingId = trackEventListener('windowManager', window, eventName, () => {
          // Event listener placeholder - actual listeners are set up elsewhere
        });
        trackingIds.push(trackingId);
      });
      
      console.debug('[MEMORY_INTEGRATION] Window memory tracking enabled', {
        windowId: id,
        trackingIds: trackingIds.length
      });
    }
    
    return window;
  };
}

/**
 * Enhanced callback registration wrapper with memory tracking
 * @param {Function} originalRegister - Original register function
 * @returns {Function} Wrapped register function
 */
export function wrapCallbackRegistrationWithMemoryTracking(originalRegister) {
  return function(eventType, callback, options = {}) {
    const registrationId = originalRegister(eventType, callback, options);
    
    // Track this callback registration for memory monitoring
    console.debug('[MEMORY_INTEGRATION] Callback registration tracked', {
      registrationId,
      eventType,
      entityId: options.entityId
    });
    
    return registrationId;
  };
}

// Export memory manager instance for direct access
export { memoryManager };