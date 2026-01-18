/**
 * Security Audit and Monitoring System
 * Comprehensive security event logging, pattern analysis, and alerting
 */

import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Security Event Types
 */
export const SECURITY_EVENT_TYPES = {
  PATH_TRAVERSAL: 'path_traversal',
  RATE_LIMIT: 'rate_limit',
  INJECTION_ATTEMPT: 'injection_attempt',
  SCHEMA_VIOLATION: 'schema_violation',
  ACCESS_DENIED: 'access_denied',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  MEMORY_THRESHOLD: 'memory_threshold',
  EMAIL_VALIDATION: 'email_validation',
  IPC_VIOLATION: 'ipc_violation',
  CIRCULAR_DEPENDENCY: 'circular_dependency'
};

/**
 * Security Event Severity Levels
 */
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Alert Rules Configuration
 */
export const DEFAULT_ALERT_RULES = {
  criticalEvents: {
    threshold: 1,
    timeWindow: 60000, // 1 minute
    action: 'immediate'
  },
  highSeverityEvents: {
    threshold: 3,
    timeWindow: 300000, // 5 minutes
    action: 'escalate'
  },
  repeatedViolations: {
    threshold: 5,
    timeWindow: 600000, // 10 minutes
    action: 'block'
  }
};

/**
 * Security Audit System Class
 */
export class SecurityAuditSystem {
  constructor(config = {}) {
    this.config = {
      logDirectory: config.logDirectory || join(process.cwd(), 'logs', 'security'),
      maxLogFileSize: config.maxLogFileSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: config.maxLogFiles || 10,
      alertRules: { ...DEFAULT_ALERT_RULES, ...config.alertRules },
      enablePatternAnalysis: config.enablePatternAnalysis !== false,
      enableRealTimeAlerts: config.enableRealTimeAlerts !== false,
      ...config
    };

    this.eventBuffer = [];
    this.alertHandlers = new Map();
    this.patternCache = new Map();
    this.violationCounts = new Map();
    
    // Add recursion guard
    this._isProcessingEvent = false;
    
    this._ensureLogDirectory();
    this._initializePatternAnalysis();
    
    console.log('[AUDIT] Security Audit System initialized', {
      logDirectory: this.config.logDirectory,
      enablePatternAnalysis: this.config.enablePatternAnalysis,
      enableRealTimeAlerts: this.config.enableRealTimeAlerts
    });
  }

  /**
   * Initialize the audit system
   * @returns {Object} Initialization result
   */
  initialize() {
    try {
      console.log('[AUDIT] Initializing Security Audit System...');
      
      // Ensure log directory exists
      this._ensureLogDirectory();
      
      // Initialize pattern analysis
      this._initializePatternAnalysis();
      
      // Set up periodic log rotation
      this._setupLogRotation();
      
      // Set up periodic buffer flush
      this._setupBufferFlush();
      
      console.log('[AUDIT] Security Audit System initialized successfully', {
        logDirectory: this.config.logDirectory,
        enablePatternAnalysis: this.config.enablePatternAnalysis,
        enableRealTimeAlerts: this.config.enableRealTimeAlerts
      });
      
      return {
        success: true,
        message: 'Security Audit System initialized successfully',
        config: {
          logDirectory: this.config.logDirectory,
          enablePatternAnalysis: this.config.enablePatternAnalysis,
          enableRealTimeAlerts: this.config.enableRealTimeAlerts
        }
      };
    } catch (error) {
      console.error('[AUDIT] Failed to initialize Security Audit System', {
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup the audit system
   * @returns {Object} Cleanup result
   */
  cleanup() {
    try {
      console.log('[AUDIT] Cleaning up Security Audit System...');
      
      // Flush any remaining events in buffer
      this.flushEventBuffer();
      
      // Clear intervals
      if (this._rotationInterval) {
        clearInterval(this._rotationInterval);
        this._rotationInterval = null;
      }
      
      if (this._flushInterval) {
        clearInterval(this._flushInterval);
        this._flushInterval = null;
      }
      
      // Clear caches and tracking
      this.patternCache.clear();
      this.violationCounts.clear();
      this.alertHandlers.clear();
      
      console.log('[AUDIT] Security Audit System cleaned up successfully');
      
      return {
        success: true,
        message: 'Security Audit System cleaned up successfully'
      };
    } catch (error) {
      console.error('[AUDIT] Failed to cleanup Security Audit System', {
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set up periodic log rotation
   * @private
   */
  _setupLogRotation() {
    // Rotate logs every hour
    this._rotationInterval = setInterval(() => {
      this.rotateLogFiles();
    }, 3600000); // 1 hour
  }

  /**
   * Set up periodic buffer flush
   * @private
   */
  _setupBufferFlush() {
    // Flush buffer every 30 seconds
    this._flushInterval = setInterval(() => {
      this.flushEventBuffer();
    }, 30000); // 30 seconds
  }
  logSecurityEvent(eventType, severity, details = {}, context = {}) {
    // Prevent recursive logging
    if (this._isProcessingEvent) {
      return null;
    }

    try {
      this._isProcessingEvent = true;

      const event = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        source: {
          component: details.component || 'unknown',
          function: details.function || 'unknown',
          ipcChannel: details.ipcChannel || null
        },
        details: {
          inputData: this._sanitizeInput(details.inputData),
          violationType: details.violationType || eventType,
          mitigationAction: details.mitigationAction || 'logged',
          ...details
        },
        context: {
          userId: context.userId || null,
          sessionId: context.sessionId || null,
          clientInfo: context.clientInfo || null,
          ...context
        }
      };

      // Add to buffer for batch processing
      this.eventBuffer.push(event);

      // Write to log file immediately for critical events
      if (severity === SEVERITY_LEVELS.CRITICAL || severity === SEVERITY_LEVELS.HIGH) {
        this._writeEventToLog(event);
      }

      // Process real-time alerts (but prevent recursion)
      if (this.config.enableRealTimeAlerts && details.component !== 'audit_system') {
        this._processRealTimeAlert(event);
      }

      // Update violation tracking
      this._updateViolationTracking(event);

      // Trigger pattern analysis for suspicious activity (but prevent recursion)
      if (this.config.enablePatternAnalysis && details.component !== 'pattern_analyzer') {
        this._analyzeEventPattern(event);
      }

      console.log(`[AUDIT] Security event logged: ${eventType}`, {
        id: event.id,
        severity,
        component: event.source.component
      });

      return event;
    } catch (error) {
      console.error('[AUDIT] Failed to log security event', {
        eventType,
        severity,
        error: error.message
      });
      return null;
    } finally {
      this._isProcessingEvent = false;
    }
  }

  /**
   * Log an access attempt
   * @param {string} resource - Resource being accessed
   * @param {string} result - Access result (allowed/denied)
   * @param {Object} context - Access context
   * @returns {Object} Logged event
   */
  logAccessAttempt(resource, result, context = {}) {
    const eventType = result === 'denied' ? SECURITY_EVENT_TYPES.ACCESS_DENIED : 'access_granted';
    const severity = result === 'denied' ? SEVERITY_LEVELS.MEDIUM : SEVERITY_LEVELS.LOW;

    return this.logSecurityEvent(eventType, severity, {
      component: context.component || 'access_control',
      function: context.function || 'checkAccess',
      violationType: result === 'denied' ? 'unauthorized_access' : 'authorized_access',
      mitigationAction: result === 'denied' ? 'access_blocked' : 'access_granted',
      resource,
      accessResult: result
    }, context);
  }

  /**
   * Detect security violations based on event patterns
   * @param {Object} event - Security event to analyze
   * @param {Object} context - Analysis context
   * @returns {Object} Violation detection result
   */
  detectSecurityViolation(event, context = {}) {
    try {
      const violations = [];

      // Check for repeated violations from same source
      const sourceKey = this._getSourceKey(event);
      const recentEvents = this._getRecentEvents(sourceKey, 300000); // 5 minutes

      if (recentEvents.length >= 3) {
        violations.push({
          type: 'repeated_violations',
          severity: SEVERITY_LEVELS.HIGH,
          count: recentEvents.length,
          timeWindow: 300000,
          recommendation: 'Consider blocking or rate limiting this source'
        });
      }

      // Check for escalating severity
      const severityLevels = recentEvents.map(e => e.severity);
      if (this._isEscalatingSeverity(severityLevels)) {
        violations.push({
          type: 'escalating_severity',
          severity: SEVERITY_LEVELS.HIGH,
          pattern: severityLevels,
          recommendation: 'Investigate potential coordinated attack'
        });
      }

      // Check for suspicious timing patterns
      if (this._isSuspiciousTiming(recentEvents)) {
        violations.push({
          type: 'suspicious_timing',
          severity: SEVERITY_LEVELS.MEDIUM,
          recommendation: 'Automated attack pattern detected'
        });
      }

      const result = {
        hasViolations: violations.length > 0,
        violations,
        riskScore: this._calculateRiskScore(violations),
        recommendedActions: this._getRecommendedActions(violations)
      };

      if (result.hasViolations) {
        console.warn('[AUDIT] Security violations detected', {
          eventId: event.id,
          violationCount: violations.length,
          riskScore: result.riskScore
        });
      }

      return result;
    } catch (error) {
      console.error('[AUDIT] Failed to detect security violations', {
        eventId: event.id,
        error: error.message
      });
      return { hasViolations: false, violations: [], error: error.message };
    }
  }

  /**
   * Analyze activity patterns over a time window
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {Object} Pattern analysis results
   */
  analyzeActivityPatterns(timeWindow = 3600000) { // 1 hour default
    try {
      const cutoffTime = Date.now() - timeWindow;
      const recentEvents = this._getAllRecentEvents(cutoffTime);

      const analysis = {
        timeWindow,
        totalEvents: recentEvents.length,
        eventsByType: this._groupEventsByType(recentEvents),
        eventsBySeverity: this._groupEventsBySeverity(recentEvents),
        topSources: this._getTopSources(recentEvents),
        patterns: this._identifyPatterns(recentEvents),
        anomalies: this._detectAnomalies(recentEvents),
        riskAssessment: this._assessOverallRisk(recentEvents)
      };

      console.log('[AUDIT] Activity pattern analysis completed', {
        timeWindow,
        totalEvents: analysis.totalEvents,
        anomalies: analysis.anomalies.length,
        riskLevel: analysis.riskAssessment.level
      });

      return analysis;
    } catch (error) {
      console.error('[AUDIT] Failed to analyze activity patterns', {
        timeWindow,
        error: error.message
      });
      return { error: error.message };
    }
  }

  /**
   * Generate comprehensive security report
   * @param {Object} timeRange - Time range for report
   * @returns {Object} Security report
   */
  generateSecurityReport(timeRange = {}) {
    try {
      const startTime = timeRange.start || Date.now() - 86400000; // 24 hours default
      const endTime = timeRange.end || Date.now();

      const events = this._getEventsInRange(startTime, endTime);
      const patterns = this.analyzeActivityPatterns(endTime - startTime);

      const report = {
        metadata: {
          reportId: randomUUID(),
          generatedAt: new Date().toISOString(),
          timeRange: { start: new Date(startTime).toISOString(), end: new Date(endTime).toISOString() },
          totalEvents: events.length
        },
        summary: {
          criticalEvents: events.filter(e => e.severity === SEVERITY_LEVELS.CRITICAL).length,
          highSeverityEvents: events.filter(e => e.severity === SEVERITY_LEVELS.HIGH).length,
          mediumSeverityEvents: events.filter(e => e.severity === SEVERITY_LEVELS.MEDIUM).length,
          lowSeverityEvents: events.filter(e => e.severity === SEVERITY_LEVELS.LOW).length
        },
        eventBreakdown: patterns.eventsByType,
        topViolations: this._getTopViolations(events),
        securityTrends: this._calculateSecurityTrends(events),
        recommendations: this._generateRecommendations(events, patterns),
        riskAssessment: patterns.riskAssessment,
        detailedEvents: events.slice(0, 100) // Limit to first 100 for report size
      };

      console.log('[AUDIT] Security report generated', {
        reportId: report.metadata.reportId,
        totalEvents: report.metadata.totalEvents,
        criticalEvents: report.summary.criticalEvents
      });

      return report;
    } catch (error) {
      console.error('[AUDIT] Failed to generate security report', {
        timeRange,
        error: error.message
      });
      return { error: error.message };
    }
  }

  /**
   * Export audit log in specified format
   * @param {string} format - Export format (json, csv, txt)
   * @param {string} destination - Export destination path
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  exportAuditLog(format = 'json', destination = null, options = {}) {
    try {
      const timeRange = options.timeRange || {};
      const startTime = timeRange.start || Date.now() - 86400000;
      const endTime = timeRange.end || Date.now();

      const events = this._getEventsInRange(startTime, endTime);
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          format,
          eventCount: events.length,
          timeRange: { start: new Date(startTime).toISOString(), end: new Date(endTime).toISOString() }
        },
        events
      };

      let exportContent;
      let fileExtension;

      switch (format.toLowerCase()) {
        case 'json':
          exportContent = JSON.stringify(exportData, null, 2);
          fileExtension = 'json';
          break;
        case 'csv':
          exportContent = this._convertToCSV(events);
          fileExtension = 'csv';
          break;
        case 'txt':
          exportContent = this._convertToText(events);
          fileExtension = 'txt';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const filename = destination || join(this.config.logDirectory, `audit_export_${Date.now()}.${fileExtension}`);
      writeFileSync(filename, exportContent, 'utf8');

      console.log('[AUDIT] Audit log exported', {
        format,
        filename,
        eventCount: events.length
      });

      return {
        success: true,
        filename,
        format,
        eventCount: events.length,
        fileSize: exportContent.length
      };
    } catch (error) {
      console.error('[AUDIT] Failed to export audit log', {
        format,
        destination,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Configure alert rules
   * @param {Object} rules - Alert rules configuration
   * @returns {Object} Configuration result
   */
  configureAlerts(rules) {
    try {
      this.config.alertRules = { ...this.config.alertRules, ...rules };

      console.log('[AUDIT] Alert rules configured', {
        rules: Object.keys(rules)
      });

      return {
        success: true,
        alertRules: this.config.alertRules,
        message: 'Alert rules configured successfully'
      };
    } catch (error) {
      console.error('[AUDIT] Failed to configure alert rules', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send security alert
   * @param {Object} violation - Security violation details
   * @param {Object} details - Additional alert details
   * @returns {Object} Alert result
   */
  sendSecurityAlert(violation, details = {}) {
    try {
      const alert = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'security_alert',
        severity: violation.severity || SEVERITY_LEVELS.MEDIUM,
        violation,
        details,
        actions: details.recommendedActions || []
      };

      // Process alert through registered handlers
      const results = [];
      for (const [handlerName, handler] of this.alertHandlers) {
        try {
          const result = handler(alert);
          results.push({ handler: handlerName, success: true, result });
        } catch (handlerError) {
          results.push({ handler: handlerName, success: false, error: handlerError.message });
          console.error(`[AUDIT] Alert handler ${handlerName} failed`, {
            alertId: alert.id,
            error: handlerError.message
          });
        }
      }

      // Log the alert as a security event
      this.logSecurityEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY, alert.severity, {
        component: 'audit_system',
        function: 'sendSecurityAlert',
        violationType: 'security_alert_triggered',
        mitigationAction: 'alert_sent',
        alertId: alert.id,
        violationDetails: violation
      });

      console.log('[AUDIT] Security alert sent', {
        alertId: alert.id,
        severity: alert.severity,
        handlerResults: results.length
      });

      return {
        success: true,
        alert,
        handlerResults: results
      };
    } catch (error) {
      console.error('[AUDIT] Failed to send security alert', {
        violation,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Register an alert handler
   * @param {string} name - Handler name
   * @param {Function} handler - Alert handler function
   */
  registerAlertHandler(name, handler) {
    this.alertHandlers.set(name, handler);
    console.log(`[AUDIT] Alert handler registered: ${name}`);
  }

  /**
   * Flush event buffer to log files
   */
  flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      for (const event of events) {
        this._writeEventToLog(event);
      }

      console.log(`[AUDIT] Flushed ${events.length} events to log`);
    } catch (error) {
      console.error('[AUDIT] Failed to flush event buffer', {
        bufferSize: this.eventBuffer.length,
        error: error.message
      });
    }
  }

  /**
   * Perform log rotation
   */
  rotateLogFiles() {
    try {
      const logFiles = this._getLogFiles();
      
      // Check file sizes and rotate if needed
      for (const file of logFiles) {
        const filePath = join(this.config.logDirectory, file);
        const stats = statSync(filePath);
        
        if (stats.size > this.config.maxLogFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedName = `${file}.${timestamp}`;
          const rotatedPath = join(this.config.logDirectory, rotatedName);
          
          // Rename current file
          writeFileSync(rotatedPath, readFileSync(filePath));
          writeFileSync(filePath, ''); // Clear current file
          
          console.log(`[AUDIT] Log file rotated: ${file} -> ${rotatedName}`);
        }
      }

      // Clean up old log files if we exceed the limit
      this._cleanupOldLogFiles();
    } catch (error) {
      console.error('[AUDIT] Failed to rotate log files', {
        error: error.message
      });
    }
  }

  /**
   * Get audit statistics
   * @returns {Object} Audit system statistics
   */
  getAuditStats() {
    try {
      const logFiles = this._getLogFiles();
      const totalLogSize = logFiles.reduce((size, file) => {
        const filePath = join(this.config.logDirectory, file);
        return size + statSync(filePath).size;
      }, 0);

      return {
        eventBufferSize: this.eventBuffer.length,
        logFileCount: logFiles.length,
        totalLogSize,
        alertHandlerCount: this.alertHandlers.size,
        violationTrackingEntries: this.violationCounts.size,
        patternCacheEntries: this.patternCache.size,
        config: {
          logDirectory: this.config.logDirectory,
          maxLogFileSize: this.config.maxLogFileSize,
          maxLogFiles: this.config.maxLogFiles,
          enablePatternAnalysis: this.config.enablePatternAnalysis,
          enableRealTimeAlerts: this.config.enableRealTimeAlerts
        }
      };
    } catch (error) {
      console.error('[AUDIT] Failed to get audit stats', {
        error: error.message
      });
      return { error: error.message };
    }
  }

  // Private helper methods

  _ensureLogDirectory() {
    if (!existsSync(this.config.logDirectory)) {
      mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  _initializePatternAnalysis() {
    if (this.config.enablePatternAnalysis) {
      // Initialize pattern analysis cache and algorithms
      this.patternCache.set('baseline', {
        eventRates: new Map(),
        lastUpdate: Date.now()
      });
    }
  }

  _sanitizeInput(input) {
    if (typeof input === 'string') {
      // Remove potentially sensitive information
      return input.replace(/([a-zA-Z]:\\|\/[a-zA-Z0-9_-]+\/)/g, '[PATH]')
                  .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
                  .substring(0, 500); // Limit length
    }
    return input;
  }

  _writeEventToLog(event) {
    const logFile = join(this.config.logDirectory, `security_${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = JSON.stringify(event) + '\n';
    
    try {
      writeFileSync(logFile, logEntry, { flag: 'a' });
    } catch (error) {
      console.error('[AUDIT] Failed to write event to log', {
        eventId: event.id,
        logFile,
        error: error.message
      });
    }
  }

  _processRealTimeAlert(event) {
    const violation = this.detectSecurityViolation(event);
    
    if (violation.hasViolations) {
      // Check if alert should be triggered based on rules
      const shouldAlert = this._shouldTriggerAlert(event, violation);
      
      if (shouldAlert) {
        this.sendSecurityAlert(violation, {
          triggeringEvent: event,
          recommendedActions: violation.recommendedActions
        });
      }
    }
  }

  _shouldTriggerAlert(event, violation) {
    const rules = this.config.alertRules;
    
    // Critical events always trigger alerts
    if (event.severity === SEVERITY_LEVELS.CRITICAL) {
      return true;
    }
    
    // Check high severity threshold
    if (event.severity === SEVERITY_LEVELS.HIGH) {
      const recentHighEvents = this._getRecentEventsBySeverity(SEVERITY_LEVELS.HIGH, rules.highSeverityEvents.timeWindow);
      return recentHighEvents.length >= rules.highSeverityEvents.threshold;
    }
    
    // Check repeated violations
    const sourceKey = this._getSourceKey(event);
    const recentViolations = this._getRecentEvents(sourceKey, rules.repeatedViolations.timeWindow);
    return recentViolations.length >= rules.repeatedViolations.threshold;
  }

  _updateViolationTracking(event) {
    const sourceKey = this._getSourceKey(event);
    
    if (!this.violationCounts.has(sourceKey)) {
      this.violationCounts.set(sourceKey, []);
    }
    
    const violations = this.violationCounts.get(sourceKey);
    violations.push({
      timestamp: Date.now(),
      eventType: event.eventType,
      severity: event.severity
    });
    
    // Keep only recent violations (last hour)
    const cutoff = Date.now() - 3600000;
    this.violationCounts.set(sourceKey, violations.filter(v => v.timestamp > cutoff));
  }

  _analyzeEventPattern(event) {
    // Simple pattern analysis - could be enhanced with ML
    const sourceKey = this._getSourceKey(event);
    const recentEvents = this._getRecentEvents(sourceKey, 300000); // 5 minutes
    
    if (recentEvents.length >= 5) {
      // Potential automated attack - but don't log if we're already processing an audit event
      if (event.source.component !== 'audit_system' && event.source.component !== 'pattern_analyzer') {
        this.logSecurityEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY, SEVERITY_LEVELS.HIGH, {
          component: 'pattern_analyzer',
          function: '_analyzeEventPattern',
          violationType: 'potential_automated_attack',
          mitigationAction: 'pattern_detected',
          sourceKey,
          eventCount: recentEvents.length
        });
      }
    }
  }

  _getSourceKey(event) {
    const component = event.source?.component || 'unknown';
    const clientInfo = event.context?.clientInfo;
    const ip = clientInfo?.ip || 'unknown';
    return `${component}:${ip}`;
  }

  _getRecentEvents(sourceKey, timeWindow) {
    const violations = this.violationCounts.get(sourceKey) || [];
    const cutoff = Date.now() - timeWindow;
    return violations.filter(v => v.timestamp > cutoff);
  }

  _getRecentEventsBySeverity(severity, timeWindow) {
    const cutoff = Date.now() - timeWindow;
    const allViolations = Array.from(this.violationCounts.values()).flat();
    return allViolations.filter(v => v.timestamp > cutoff && v.severity === severity);
  }

  _getAllRecentEvents(cutoffTime) {
    // Get events from violation tracking (simplified implementation)
    const allEvents = [];
    
    for (const [sourceKey, violations] of this.violationCounts.entries()) {
      for (const violation of violations) {
        if (violation.timestamp > cutoffTime) {
          // Convert violation tracking format to event format
          allEvents.push({
            id: `${violation.timestamp}-${sourceKey}`,
            timestamp: violation.timestamp,
            eventType: violation.eventType,
            severity: violation.severity,
            source: {
              component: sourceKey.split(':')[0] || 'unknown'
            },
            details: {
              violationType: violation.eventType
            }
          });
        }
      }
    }
    
    return allEvents;
  }

  _getEventsInRange(startTime, endTime) {
    // Get events from violation tracking (simplified implementation)
    const allEvents = [];
    
    for (const [sourceKey, violations] of this.violationCounts.entries()) {
      for (const violation of violations) {
        if (violation.timestamp >= startTime && violation.timestamp <= endTime) {
          // Convert violation tracking format to event format
          allEvents.push({
            id: `${violation.timestamp}-${sourceKey}`,
            timestamp: violation.timestamp,
            eventType: violation.eventType,
            severity: violation.severity,
            source: {
              component: sourceKey.split(':')[0] || 'unknown'
            },
            details: {
              violationType: violation.eventType
            }
          });
        }
      }
    }
    
    return allEvents;
  }

  _isEscalatingSeverity(severityLevels) {
    const severityOrder = [SEVERITY_LEVELS.LOW, SEVERITY_LEVELS.MEDIUM, SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.CRITICAL];
    
    for (let i = 1; i < severityLevels.length; i++) {
      const currentIndex = severityOrder.indexOf(severityLevels[i]);
      const previousIndex = severityOrder.indexOf(severityLevels[i - 1]);
      
      if (currentIndex > previousIndex) {
        return true;
      }
    }
    
    return false;
  }

  _isSuspiciousTiming(events) {
    if (events.length < 3) return false;
    
    const intervals = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(events[i].timestamp - events[i - 1].timestamp);
    }
    
    // Check for very regular intervals (potential automation)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    
    return variance < avgInterval * 0.1; // Very low variance indicates automation
  }

  _calculateRiskScore(violations) {
    const severityWeights = {
      [SEVERITY_LEVELS.LOW]: 1,
      [SEVERITY_LEVELS.MEDIUM]: 3,
      [SEVERITY_LEVELS.HIGH]: 7,
      [SEVERITY_LEVELS.CRITICAL]: 15
    };
    
    return violations.reduce((score, violation) => {
      return score + (severityWeights[violation.severity] || 1);
    }, 0);
  }

  _getRecommendedActions(violations) {
    const actions = new Set();
    
    violations.forEach(violation => {
      if (violation.recommendation) {
        actions.add(violation.recommendation);
      }
    });
    
    return Array.from(actions);
  }

  _groupEventsByType(events) {
    return events.reduce((groups, event) => {
      groups[event.eventType] = (groups[event.eventType] || 0) + 1;
      return groups;
    }, {});
  }

  _groupEventsBySeverity(events) {
    return events.reduce((groups, event) => {
      groups[event.severity] = (groups[event.severity] || 0) + 1;
      return groups;
    }, {});
  }

  _getTopSources(events) {
    const sources = events.reduce((counts, event) => {
      const sourceKey = this._getSourceKey(event);
      counts[sourceKey] = (counts[sourceKey] || 0) + 1;
      return counts;
    }, {});
    
    return Object.entries(sources)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));
  }

  _identifyPatterns(events) {
    // Simplified pattern identification
    const patterns = [];
    
    // Check for burst patterns
    const timeGroups = this._groupEventsByTimeWindow(events, 60000); // 1 minute windows
    const burstThreshold = 10;
    
    Object.entries(timeGroups).forEach(([timeWindow, eventCount]) => {
      if (eventCount > burstThreshold) {
        patterns.push({
          type: 'burst',
          timeWindow,
          eventCount,
          severity: SEVERITY_LEVELS.MEDIUM
        });
      }
    });
    
    return patterns;
  }

  _detectAnomalies(events) {
    // Simplified anomaly detection
    const anomalies = [];
    
    // Check for unusual event types
    const eventTypeCounts = this._groupEventsByType(events);
    const avgCount = Object.values(eventTypeCounts).reduce((a, b) => a + b, 0) / Object.keys(eventTypeCounts).length;
    
    Object.entries(eventTypeCounts).forEach(([eventType, count]) => {
      if (count > avgCount * 3) {
        anomalies.push({
          type: 'unusual_event_frequency',
          eventType,
          count,
          threshold: avgCount * 3,
          severity: SEVERITY_LEVELS.MEDIUM
        });
      }
    });
    
    return anomalies;
  }

  _assessOverallRisk(events) {
    const criticalCount = events.filter(e => e.severity === SEVERITY_LEVELS.CRITICAL).length;
    const highCount = events.filter(e => e.severity === SEVERITY_LEVELS.HIGH).length;
    
    let level = 'low';
    let score = 0;
    
    if (criticalCount > 0) {
      level = 'critical';
      score = 90 + Math.min(criticalCount * 5, 10);
    } else if (highCount > 5) {
      level = 'high';
      score = 70 + Math.min(highCount * 2, 20);
    } else if (highCount > 0 || events.length > 50) {
      level = 'medium';
      score = 40 + Math.min(events.length, 30);
    } else {
      score = Math.min(events.length * 2, 30);
    }
    
    return {
      level,
      score,
      factors: {
        criticalEvents: criticalCount,
        highSeverityEvents: highCount,
        totalEvents: events.length
      }
    };
  }

  _getTopViolations(events) {
    const violations = this._groupEventsByType(events);
    return Object.entries(violations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  _calculateSecurityTrends(events) {
    // Simplified trend calculation
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    const lastHour = events.filter(e => e.timestamp > hourAgo).length;
    const lastDay = events.filter(e => e.timestamp > dayAgo).length;
    
    return {
      lastHour,
      lastDay,
      trend: lastHour > lastDay / 24 ? 'increasing' : 'stable'
    };
  }

  _generateRecommendations(events, patterns) {
    const recommendations = [];
    
    if (events.filter(e => e.severity === SEVERITY_LEVELS.CRITICAL).length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'immediate_action',
        message: 'Critical security events detected - immediate investigation required'
      });
    }
    
    if (patterns.anomalies.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'monitoring',
        message: 'Anomalous activity patterns detected - enhance monitoring'
      });
    }
    
    return recommendations;
  }

  _groupEventsByTimeWindow(events, windowSize) {
    return events.reduce((groups, event) => {
      const window = Math.floor(event.timestamp / windowSize) * windowSize;
      groups[window] = (groups[window] || 0) + 1;
      return groups;
    }, {});
  }

  _convertToCSV(events) {
    const headers = ['id', 'timestamp', 'eventType', 'severity', 'component', 'violationType'];
    const rows = events.map(event => [
      event.id,
      event.timestamp,
      event.eventType,
      event.severity,
      event.source.component,
      event.details.violationType
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  _convertToText(events) {
    return events.map(event => 
      `[${event.timestamp}] ${event.severity.toUpperCase()} - ${event.eventType} from ${event.source.component}: ${event.details.violationType}`
    ).join('\n');
  }

  _getLogFiles() {
    try {
      return readdirSync(this.config.logDirectory)
        .filter(file => file.endsWith('.log'))
        .sort();
    } catch (error) {
      return [];
    }
  }

  _cleanupOldLogFiles() {
    const logFiles = this._getLogFiles();
    
    if (logFiles.length > this.config.maxLogFiles) {
      const filesToDelete = logFiles.slice(0, logFiles.length - this.config.maxLogFiles);
      
      filesToDelete.forEach(file => {
        try {
          unlinkSync(join(this.config.logDirectory, file));
          console.log(`[AUDIT] Deleted old log file: ${file}`);
        } catch (error) {
          console.error(`[AUDIT] Failed to delete log file: ${file}`, error.message);
        }
      });
    }
  }
}

// Create singleton instance
export const securityAuditSystem = new SecurityAuditSystem();

// Export error codes for consistency
export const AUDIT_ERROR_CODES = {
  LOG_WRITE_FAILED: 'AUDIT_001',
  PATTERN_ANALYSIS_FAILED: 'AUDIT_002',
  ALERT_HANDLER_FAILED: 'AUDIT_003',
  EXPORT_FAILED: 'AUDIT_004',
  ROTATION_FAILED: 'AUDIT_005'
};

console.log('[AUDIT] Security Audit System module loaded');