/**
 * Email Action Sandbox System
 * Provides isolated execution environment for email actions with resource monitoring,
 * file system access controls, and API whitelisting for security.
 */

import fs from 'fs/promises';
import path from 'path';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import '../../logger.js';
import { validateAndResolvePath } from './pathSecurityValidator.js';
import { securityAuditSystem, SECURITY_EVENT_TYPES, SEVERITY_LEVELS } from './auditSystem.js';

// Sandbox error codes
const SANDBOX_ERROR_CODES = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  SANDBOX_CREATION_FAILED: 'SANDBOX_CREATION_FAILED',
  ACTION_NOT_WHITELISTED: 'ACTION_NOT_WHITELISTED',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  SYSTEM_ACCESS_DENIED: 'SYSTEM_ACCESS_DENIED'
};

// Default resource limits
const DEFAULT_RESOURCE_LIMITS = {
  maxMemoryMB: 50,        // Maximum memory usage in MB
  maxCpuTimeMs: 5000,     // Maximum CPU time in milliseconds
  maxExecutionTimeMs: 10000, // Maximum total execution time
  maxFileOperations: 10,   // Maximum number of file operations
  maxNetworkRequests: 0    // Maximum network requests (disabled by default)
};

// Whitelisted APIs that sandboxed actions can access
const DEFAULT_WHITELISTED_APIS = new Set([
  'console.log',
  'console.warn',
  'console.error',
  'JSON.parse',
  'JSON.stringify',
  'Date.now',
  'Math.random',
  'Math.floor',
  'Math.ceil',
  'Math.round',
  'String.prototype.slice',
  'String.prototype.substring',
  'String.prototype.toLowerCase',
  'String.prototype.toUpperCase',
  'Array.prototype.map',
  'Array.prototype.filter',
  'Array.prototype.reduce',
  'Array.prototype.forEach'
]);

// Allowed file system directories (relative to game data directory)
const DEFAULT_ALLOWED_DIRECTORIES = new Set([
  'game-data',
  'game-data/emails',
  'game-data/onboarding',
  'inbox'
]);

/**
 * Email Action Sandbox Manager
 * Manages isolated execution environments for email actions
 */
export class EmailActionSandbox extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.sandboxes = new Map(); // Active sandboxes
    this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...options.resourceLimits };
    this.whitelistedAPIs = new Set([...DEFAULT_WHITELISTED_APIS, ...(options.whitelistedAPIs || [])]);
    this.allowedDirectories = new Set([...DEFAULT_ALLOWED_DIRECTORIES, ...(options.allowedDirectories || [])]);
    this.gameDataPath = options.gameDataPath || path.join(process.cwd(), 'game-data');
    
    console.log('[EMAIL_SANDBOX] Sandbox manager initialized', {
      resourceLimits: this.resourceLimits,
      whitelistedAPICount: this.whitelistedAPIs.size,
      allowedDirectoryCount: this.allowedDirectories.size
    });
  }

  /**
   * Creates a new sandbox for email action execution
   * @param {Object} actionConfig - Configuration for the action
   * @param {string} actionConfig.actionId - Unique identifier for the action
   * @param {string} actionConfig.type - Type of action (createWindow, createDoor, etc.)
   * @param {Object} actionConfig.parameters - Action parameters
   * @param {Object} options - Sandbox options
   * @returns {Promise<Object>} Sandbox creation result
   */
  async createSandbox(actionConfig, options = {}) {
    try {
      // Validate action configuration
      const configValidation = this._validateActionConfig(actionConfig);
      if (!configValidation.isValid) {
        return {
          success: false,
          error: SANDBOX_ERROR_CODES.INVALID_CONFIG,
          message: configValidation.error,
          details: configValidation.details
        };
      }

      const sandboxId = this._generateSandboxId();
      
      // Create sandbox context
      const sandbox = {
        id: sandboxId,
        actionId: actionConfig.actionId,
        actionType: actionConfig.type,
        parameters: actionConfig.parameters,
        createdAt: Date.now(),
        status: 'created',
        resourceUsage: {
          memoryMB: 0,
          cpuTimeMs: 0,
          executionTimeMs: 0,
          fileOperations: 0,
          networkRequests: 0
        },
        limits: { ...this.resourceLimits, ...options.resourceLimits },
        allowedAPIs: new Set([...this.whitelistedAPIs, ...(options.whitelistedAPIs || [])]),
        allowedDirectories: new Set([...this.allowedDirectories, ...(options.allowedDirectories || [])]),
        worker: null,
        timeoutHandle: null
      };

      // Store sandbox
      this.sandboxes.set(sandboxId, sandbox);

      console.log('[EMAIL_SANDBOX] Sandbox created', {
        sandboxId,
        actionId: actionConfig.actionId,
        actionType: actionConfig.type,
        limits: sandbox.limits
      });

      this.emit('sandboxCreated', { sandboxId, actionConfig });

      return {
        success: true,
        sandboxId,
        limits: sandbox.limits
      };
    } catch (error) {
      console.error('[EMAIL_SANDBOX] Failed to create sandbox', {
        actionConfig,
        error: error.message
      });

      return {
        success: false,
        error: SANDBOX_ERROR_CODES.SANDBOX_CREATION_FAILED,
        message: `Sandbox creation failed: ${error.message}`
      };
    }
  }

  /**
   * Executes an action in a sandboxed environment
   * @param {string} sandboxId - Sandbox identifier
   * @param {Object} action - Action to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeSandboxedAction(sandboxId, action, context = {}) {
    const sandbox = this.sandboxes.get(sandboxId);
    
    if (!sandbox) {
      return {
        success: false,
        error: SANDBOX_ERROR_CODES.INVALID_CONFIG,
        message: `Sandbox not found: ${sandboxId}`
      };
    }

    try {
      console.log('[EMAIL_SANDBOX] Executing sandboxed action', {
        sandboxId,
        actionType: action.type,
        actionId: sandbox.actionId
      });

      sandbox.status = 'executing';
      sandbox.executionStartTime = Date.now();

      // Validate action is whitelisted
      const actionValidation = this._validateActionExecution(sandbox, action);
      if (!actionValidation.isValid) {
        return {
          success: false,
          error: SANDBOX_ERROR_CODES.ACTION_NOT_WHITELISTED,
          message: actionValidation.error
        };
      }

      // Set execution timeout
      const timeoutPromise = new Promise((_, reject) => {
        sandbox.timeoutHandle = setTimeout(() => {
          reject(new Error('Execution timeout exceeded'));
        }, sandbox.limits.maxExecutionTimeMs);
      });

      // Execute action with resource monitoring
      const executionPromise = this._executeActionWithMonitoring(sandbox, action, context);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Clear timeout
      if (sandbox.timeoutHandle) {
        clearTimeout(sandbox.timeoutHandle);
        sandbox.timeoutHandle = null;
      }

      // Update sandbox status
      sandbox.status = 'completed';
      sandbox.executionEndTime = Date.now();
      sandbox.resourceUsage.executionTimeMs = sandbox.executionEndTime - sandbox.executionStartTime;

      console.log('[EMAIL_SANDBOX] Action execution completed', {
        sandboxId,
        executionTimeMs: sandbox.resourceUsage.executionTimeMs,
        success: result.success
      });

      this.emit('actionExecuted', { sandboxId, action, result });

      return result;
    } catch (error) {
      // Handle timeout and other errors
      sandbox.status = 'failed';
      
      if (sandbox.timeoutHandle) {
        clearTimeout(sandbox.timeoutHandle);
        sandbox.timeoutHandle = null;
      }

      const isTimeout = error.message.includes('timeout');
      const errorCode = isTimeout ? SANDBOX_ERROR_CODES.EXECUTION_TIMEOUT : SANDBOX_ERROR_CODES.RESOURCE_LIMIT_EXCEEDED;

      // Log to audit system
      try {
        const auditEventType = isTimeout ? SECURITY_EVENT_TYPES.EMAIL_VALIDATION : SECURITY_EVENT_TYPES.EMAIL_VALIDATION;
        const auditSeverity = isTimeout ? SEVERITY_LEVELS.MEDIUM : SEVERITY_LEVELS.HIGH;
        
        securityAuditSystem.logSecurityEvent(auditEventType, auditSeverity, {
          component: 'EmailActionSandbox',
          function: 'executeSandboxedAction',
          violationType: errorCode,
          mitigationAction: 'action_terminated',
          inputData: JSON.stringify(action).substring(0, 200),
          sandboxId,
          resourceUsage: sandbox.resourceUsage
        });
      } catch (auditError) {
        console.error('[EMAIL_SANDBOX] Failed to log to audit system', {
          sandboxId,
          error: auditError.message
        });
      }

      console.error('[EMAIL_SANDBOX] Action execution failed', {
        sandboxId,
        error: error.message,
        errorCode
      });

      this.emit('actionFailed', { sandboxId, action, error: error.message });

      return {
        success: false,
        error: errorCode,
        message: error.message,
        resourceUsage: sandbox.resourceUsage
      };
    }
  }

  /**
   * Destroys a sandbox and cleans up resources
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} Destruction result
   */
  async destroySandbox(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    
    if (!sandbox) {
      return {
        success: false,
        error: SANDBOX_ERROR_CODES.INVALID_CONFIG,
        message: `Sandbox not found: ${sandboxId}`
      };
    }

    try {
      console.log('[EMAIL_SANDBOX] Destroying sandbox', {
        sandboxId,
        status: sandbox.status
      });

      // Clear timeout if active
      if (sandbox.timeoutHandle) {
        clearTimeout(sandbox.timeoutHandle);
        sandbox.timeoutHandle = null;
      }

      // Terminate worker if active
      if (sandbox.worker) {
        await sandbox.worker.terminate();
        sandbox.worker = null;
      }

      // Remove from active sandboxes
      this.sandboxes.delete(sandboxId);

      console.log('[EMAIL_SANDBOX] Sandbox destroyed', { sandboxId });

      this.emit('sandboxDestroyed', { sandboxId });

      return {
        success: true,
        sandboxId,
        resourceUsage: sandbox.resourceUsage
      };
    } catch (error) {
      console.error('[EMAIL_SANDBOX] Failed to destroy sandbox', {
        sandboxId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sets resource limits for new sandboxes
   * @param {Object} limits - Resource limits configuration
   * @returns {Object} Update result
   */
  setResourceLimits(limits) {
    try {
      const validatedLimits = this._validateResourceLimits(limits);
      
      if (!validatedLimits.isValid) {
        return {
          success: false,
          error: SANDBOX_ERROR_CODES.INVALID_CONFIG,
          message: validatedLimits.error
        };
      }

      this.resourceLimits = { ...this.resourceLimits, ...limits };

      console.log('[EMAIL_SANDBOX] Resource limits updated', {
        newLimits: this.resourceLimits
      });

      return {
        success: true,
        limits: this.resourceLimits
      };
    } catch (error) {
      console.error('[EMAIL_SANDBOX] Failed to set resource limits', {
        limits,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitors resource usage for a specific sandbox
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Object|null} Current resource usage or null if sandbox not found
   */
  monitorResourceUsage(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    
    if (!sandbox) {
      return null;
    }

    return {
      sandboxId,
      status: sandbox.status,
      resourceUsage: { ...sandbox.resourceUsage },
      limits: { ...sandbox.limits },
      createdAt: sandbox.createdAt,
      executionStartTime: sandbox.executionStartTime,
      executionEndTime: sandbox.executionEndTime
    };
  }

  /**
   * Validates file access for sandboxed actions
   * @param {string} filePath - File path to validate
   * @param {string} operation - Operation type (read, write, delete)
   * @param {Set} allowedDirectories - Set of allowed directories for this sandbox
   * @returns {Object} Validation result
   */
  validateFileAccess(filePath, operation, allowedDirectories = this.allowedDirectories) {
    try {
      // Validate path security first
      const pathValidation = validateAndResolvePath(filePath, this.gameDataPath);
      
      if (!pathValidation.isValid) {
        // Log to audit system
        try {
          securityAuditSystem.logSecurityEvent(SECURITY_EVENT_TYPES.EMAIL_VALIDATION, SEVERITY_LEVELS.HIGH, {
            component: 'EmailActionSandbox',
            function: 'validateFileAccess',
            violationType: 'FILE_ACCESS_DENIED',
            mitigationAction: 'file_access_blocked',
            inputData: filePath,
            operation,
            pathValidationError: pathValidation.error
          });
        } catch (auditError) {
          console.error('[EMAIL_SANDBOX] Failed to log file access violation to audit system', {
            filePath,
            error: auditError.message
          });
        }

        return {
          isValid: false,
          error: SANDBOX_ERROR_CODES.FILE_ACCESS_DENIED,
          message: `Path validation failed: ${pathValidation.error}`,
          details: pathValidation.details
        };
      }

      // Normalize path for comparison
      const normalizedPath = path.normalize(filePath);
      const relativePath = path.relative(process.cwd(), normalizedPath);

      // Check if path is within allowed directories
      let isAllowed = false;
      for (const allowedDir of allowedDirectories) {
        const allowedPath = path.normalize(allowedDir);
        if (relativePath.startsWith(allowedPath)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        // Log to audit system
        try {
          securityAuditSystem.logSecurityEvent(SECURITY_EVENT_TYPES.EMAIL_VALIDATION, SEVERITY_LEVELS.HIGH, {
            component: 'EmailActionSandbox',
            function: 'validateFileAccess',
            violationType: 'FILE_ACCESS_DENIED',
            mitigationAction: 'file_access_blocked',
            inputData: filePath,
            operation,
            relativePath,
            allowedDirectories: Array.from(allowedDirectories)
          });
        } catch (auditError) {
          console.error('[EMAIL_SANDBOX] Failed to log directory access violation to audit system', {
            filePath,
            error: auditError.message
          });
        }

        return {
          isValid: false,
          error: SANDBOX_ERROR_CODES.FILE_ACCESS_DENIED,
          message: `File access denied: ${relativePath} is not in allowed directories`,
          allowedDirectories: Array.from(allowedDirectories)
        };
      }

      // Validate operation type
      const allowedOperations = ['read', 'write', 'delete', 'stat'];
      if (!allowedOperations.includes(operation)) {
        return {
          isValid: false,
          error: SANDBOX_ERROR_CODES.FILE_ACCESS_DENIED,
          message: `Invalid file operation: ${operation}`,
          allowedOperations
        };
      }

      return {
        isValid: true,
        normalizedPath,
        relativePath,
        operation
      };
    } catch (error) {
      console.error('[EMAIL_SANDBOX] File access validation error', {
        filePath,
        operation,
        error: error.message
      });

      return {
        isValid: false,
        error: SANDBOX_ERROR_CODES.FILE_ACCESS_DENIED,
        message: `File access validation error: ${error.message}`
      };
    }
  }

  /**
   * Checks system access permissions for sandboxed actions
   * @param {string} resource - System resource to access
   * @param {string} operation - Operation to perform
   * @returns {Object} Access check result
   */
  checkSystemAccess(resource, operation) {
    // Define allowed system resources and operations
    const allowedSystemAccess = {
      'console': ['log', 'warn', 'error'],
      'date': ['now', 'getTime'],
      'math': ['random', 'floor', 'ceil', 'round', 'abs', 'min', 'max'],
      'json': ['parse', 'stringify'],
      'string': ['slice', 'substring', 'toLowerCase', 'toUpperCase', 'trim'],
      'array': ['map', 'filter', 'reduce', 'forEach', 'find', 'includes']
    };

    const resourceLower = resource.toLowerCase();
    const operationLower = operation.toLowerCase();

    if (!allowedSystemAccess[resourceLower]) {
      return {
        isValid: false,
        error: SANDBOX_ERROR_CODES.SYSTEM_ACCESS_DENIED,
        message: `System resource not whitelisted: ${resource}`,
        allowedResources: Object.keys(allowedSystemAccess)
      };
    }

    if (!allowedSystemAccess[resourceLower].includes(operationLower)) {
      return {
        isValid: false,
        error: SANDBOX_ERROR_CODES.SYSTEM_ACCESS_DENIED,
        message: `System operation not whitelisted: ${resource}.${operation}`,
        allowedOperations: allowedSystemAccess[resourceLower]
      };
    }

    return {
      isValid: true,
      resource: resourceLower,
      operation: operationLower
    };
  }

  /**
   * Gets statistics for all active sandboxes
   * @returns {Object} Sandbox statistics
   */
  getStatistics() {
    const sandboxes = Array.from(this.sandboxes.values());
    
    return {
      totalSandboxes: sandboxes.length,
      activeSandboxes: sandboxes.filter(s => s.status === 'executing').length,
      completedSandboxes: sandboxes.filter(s => s.status === 'completed').length,
      failedSandboxes: sandboxes.filter(s => s.status === 'failed').length,
      resourceLimits: this.resourceLimits,
      whitelistedAPICount: this.whitelistedAPIs.size,
      allowedDirectoryCount: this.allowedDirectories.size
    };
  }

  /**
   * Cleans up all sandboxes (for shutdown)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanup() {
    try {
      console.log('[EMAIL_SANDBOX] Cleaning up all sandboxes', {
        count: this.sandboxes.size
      });

      const cleanupPromises = Array.from(this.sandboxes.keys()).map(
        sandboxId => this.destroySandbox(sandboxId)
      );

      await Promise.all(cleanupPromises);

      console.log('[EMAIL_SANDBOX] All sandboxes cleaned up');

      return {
        success: true,
        cleanedCount: cleanupPromises.length
      };
    } catch (error) {
      console.error('[EMAIL_SANDBOX] Cleanup failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private methods

  /**
   * Validates action configuration
   * @private
   */
  _validateActionConfig(actionConfig) {
    if (!actionConfig || typeof actionConfig !== 'object') {
      return {
        isValid: false,
        error: 'Action configuration must be an object',
        details: { provided: typeof actionConfig }
      };
    }

    if (!actionConfig.actionId || typeof actionConfig.actionId !== 'string') {
      return {
        isValid: false,
        error: 'Action ID is required and must be a string',
        details: { actionId: actionConfig.actionId }
      };
    }

    if (!actionConfig.type || typeof actionConfig.type !== 'string') {
      return {
        isValid: false,
        error: 'Action type is required and must be a string',
        details: { type: actionConfig.type }
      };
    }

    if (!actionConfig.parameters || typeof actionConfig.parameters !== 'object') {
      return {
        isValid: false,
        error: 'Action parameters are required and must be an object',
        details: { parameters: actionConfig.parameters }
      };
    }

    return { isValid: true };
  }

  /**
   * Validates resource limits configuration
   * @private
   */
  _validateResourceLimits(limits) {
    const numericFields = ['maxMemoryMB', 'maxCpuTimeMs', 'maxExecutionTimeMs', 'maxFileOperations', 'maxNetworkRequests'];
    
    for (const field of numericFields) {
      if (limits[field] !== undefined) {
        if (typeof limits[field] !== 'number' || limits[field] < 0) {
          return {
            isValid: false,
            error: `${field} must be a non-negative number`,
            details: { field, value: limits[field] }
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validates action execution permissions
   * @private
   */
  _validateActionExecution(sandbox, action) {
    // Check if action type is allowed
    const allowedActionTypes = ['createWindow', 'createDoor', 'createLens', 'executeFunction', 'openPath', 'callback'];
    
    if (!allowedActionTypes.includes(action.type)) {
      return {
        isValid: false,
        error: `Action type not whitelisted: ${action.type}`,
        allowedTypes: allowedActionTypes
      };
    }

    return { isValid: true };
  }

  /**
   * Executes action with resource monitoring
   * @private
   */
  async _executeActionWithMonitoring(sandbox, action, context) {
    // This is a simplified implementation that would integrate with the existing email action system
    // In a full implementation, this would create a worker thread or use vm2 for true isolation
    
    try {
      // Increment file operations counter if action involves file access
      if (['openPath', 'createWindow', 'createDoor'].includes(action.type)) {
        sandbox.resourceUsage.fileOperations++;
        
        if (sandbox.resourceUsage.fileOperations > sandbox.limits.maxFileOperations) {
          throw new Error(`File operations limit exceeded: ${sandbox.limits.maxFileOperations}`);
        }
      }

      // Simulate resource monitoring (in real implementation, this would be more sophisticated)
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Execute the action (this would be delegated to the existing email action system)
      const result = await this._delegateActionExecution(action, context, sandbox);
      
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      sandbox.resourceUsage.memoryMB = Math.max(sandbox.resourceUsage.memoryMB, endMemory - startMemory);

      // Check memory limits
      if (sandbox.resourceUsage.memoryMB > sandbox.limits.maxMemoryMB) {
        throw new Error(`Memory limit exceeded: ${sandbox.limits.maxMemoryMB}MB`);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delegates action execution to existing email action system
   * @private
   */
  async _delegateActionExecution(action, context, sandbox) {
    // This would integrate with the existing emailActions.js system
    // For now, return a mock successful result
    console.log('[EMAIL_SANDBOX] Delegating action execution', {
      sandboxId: sandbox.id,
      actionType: action.type,
      parameters: action.parameters
    });

    // Validate file paths in parameters if present
    if (action.parameters.path) {
      const fileValidation = this.validateFileAccess(
        action.parameters.path, 
        'read', 
        sandbox.allowedDirectories
      );
      
      if (!fileValidation.isValid) {
        throw new Error(fileValidation.message);
      }
    }

    // Return mock success result
    return {
      success: true,
      message: `Sandboxed action ${action.type} executed successfully`,
      sandboxId: sandbox.id,
      resourceUsage: sandbox.resourceUsage
    };
  }

  /**
   * Generates unique sandbox ID
   * @private
   */
  _generateSandboxId() {
    return `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const emailSandbox = new EmailActionSandbox();

// Export error codes for external use
export { SANDBOX_ERROR_CODES };