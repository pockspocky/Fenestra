/**
 * Memory Leak Prevention System
 * 
 * Provides comprehensive memory management with automatic leak detection,
 * cleanup orchestration, configurable thresholds, and intelligent garbage collection.
 * 
 * @module memoryManager
 */

import '../../logger.js';

/**
 * Memory usage thresholds configuration
 */
const DEFAULT_THRESHOLDS = {
  warning: 100 * 1024 * 1024,    // 100MB
  critical: 200 * 1024 * 1024,   // 200MB
  cleanup: 150 * 1024 * 1024     // 150MB - trigger cleanup
};

/**
 * Memory monitoring intervals (milliseconds)
 */
const MONITORING_INTERVALS = {
  normal: 30000,     // 30 seconds
  warning: 10000,    // 10 seconds
  critical: 5000     // 5 seconds
};

/**
 * Memory Manager class for leak prevention and resource management
 */
class MemoryManager {
  constructor() {
    // Memory thresholds
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    
    // Cleanup handlers registry
    this.cleanupHandlers = new Map();
    
    // Event listener tracking
    this.eventListeners = new Map();
    
    // Memory monitoring
    this.monitoringTimer = null;
    this.currentInterval = MONITORING_INTERVALS.normal;
    this.lastMemoryCheck = null;
    
    // Memory usage history for leak detection
    this.memoryHistory = [];
    this.maxHistorySize = 20;
    
    // Component reference tracking
    this.componentReferences = new Map();
    
    // Garbage collection tracking
    this.lastGCTime = Date.now();
    this.gcThreshold = 60000; // 1 minute
    
    console.log('[MEMORY_MANAGER] Memory manager initialized');
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.monitoringTimer) {
      console.warn('[MEMORY_MANAGER] Monitoring already started');
      return;
    }

    console.log('[MEMORY_MANAGER] Starting memory monitoring');
    this._scheduleNextCheck();
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
      console.log('[MEMORY_MANAGER] Memory monitoring stopped');
    }
  }

  /**
   * Schedule next memory check
   * @private
   */
  _scheduleNextCheck() {
    this.monitoringTimer = setTimeout(() => {
      this._performMemoryCheck();
      this._scheduleNextCheck();
    }, this.currentInterval);
  }

  /**
   * Perform memory usage check and analysis
   * @private
   */
  _performMemoryCheck() {
    try {
      const memoryUsage = this.analyzeMemoryUsage();
      this.lastMemoryCheck = memoryUsage;
      
      // Add to history for leak detection
      this.memoryHistory.push({
        timestamp: Date.now(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      });
      
      // Trim history
      if (this.memoryHistory.length > this.maxHistorySize) {
        this.memoryHistory.shift();
      }
      
      // Check thresholds and adjust monitoring
      this._checkThresholds(memoryUsage);
      
      // Detect potential leaks
      this._detectMemoryLeaks();
      
      // Auto garbage collection if needed
      this._checkGarbageCollection(memoryUsage);
      
    } catch (error) {
      console.error('[MEMORY_MANAGER] Error during memory check:', error);
    }
  }

  /**
   * Analyze current memory usage
   * @returns {Object} Memory usage analysis
   */
  analyzeMemoryUsage() {
    const processMemory = process.memoryUsage();
    
    // Calculate component-specific memory estimates
    const componentMemory = {
      windows: this._estimateWindowsMemory(),
      callbacks: this._estimateCallbacksMemory(),
      eventListeners: this._estimateEventListenersMemory(),
      cache: this._estimateCacheMemory()
    };
    
    const totalComponentMemory = Object.values(componentMemory).reduce((sum, val) => sum + val, 0);
    
    return {
      timestamp: Date.now(),
      processMemory,
      componentMemory,
      totalComponentMemory,
      heapUsed: processMemory.heapUsed,
      heapTotal: processMemory.heapTotal,
      external: processMemory.external,
      rss: processMemory.rss,
      thresholds: { ...this.thresholds }
    };
  }

  /**
   * Estimate memory usage by windows
   * @private
   * @returns {number} Estimated memory in bytes
   */
  _estimateWindowsMemory() {
    // Return a conservative estimate since dynamic imports are complex
    // In real usage, this will be integrated with the actual window manager
    return 10 * 1024 * 1024; // 10MB estimate
  }

  /**
   * Estimate memory usage by callbacks
   * @private
   * @returns {number} Estimated memory in bytes
   */
  _estimateCallbacksMemory() {
    // Return a conservative estimate since dynamic imports are complex
    // In real usage, this will be integrated with the actual callback registry
    return 5 * 1024 * 1024; // 5MB estimate
  }

  /**
   * Estimate memory usage by event listeners
   * @private
   * @returns {number} Estimated memory in bytes
   */
  _estimateEventListenersMemory() {
    let totalListeners = 0;
    
    for (const listeners of this.eventListeners.values()) {
      totalListeners += listeners.size;
    }
    
    // Estimate ~500 bytes per event listener
    return totalListeners * 500;
  }

  /**
   * Estimate memory usage by caches
   * @private
   * @returns {number} Estimated memory in bytes
   */
  _estimateCacheMemory() {
    // This would need to be implemented based on actual cache implementations
    // For now, return a conservative estimate
    return 5 * 1024 * 1024; // 5MB estimate
  }

  /**
   * Check memory thresholds and adjust monitoring
   * @private
   * @param {Object} memoryUsage - Current memory usage
   */
  _checkThresholds(memoryUsage) {
    const heapUsed = memoryUsage.heapUsed;
    
    if (heapUsed >= this.thresholds.critical) {
      console.error('[MEMORY_MANAGER] CRITICAL memory usage detected', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.thresholds.critical / 1024 / 1024) + 'MB'
      });
      
      this.currentInterval = MONITORING_INTERVALS.critical;
      this.triggerCleanup('critical-memory');
      
    } else if (heapUsed >= this.thresholds.cleanup) {
      console.warn('[MEMORY_MANAGER] High memory usage, triggering cleanup', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.thresholds.cleanup / 1024 / 1024) + 'MB'
      });
      
      this.currentInterval = MONITORING_INTERVALS.warning;
      this.triggerCleanup('high-memory');
      
    } else if (heapUsed >= this.thresholds.warning) {
      console.warn('[MEMORY_MANAGER] Memory usage warning', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.thresholds.warning / 1024 / 1024) + 'MB'
      });
      
      this.currentInterval = MONITORING_INTERVALS.warning;
      
    } else {
      // Normal memory usage
      this.currentInterval = MONITORING_INTERVALS.normal;
    }
  }

  /**
   * Detect potential memory leaks
   * @returns {Array} Array of leak indicators
   */
  detectMemoryLeaks() {
    const leakIndicators = [];
    
    if (this.memoryHistory.length < 5) {
      return leakIndicators; // Need more data
    }
    
    // Check for consistent memory growth
    const recentHistory = this.memoryHistory.slice(-5);
    const growthTrend = this._calculateGrowthTrend(recentHistory);
    
    if (growthTrend.isIncreasing && growthTrend.averageGrowth > 5 * 1024 * 1024) {
      leakIndicators.push({
        type: 'consistent_growth',
        severity: 'high',
        description: `Memory consistently growing by ${Math.round(growthTrend.averageGrowth / 1024 / 1024)}MB per check`,
        data: growthTrend
      });
    }
    
    // Check for heap fragmentation
    const latest = recentHistory[recentHistory.length - 1];
    const heapUtilization = latest.heapUsed / latest.heapTotal;
    
    if (heapUtilization < 0.3 && latest.heapTotal > 100 * 1024 * 1024) {
      leakIndicators.push({
        type: 'heap_fragmentation',
        severity: 'medium',
        description: `Low heap utilization (${Math.round(heapUtilization * 100)}%) with large heap (${Math.round(latest.heapTotal / 1024 / 1024)}MB)`,
        data: { heapUtilization, heapTotal: latest.heapTotal }
      });
    }
    
    // Check for external memory growth
    if (latest.external > 50 * 1024 * 1024) {
      leakIndicators.push({
        type: 'external_memory_high',
        severity: 'medium',
        description: `High external memory usage: ${Math.round(latest.external / 1024 / 1024)}MB`,
        data: { external: latest.external }
      });
    }
    
    if (leakIndicators.length > 0) {
      console.warn('[MEMORY_MANAGER] Potential memory leaks detected:', leakIndicators);
    }
    
    return leakIndicators;
  }

  /**
   * Calculate memory growth trend
   * @private
   * @param {Array} history - Memory history data
   * @returns {Object} Growth trend analysis
   */
  _calculateGrowthTrend(history) {
    if (history.length < 2) {
      return { isIncreasing: false, averageGrowth: 0 };
    }
    
    let totalGrowth = 0;
    let increasingCount = 0;
    
    for (let i = 1; i < history.length; i++) {
      const growth = history[i].heapUsed - history[i - 1].heapUsed;
      totalGrowth += growth;
      
      if (growth > 0) {
        increasingCount++;
      }
    }
    
    const averageGrowth = totalGrowth / (history.length - 1);
    const isIncreasing = increasingCount >= (history.length - 1) * 0.7; // 70% of checks show growth
    
    return { isIncreasing, averageGrowth, increasingCount };
  }

  /**
   * Check if garbage collection should be triggered
   * @private
   * @param {Object} memoryUsage - Current memory usage
   */
  _checkGarbageCollection(memoryUsage) {
    const now = Date.now();
    const timeSinceLastGC = now - this.lastGCTime;
    
    // Trigger GC if memory is high and enough time has passed
    if (timeSinceLastGC > this.gcThreshold && 
        memoryUsage.heapUsed > this.thresholds.warning) {
      
      console.log('[MEMORY_MANAGER] Triggering garbage collection');
      this.forceGarbageCollection();
    }
  }

  /**
   * Register a cleanup handler for a component
   * @param {string} component - Component identifier
   * @param {Function} handler - Cleanup function
   * @returns {string} Registration ID
   */
  registerCleanupHandler(component, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Cleanup handler must be a function');
    }
    
    const registrationId = `cleanup_${component}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.cleanupHandlers.set(registrationId, {
      component,
      handler,
      registeredAt: Date.now()
    });
    
    console.debug('[MEMORY_MANAGER] Cleanup handler registered', {
      registrationId,
      component
    });
    
    return registrationId;
  }

  /**
   * Unregister a cleanup handler
   * @param {string} registrationId - Registration ID
   * @returns {boolean} True if handler was found and removed
   */
  unregisterCleanupHandler(registrationId) {
    const removed = this.cleanupHandlers.delete(registrationId);
    
    if (removed) {
      console.debug('[MEMORY_MANAGER] Cleanup handler unregistered', { registrationId });
    }
    
    return removed;
  }

  /**
   * Trigger cleanup for specific component or all components
   * @param {string} [component] - Component to clean up, or null for all
   * @returns {Object} Cleanup results
   */
  triggerCleanup(component = null) {
    console.log('[MEMORY_MANAGER] Triggering cleanup', { component });
    
    const results = {
      executed: 0,
      errors: [],
      components: []
    };
    
    for (const [registrationId, registration] of this.cleanupHandlers) {
      if (component && registration.component !== component) {
        continue; // Skip if specific component requested and this isn't it
      }
      
      try {
        console.debug('[MEMORY_MANAGER] Executing cleanup handler', {
          registrationId,
          component: registration.component
        });
        
        registration.handler();
        results.executed++;
        results.components.push(registration.component);
        
      } catch (error) {
        console.error('[MEMORY_MANAGER] Cleanup handler error', {
          registrationId,
          component: registration.component,
          error: error.message
        });
        
        results.errors.push({
          registrationId,
          component: registration.component,
          error: error.message
        });
      }
    }
    
    console.log('[MEMORY_MANAGER] Cleanup completed', {
      executed: results.executed,
      errors: results.errors.length,
      components: results.components
    });
    
    return results;
  }

  /**
   * Track event listener registration
   * @param {string} component - Component that registered the listener
   * @param {Object} target - Event target (window, element, etc.)
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {string} Tracking ID
   */
  trackEventListener(component, target, event, listener) {
    const trackingId = `listener_${component}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.eventListeners.has(component)) {
      this.eventListeners.set(component, new Set());
    }
    
    this.eventListeners.get(component).add({
      trackingId,
      target,
      event,
      listener,
      registeredAt: Date.now()
    });
    
    console.debug('[MEMORY_MANAGER] Event listener tracked', {
      trackingId,
      component,
      event
    });
    
    return trackingId;
  }

  /**
   * Untrack event listener
   * @param {string} component - Component identifier
   * @param {string} trackingId - Tracking ID
   * @returns {boolean} True if listener was found and removed
   */
  untrackEventListener(component, trackingId) {
    const listeners = this.eventListeners.get(component);
    if (!listeners) {
      return false;
    }
    
    for (const listener of listeners) {
      if (listener.trackingId === trackingId) {
        listeners.delete(listener);
        console.debug('[MEMORY_MANAGER] Event listener untracked', {
          trackingId,
          component
        });
        return true;
      }
    }
    
    return false;
  }

  /**
   * Clean up all event listeners for a component
   * @param {string} component - Component identifier
   * @returns {number} Number of listeners cleaned up
   */
  cleanupEventListeners(component) {
    const listeners = this.eventListeners.get(component);
    if (!listeners) {
      return 0;
    }
    
    let cleaned = 0;
    
    for (const listener of listeners) {
      try {
        if (listener.target && typeof listener.target.removeEventListener === 'function') {
          listener.target.removeEventListener(listener.event, listener.listener);
        } else if (listener.target && typeof listener.target.removeListener === 'function') {
          listener.target.removeListener(listener.event, listener.listener);
        }
        
        cleaned++;
        
      } catch (error) {
        console.error('[MEMORY_MANAGER] Error cleaning up event listener', {
          trackingId: listener.trackingId,
          component,
          error: error.message
        });
      }
    }
    
    this.eventListeners.delete(component);
    
    console.log('[MEMORY_MANAGER] Event listeners cleaned up', {
      component,
      cleaned
    });
    
    return cleaned;
  }

  /**
   * Force garbage collection
   */
  forceGarbageCollection() {
    try {
      if (global.gc) {
        console.log('[MEMORY_MANAGER] Forcing garbage collection');
        global.gc();
        this.lastGCTime = Date.now();
        
        // Log memory usage after GC
        setTimeout(() => {
          const memoryAfterGC = process.memoryUsage();
          console.log('[MEMORY_MANAGER] Memory after GC', {
            heapUsed: Math.round(memoryAfterGC.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryAfterGC.heapTotal / 1024 / 1024) + 'MB'
          });
        }, 100);
        
      } else {
        console.warn('[MEMORY_MANAGER] Garbage collection not available (run with --expose-gc)');
      }
    } catch (error) {
      console.error('[MEMORY_MANAGER] Error forcing garbage collection:', error);
    }
  }

  /**
   * Set memory usage thresholds
   * @param {Object} thresholds - Threshold configuration
   * @param {number} [thresholds.warning] - Warning threshold in bytes
   * @param {number} [thresholds.critical] - Critical threshold in bytes
   * @param {number} [thresholds.cleanup] - Cleanup trigger threshold in bytes
   */
  setMemoryThresholds(thresholds) {
    if (thresholds.warning !== undefined) {
      this.thresholds.warning = thresholds.warning;
    }
    if (thresholds.critical !== undefined) {
      this.thresholds.critical = thresholds.critical;
    }
    if (thresholds.cleanup !== undefined) {
      this.thresholds.cleanup = thresholds.cleanup;
    }
    
    console.log('[MEMORY_MANAGER] Memory thresholds updated', {
      warning: Math.round(this.thresholds.warning / 1024 / 1024) + 'MB',
      critical: Math.round(this.thresholds.critical / 1024 / 1024) + 'MB',
      cleanup: Math.round(this.thresholds.cleanup / 1024 / 1024) + 'MB'
    });
  }

  /**
   * Generate memory usage report
   * @returns {Object} Comprehensive memory report
   */
  generateMemoryReport() {
    const currentUsage = this.analyzeMemoryUsage();
    const leakIndicators = this.detectMemoryLeaks();
    
    return {
      timestamp: Date.now(),
      currentUsage,
      leakIndicators,
      thresholds: { ...this.thresholds },
      monitoring: {
        isActive: this.monitoringTimer !== null,
        currentInterval: this.currentInterval,
        lastCheck: this.lastMemoryCheck
      },
      cleanup: {
        handlersRegistered: this.cleanupHandlers.size,
        componentsTracked: Array.from(this.cleanupHandlers.values()).map(h => h.component)
      },
      eventListeners: {
        componentsTracked: this.eventListeners.size,
        totalListeners: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0)
      },
      history: {
        dataPoints: this.memoryHistory.length,
        oldestTimestamp: this.memoryHistory.length > 0 ? this.memoryHistory[0].timestamp : null,
        newestTimestamp: this.memoryHistory.length > 0 ? this.memoryHistory[this.memoryHistory.length - 1].timestamp : null
      }
    };
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Current memory statistics
   */
  getCurrentMemoryStats() {
    return this.lastMemoryCheck || this.analyzeMemoryUsage();
  }

  /**
   * Perform immediate memory leak detection
   * @private
   */
  _detectMemoryLeaks() {
    const leakIndicators = this.detectMemoryLeaks();
    
    if (leakIndicators.length > 0) {
      // Log leak detection results
      console.warn('[MEMORY_MANAGER] Memory leak detection results:', {
        leaksDetected: leakIndicators.length,
        indicators: leakIndicators.map(indicator => ({
          type: indicator.type,
          severity: indicator.severity,
          description: indicator.description
        }))
      });
      
      // Trigger cleanup for high severity leaks
      const highSeverityLeaks = leakIndicators.filter(leak => leak.severity === 'high');
      if (highSeverityLeaks.length > 0) {
        console.warn('[MEMORY_MANAGER] High severity leaks detected, triggering cleanup');
        this.triggerCleanup();
      }
    }
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();

// Export class for testing
export { MemoryManager };