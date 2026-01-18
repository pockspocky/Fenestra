/**
 * Event Tracing and Monitoring
 * 
 * Provides debugging utilities for tracing event execution,
 * monitoring performance, and visualizing callback flows.
 * 
 * @module events/eventTracing
 */

import '../../logger.js';

/**
 * Event trace entry
 */
class TraceEntry {
  constructor(event, data, listenerId) {
    this.timestamp = Date.now();
    this.event = event;
    this.data = data;
    this.listenerId = listenerId;
    this.duration = null;
    this.error = null;
  }

  complete(duration, error = null) {
    this.duration = duration;
    this.error = error;
  }
}

/**
 * Event tracer for debugging and monitoring
 */
export class EventTracer {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.maxTraces = options.maxTraces || 1000;
    this.traces = [];
    this.stats = {
      totalEvents: 0,
      totalListeners: 0,
      totalErrors: 0,
      eventCounts: new Map(),
      listenerCounts: new Map(),
      averageDurations: new Map()
    };
  }

  /**
   * Enable tracing
   */
  enable() {
    this.enabled = true;
    console.info('[TRACE] Event tracing enabled');
  }

  /**
   * Disable tracing
   */
  disable() {
    this.enabled = false;
    console.info('[TRACE] Event tracing disabled');
  }

  /**
   * Record event emission start
   * 
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @returns {string} Trace ID
   */
  recordEmit(event, data) {
    if (!this.enabled) return null;

    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.stats.totalEvents++;
    this.stats.eventCounts.set(event, (this.stats.eventCounts.get(event) || 0) + 1);

    console.debug('[TRACE] Event emitted', {
      traceId,
      event,
      entityId: data?.entityId
    });

    return traceId;
  }

  /**
   * Record listener execution start
   * 
   * @param {string} traceId - Trace ID from recordEmit
   * @param {string} event - Event name
   * @param {string} listenerId - Listener ID
   * @param {*} data - Event data
   * @returns {TraceEntry} Trace entry
   */
  recordListenerStart(traceId, event, listenerId, data) {
    if (!this.enabled) return null;

    const entry = new TraceEntry(event, data, listenerId);
    
    this.stats.totalListeners++;
    this.stats.listenerCounts.set(listenerId, (this.stats.listenerCounts.get(listenerId) || 0) + 1);

    console.debug('[TRACE] Listener executing', {
      traceId,
      event,
      listenerId
    });

    return entry;
  }

  /**
   * Record listener execution completion
   * 
   * @param {TraceEntry} entry - Trace entry
   * @param {number} startTime - Start timestamp
   * @param {Error} error - Error if occurred
   */
  recordListenerComplete(entry, startTime, error = null) {
    if (!this.enabled || !entry) return;

    const duration = Date.now() - startTime;
    entry.complete(duration, error);

    // Add to traces (with size limit)
    this.traces.push(entry);
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }

    // Update stats
    if (error) {
      this.stats.totalErrors++;
    }

    // Update average duration
    const durations = this.stats.averageDurations.get(entry.event) || [];
    durations.push(duration);
    if (durations.length > 100) {
      durations.shift();
    }
    this.stats.averageDurations.set(entry.event, durations);

    console.debug('[TRACE] Listener completed', {
      event: entry.event,
      listenerId: entry.listenerId,
      duration: `${duration}ms`,
      error: error ? error.message : null
    });
  }

  /**
   * Get traces for a specific event
   * 
   * @param {string} event - Event name
   * @returns {TraceEntry[]} Matching traces
   */
  getTracesForEvent(event) {
    return this.traces.filter(t => t.event === event);
  }

  /**
   * Get traces for a specific listener
   * 
   * @param {string} listenerId - Listener ID
   * @returns {TraceEntry[]} Matching traces
   */
  getTracesForListener(listenerId) {
    return this.traces.filter(t => t.listenerId === listenerId);
  }

  /**
   * Get recent traces
   * 
   * @param {number} count - Number of traces to return
   * @returns {TraceEntry[]} Recent traces
   */
  getRecentTraces(count = 10) {
    return this.traces.slice(-count);
  }

  /**
   * Get performance statistics
   * 
   * @returns {Object} Performance stats
   */
  getStats() {
    const avgDurations = {};
    for (const [event, durations] of this.stats.averageDurations) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      avgDurations[event] = Math.round(avg * 100) / 100;
    }

    return {
      totalEvents: this.stats.totalEvents,
      totalListeners: this.stats.totalListeners,
      totalErrors: this.stats.totalErrors,
      eventCounts: Object.fromEntries(this.stats.eventCounts),
      listenerCounts: Object.fromEntries(this.stats.listenerCounts),
      averageDurations: avgDurations
    };
  }

  /**
   * Get slow listeners (above threshold)
   * 
   * @param {number} thresholdMs - Duration threshold in milliseconds
   * @returns {TraceEntry[]} Slow listener traces
   */
  getSlowListeners(thresholdMs = 100) {
    return this.traces.filter(t => t.duration && t.duration > thresholdMs);
  }

  /**
   * Get error traces
   * 
   * @returns {TraceEntry[]} Traces with errors
   */
  getErrorTraces() {
    return this.traces.filter(t => t.error !== null);
  }

  /**
   * Clear all traces and reset stats
   */
  clear() {
    this.traces = [];
    this.stats = {
      totalEvents: 0,
      totalListeners: 0,
      totalErrors: 0,
      eventCounts: new Map(),
      listenerCounts: new Map(),
      averageDurations: new Map()
    };
    console.info('[TRACE] Traces cleared');
  }

  /**
   * Generate a visual flow diagram of recent events
   * 
   * @param {number} count - Number of recent events to include
   * @returns {string} ASCII flow diagram
   */
  generateFlowDiagram(count = 20) {
    const recent = this.getRecentTraces(count);
    
    if (recent.length === 0) {
      return 'No traces available';
    }

    let diagram = '\n=== Event Flow Diagram ===\n\n';
    
    const eventGroups = new Map();
    for (const trace of recent) {
      if (!eventGroups.has(trace.event)) {
        eventGroups.set(trace.event, []);
      }
      eventGroups.get(trace.event).push(trace);
    }

    for (const [event, traces] of eventGroups) {
      diagram += `Event: ${event}\n`;
      for (const trace of traces) {
        const status = trace.error ? '✗' : '✓';
        const duration = trace.duration ? `${trace.duration}ms` : 'pending';
        diagram += `  ${status} Listener ${trace.listenerId.substr(0, 12)}... (${duration})\n`;
      }
      diagram += '\n';
    }

    return diagram;
  }

  /**
   * Export traces to JSON
   * 
   * @returns {string} JSON string of traces
   */
  exportTraces() {
    return JSON.stringify({
      traces: this.traces.map(t => ({
        timestamp: t.timestamp,
        event: t.event,
        listenerId: t.listenerId,
        duration: t.duration,
        error: t.error ? t.error.message : null,
        entityId: t.data?.entityId
      })),
      stats: this.getStats()
    }, null, 2);
  }
}

/**
 * Global event tracer instance
 */
export const eventTracer = new EventTracer({
  enabled: process.env.NODE_ENV === 'development'
});

/**
 * Wrap an event emitter to add tracing
 * 
 * @param {EventEmitter} emitter - Event emitter to wrap
 * @returns {EventEmitter} Wrapped emitter
 */
export function wrapEmitterWithTracing(emitter) {
  const originalEmit = emitter.emit.bind(emitter);

  emitter.emit = function(event, data) {
    const traceId = eventTracer.recordEmit(event, data);
    
    // Get listeners before emission
    const eventListeners = emitter.listeners.get(event);
    
    if (eventListeners && eventListeners.size > 0) {
      // Wrap each listener execution with tracing
      const wrappedListeners = new Map();
      
      for (const [listenerId, callback] of eventListeners) {
        wrappedListeners.set(listenerId, (data) => {
          const startTime = Date.now();
          const entry = eventTracer.recordListenerStart(traceId, event, listenerId, data);
          
          try {
            const result = callback(data);
            eventTracer.recordListenerComplete(entry, startTime);
            return result;
          } catch (error) {
            eventTracer.recordListenerComplete(entry, startTime, error);
            throw error;
          }
        });
      }
      
      // Temporarily replace listeners
      const originalListeners = emitter.listeners.get(event);
      emitter.listeners.set(event, wrappedListeners);
      
      const result = originalEmit(event, data);
      
      // Restore original listeners
      emitter.listeners.set(event, originalListeners);
      
      return result;
    }
    
    return originalEmit(event, data);
  };

  return emitter;
}
