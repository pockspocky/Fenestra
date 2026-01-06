/**
 * Performance Monitoring System
 * 
 * Provides performance metrics collection, slow operation detection,
 * and configurable thresholds with action callback integration.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enabled = options.enabled !== false;
    this.samplingRate = options.samplingRate || 1.0;
    
    // Performance thresholds (in milliseconds)
    this.thresholds = {
      slow: options.thresholds?.slow || 100,
      warning: options.thresholds?.warning || 500,
      critical: options.thresholds?.critical || 1000,
      ...options.thresholds
    };
    
    // Metrics storage
    this.metrics = new Map(); // operation -> metrics array
    this.activeOperations = new Map(); // operationId -> start info
    this.aggregatedMetrics = new Map(); // operation -> aggregated stats
    
    // Configuration
    this.maxMetricsPerOperation = options.maxMetricsPerOperation || 1000;
    this.aggregationInterval = options.aggregationInterval || 60000; // 1 minute
    
    this.logger = options.logger;
    this.actionCallbacks = options.actionCallbacks;
    
    // Start aggregation timer
    if (this.enabled) {
      this.aggregationTimer = setInterval(() => {
        this._aggregateMetrics();
      }, this.aggregationInterval);
    }
    
    this.logger?.debug('[PerformanceMonitor] Initialized', {
      enabled: this.enabled,
      samplingRate: this.samplingRate,
      thresholds: this.thresholds
    });
  }

  /**
   * Start monitoring an operation
   * @param {string} operation - Operation name
   * @param {Object} context - Additional context
   * @returns {string} Operation ID for tracking
   */
  startOperation(operation, context = {}) {
    if (!this.enabled || !this._shouldSample()) {
      return null;
    }
    
    const operationId = this._generateOperationId();
    const startTime = performance.now();
    
    const operationInfo = {
      id: operationId,
      operation,
      startTime,
      context: { ...context },
      timestamp: Date.now()
    };
    
    this.activeOperations.set(operationId, operationInfo);
    
    this.logger?.debug('[PerformanceMonitor] Started monitoring operation', {
      operationId,
      operation,
      context
    });
    
    return operationId;
  }

  /**
   * End monitoring an operation
   * @param {string} operationId - Operation ID from startOperation
   * @param {Object} result - Operation result info
   */
  endOperation(operationId, result = {}) {
    if (!operationId || !this.activeOperations.has(operationId)) {
      return;
    }
    
    const operationInfo = this.activeOperations.get(operationId);
    const endTime = performance.now();
    const duration = endTime - operationInfo.startTime;
    
    const metric = {
      operation: operationInfo.operation,
      duration,
      timestamp: operationInfo.timestamp,
      context: operationInfo.context,
      result: { ...result },
      threshold: this._getThresholdLevel(duration)
    };
    
    // Store metric
    this._storeMetric(metric);
    
    // Check thresholds and emit warnings
    this._checkThresholds(metric);
    
    // Clean up active operation
    this.activeOperations.delete(operationId);
    
    this.logger?.debug('[PerformanceMonitor] Completed operation monitoring', {
      operationId,
      operation: operationInfo.operation,
      duration,
      threshold: metric.threshold
    });
  }

  /**
   * Record a completed operation directly
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} context - Additional context
   */
  recordOperation(operation, duration, context = {}) {
    if (!this.enabled || !this._shouldSample()) {
      return;
    }
    
    const metric = {
      operation,
      duration,
      timestamp: Date.now(),
      context: { ...context },
      threshold: this._getThresholdLevel(duration)
    };
    
    this._storeMetric(metric);
    this._checkThresholds(metric);
    
    this.logger?.debug('[PerformanceMonitor] Recorded operation', {
      operation,
      duration,
      threshold: metric.threshold
    });
  }

  /**
   * Get performance statistics for an operation
   * @param {string} operation - Operation name
   * @returns {Object} Performance statistics
   */
  getOperationStats(operation) {
    const metrics = this.metrics.get(operation) || [];
    const aggregated = this.aggregatedMetrics.get(operation);
    
    if (metrics.length === 0) {
      return {
        operation,
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        thresholdBreaches: {
          slow: 0,
          warning: 0,
          critical: 0
        }
      };
    }
    
    const durations = metrics.map(m => m.duration);
    const thresholdBreaches = {
      slow: metrics.filter(m => m.threshold === 'slow').length,
      warning: metrics.filter(m => m.threshold === 'warning').length,
      critical: metrics.filter(m => m.threshold === 'critical').length
    };
    
    const stats = {
      operation,
      count: metrics.length,
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      thresholdBreaches,
      recentMetrics: metrics.slice(-10) // Last 10 metrics
    };
    
    // Include aggregated data if available
    if (aggregated) {
      stats.aggregated = aggregated;
    }
    
    return stats;
  }

  /**
   * Get overall performance statistics
   * @returns {Object} Overall statistics
   */
  getOverallStats() {
    const operations = Array.from(this.metrics.keys());
    const totalMetrics = Array.from(this.metrics.values()).flat();
    
    const stats = {
      totalOperations: operations.length,
      totalMetrics: totalMetrics.length,
      activeOperations: this.activeOperations.size,
      samplingRate: this.samplingRate,
      thresholds: this.thresholds,
      operationStats: {}
    };
    
    // Calculate per-operation stats
    for (const operation of operations) {
      stats.operationStats[operation] = this.getOperationStats(operation);
    }
    
    // Calculate overall threshold breaches
    stats.overallThresholdBreaches = {
      slow: totalMetrics.filter(m => m.threshold === 'slow').length,
      warning: totalMetrics.filter(m => m.threshold === 'warning').length,
      critical: totalMetrics.filter(m => m.threshold === 'critical').length
    };
    
    return stats;
  }

  /**
   * Clear metrics for an operation
   * @param {string} operation - Operation name
   */
  clearOperationMetrics(operation) {
    this.metrics.delete(operation);
    this.aggregatedMetrics.delete(operation);
    
    this.logger?.debug('[PerformanceMonitor] Cleared metrics for operation', {
      operation
    });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics() {
    this.metrics.clear();
    this.aggregatedMetrics.clear();
    
    this.logger?.debug('[PerformanceMonitor] Cleared all metrics');
  }

  /**
   * Update performance thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    this.logger?.info('[PerformanceMonitor] Updated performance thresholds', {
      thresholds: this.thresholds
    });
    
    this.emit('thresholds-updated', this.thresholds);
  }

  /**
   * Enable or disable monitoring
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    const wasEnabled = this.enabled;
    this.enabled = enabled;
    
    if (enabled && !wasEnabled) {
      // Start aggregation timer
      this.aggregationTimer = setInterval(() => {
        this._aggregateMetrics();
      }, this.aggregationInterval);
    } else if (!enabled && wasEnabled) {
      // Stop aggregation timer
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
        this.aggregationTimer = null;
      }
    }
    
    this.logger?.info('[PerformanceMonitor] Monitoring enabled state changed', {
      enabled,
      wasEnabled
    });
  }

  /**
   * Generate unique operation ID
   * @private
   */
  _generateOperationId() {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if this operation should be sampled
   * @private
   */
  _shouldSample() {
    return Math.random() < this.samplingRate;
  }

  /**
   * Get threshold level for a duration
   * @private
   */
  _getThresholdLevel(duration) {
    if (duration >= this.thresholds.critical) {
      return 'critical';
    } else if (duration >= this.thresholds.warning) {
      return 'warning';
    } else if (duration >= this.thresholds.slow) {
      return 'slow';
    }
    return 'normal';
  }

  /**
   * Store a performance metric
   * @private
   */
  _storeMetric(metric) {
    if (!this.metrics.has(metric.operation)) {
      this.metrics.set(metric.operation, []);
    }
    
    const operationMetrics = this.metrics.get(metric.operation);
    operationMetrics.push(metric);
    
    // Limit metrics per operation to prevent memory issues
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.shift(); // Remove oldest metric
    }
  }

  /**
   * Check thresholds and emit warnings
   * @private
   */
  _checkThresholds(metric) {
    if (metric.threshold === 'normal') {
      return;
    }
    
    // Emit threshold breach event
    this.emit('threshold-breach', {
      operation: metric.operation,
      duration: metric.duration,
      threshold: metric.threshold,
      context: metric.context,
      timestamp: metric.timestamp
    });
    
    // Trigger action callback if available
    if (this.actionCallbacks) {
      this.actionCallbacks.execute('performance-threshold-breach', async () => {
        return {
          operation: metric.operation,
          duration: metric.duration,
          threshold: metric.threshold
        };
      }, {
        operation: metric.operation,
        duration: metric.duration,
        threshold: metric.threshold,
        context: metric.context
      }).catch(error => {
        this.logger?.error('[PerformanceMonitor] Error in threshold breach callback', {
          error: error.message,
          operation: metric.operation
        });
      });
    }
    
    // Log threshold breach
    const logLevel = metric.threshold === 'critical' ? 'error' : 'warn';
    this.logger?.[logLevel]('[PerformanceMonitor] Performance threshold breach', {
      operation: metric.operation,
      duration: metric.duration,
      threshold: metric.threshold,
      thresholdValue: this.thresholds[metric.threshold],
      context: metric.context
    });
  }

  /**
   * Aggregate metrics periodically
   * @private
   */
  _aggregateMetrics() {
    for (const [operation, metrics] of this.metrics) {
      if (metrics.length === 0) continue;
      
      const durations = metrics.map(m => m.duration);
      const aggregated = {
        operation,
        count: metrics.length,
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        p50: this._percentile(durations, 0.5),
        p90: this._percentile(durations, 0.9),
        p95: this._percentile(durations, 0.95),
        p99: this._percentile(durations, 0.99),
        lastAggregation: Date.now()
      };
      
      this.aggregatedMetrics.set(operation, aggregated);
    }
    
    this.emit('metrics-aggregated', this.aggregatedMetrics);
  }

  /**
   * Calculate percentile
   * @private
   */
  _percentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    this.removeAllListeners();
    this.metrics.clear();
    this.activeOperations.clear();
    this.aggregatedMetrics.clear();
    
    this.logger?.debug('[PerformanceMonitor] Destroyed');
  }
}