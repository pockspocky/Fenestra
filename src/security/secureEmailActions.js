/**
 * Secure Email Action Executor
 * Wraps email action execution with sandbox security controls
 */

import '../../logger.js';
import { emailSandbox, SANDBOX_ERROR_CODES } from './emailSandbox.js';
import { executeEmailAction, validateEmailAction } from '../storage/emailActions.js';

/**
 * Executes an email action in a secure sandbox environment
 * @param {Object} action - Action object from email JSON
 * @param {string} emailId - Email ID that triggered the action
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Execution result with security context
 */
export async function executeSecureEmailAction(action, emailId = null, options = {}) {
  console.log('[SECURE_EMAIL_ACTION] Starting secure action execution', {
    actionType: action.type,
    emailId,
    hasOptions: !!options
  });

  try {
    // Validate action structure first
    const actionValidation = validateEmailAction(action);
    if (!actionValidation.isValid) {
      console.error('[SECURE_EMAIL_ACTION] Action validation failed', {
        error: actionValidation.error,
        action
      });

      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: actionValidation.error,
        securityContext: {
          sandboxed: false,
          validationFailed: true
        }
      };
    }

    // Create sandbox configuration
    const actionConfig = {
      actionId: `${emailId || 'unknown'}_${action.type}_${Date.now()}`,
      type: action.type,
      parameters: action.parameters
    };

    // Create sandbox
    const sandboxResult = await emailSandbox.createSandbox(actionConfig, options);
    
    if (!sandboxResult.success) {
      console.error('[SECURE_EMAIL_ACTION] Sandbox creation failed', {
        error: sandboxResult.error,
        message: sandboxResult.message
      });

      return {
        success: false,
        error: sandboxResult.error,
        message: `Sandbox creation failed: ${sandboxResult.message}`,
        securityContext: {
          sandboxed: false,
          sandboxCreationFailed: true
        }
      };
    }

    const sandboxId = sandboxResult.sandboxId;

    try {
      console.log('[SECURE_EMAIL_ACTION] Executing action in sandbox', {
        sandboxId,
        actionType: action.type
      });

      // Execute action in sandbox
      const executionResult = await emailSandbox.executeSandboxedAction(
        sandboxId,
        action,
        { emailId, originalAction: action }
      );

      // Get resource usage statistics
      const resourceUsage = emailSandbox.monitorResourceUsage(sandboxId);

      console.log('[SECURE_EMAIL_ACTION] Sandbox execution completed', {
        sandboxId,
        success: executionResult.success,
        resourceUsage: resourceUsage?.resourceUsage
      });

      // If sandbox execution succeeded, delegate to actual email action system
      let finalResult = executionResult;
      
      if (executionResult.success) {
        try {
          // Execute the actual email action with validated parameters
          const actualResult = await executeEmailAction(action, emailId);
          
          // Merge results, prioritizing actual execution result
          finalResult = {
            ...actualResult,
            securityContext: {
              sandboxed: true,
              sandboxId,
              resourceUsage: resourceUsage?.resourceUsage,
              limits: resourceUsage?.limits
            }
          };
        } catch (error) {
          console.error('[SECURE_EMAIL_ACTION] Actual action execution failed', {
            sandboxId,
            error: error.message
          });

          finalResult = {
            success: false,
            error: 'EXECUTION_FAILED',
            message: `Action execution failed: ${error.message}`,
            securityContext: {
              sandboxed: true,
              sandboxId,
              executionFailed: true,
              resourceUsage: resourceUsage?.resourceUsage
            }
          };
        }
      } else {
        // Add security context to failed sandbox execution
        finalResult.securityContext = {
          sandboxed: true,
          sandboxId,
          sandboxExecutionFailed: true,
          resourceUsage: resourceUsage?.resourceUsage
        };
      }

      return finalResult;
    } finally {
      // Always clean up sandbox
      try {
        await emailSandbox.destroySandbox(sandboxId);
      } catch (cleanupError) {
        console.warn('[SECURE_EMAIL_ACTION] Sandbox cleanup failed', {
          sandboxId,
          error: cleanupError.message
        });
      }
    }
  } catch (error) {
    console.error('[SECURE_EMAIL_ACTION] Unexpected error during secure execution', {
      action,
      emailId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: `Secure execution failed: ${error.message}`,
      securityContext: {
        sandboxed: false,
        unexpectedError: true
      }
    };
  }
}

/**
 * Validates file access for email actions
 * @param {string} filePath - File path to validate
 * @param {string} operation - Operation type
 * @returns {Object} Validation result
 */
export function validateEmailActionFileAccess(filePath, operation = 'read') {
  return emailSandbox.validateFileAccess(filePath, operation);
}

/**
 * Checks system access for email actions
 * @param {string} resource - System resource
 * @param {string} operation - Operation to perform
 * @returns {Object} Access check result
 */
export function checkEmailActionSystemAccess(resource, operation) {
  return emailSandbox.checkSystemAccess(resource, operation);
}

/**
 * Gets security statistics for email action execution
 * @returns {Object} Security statistics
 */
export function getEmailActionSecurityStats() {
  return {
    ...emailSandbox.getStatistics(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Configures security settings for email actions
 * @param {Object} config - Security configuration
 * @returns {Object} Configuration result
 */
export function configureEmailActionSecurity(config = {}) {
  const results = {};

  // Update resource limits if provided
  if (config.resourceLimits) {
    results.resourceLimits = emailSandbox.setResourceLimits(config.resourceLimits);
  }

  // Log configuration changes
  console.log('[SECURE_EMAIL_ACTION] Security configuration updated', {
    config,
    results
  });

  return {
    success: true,
    results,
    currentConfig: {
      resourceLimits: emailSandbox.resourceLimits,
      statistics: emailSandbox.getStatistics()
    }
  };
}

/**
 * Performs security audit of email action execution
 * @param {Object} auditOptions - Audit configuration
 * @returns {Object} Audit report
 */
export function auditEmailActionSecurity(auditOptions = {}) {
  const stats = emailSandbox.getStatistics();
  
  const auditReport = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    securityStatus: {
      sandboxingEnabled: true,
      resourceLimitsConfigured: Object.keys(emailSandbox.resourceLimits).length > 0,
      whitelistingEnabled: stats.whitelistedAPICount > 0,
      fileAccessControlEnabled: stats.allowedDirectoryCount > 0
    },
    recommendations: []
  };

  // Generate security recommendations
  if (stats.failedSandboxes > 0) {
    auditReport.recommendations.push({
      type: 'warning',
      message: `${stats.failedSandboxes} sandbox executions failed - review resource limits`,
      priority: 'medium'
    });
  }

  if (stats.whitelistedAPICount < 10) {
    auditReport.recommendations.push({
      type: 'info',
      message: 'Consider expanding API whitelist if actions are being blocked',
      priority: 'low'
    });
  }

  if (stats.allowedDirectoryCount < 3) {
    auditReport.recommendations.push({
      type: 'warning',
      message: 'Very restrictive file access - ensure necessary directories are whitelisted',
      priority: 'medium'
    });
  }

  console.log('[SECURE_EMAIL_ACTION] Security audit completed', {
    auditReport: {
      ...auditReport,
      statistics: undefined // Don't log full stats
    }
  });

  return auditReport;
}

/**
 * Cleans up security resources (for shutdown)
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupEmailActionSecurity() {
  try {
    console.log('[SECURE_EMAIL_ACTION] Cleaning up security resources');
    
    const cleanupResult = await emailSandbox.cleanup();
    
    console.log('[SECURE_EMAIL_ACTION] Security cleanup completed', {
      success: cleanupResult.success
    });

    return cleanupResult;
  } catch (error) {
    console.error('[SECURE_EMAIL_ACTION] Security cleanup failed', {
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}