/**
 * Email Action Executor
 * Handles execution of action callbacks defined in email JSON
 */

import '../../logger.js';
import { createWindow, createDoor, createKey } from '../systems/windowManager.js';
import { createLensWindow } from '../systems/windowManager.js';
import { shell } from 'electron';
import path from 'node:path';
import { triggerEmailActionExecuted } from '../core/callbacks/emailCallbacks.js';

// Callback registry for custom functions
const callbackRegistry = new Map();

// Supported action types
const ACTION_TYPES = {
  CREATE_WINDOW: 'createWindow',
  CREATE_DOOR: 'createDoor',
  CREATE_LENS: 'createLens',
  EXECUTE_FUNCTION: 'executeFunction',
  OPEN_PATH: 'openPath',
  CALLBACK: 'callback'
};

/**
 * Validates action parameters
 * @param {Object} action - Action object from email JSON
 * @returns {Object} Validation result
 */
function validateAction(action) {
  if (!action || typeof action !== 'object') {
    return {
      isValid: false,
      error: 'Action must be an object'
    };
  }

  if (!action.type || typeof action.type !== 'string') {
    return {
      isValid: false,
      error: 'Action type is required and must be a string'
    };
  }

  if (!Object.values(ACTION_TYPES).includes(action.type)) {
    return {
      isValid: false,
      error: `Unknown action type: ${action.type}. Supported types: ${Object.values(ACTION_TYPES).join(', ')}`
    };
  }

  if (!action.parameters || typeof action.parameters !== 'object') {
    return {
      isValid: false,
      error: 'Action parameters are required and must be an object'
    };
  }

  return {
    isValid: true
  };
}

/**
 * Validates createWindow action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateCreateWindowParams(params) {
  if (!params.id || typeof params.id !== 'string') {
    return {
      isValid: false,
      error: 'Window ID is required and must be a string'
    };
  }

  if (params.width !== undefined && (typeof params.width !== 'number' || params.width <= 0)) {
    return {
      isValid: false,
      error: 'Window width must be a positive number'
    };
  }

  if (params.height !== undefined && (typeof params.height !== 'number' || params.height <= 0)) {
    return {
      isValid: false,
      error: 'Window height must be a positive number'
    };
  }

  return { isValid: true };
}

/**
 * Validates createDoor action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateCreateDoorParams(params) {
  if (!params.doorId || typeof params.doorId !== 'string') {
    return {
      isValid: false,
      error: 'Door ID is required and must be a string'
    };
  }

  if (params.encrypt !== undefined && typeof params.encrypt !== 'boolean') {
    return {
      isValid: false,
      error: 'Encrypt parameter must be a boolean'
    };
  }

  return { isValid: true };
}

/**
 * Validates createLens action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateCreateLensParams(params) {
  if (!params.lensId || typeof params.lensId !== 'string') {
    return {
      isValid: false,
      error: 'Lens ID is required and must be a string'
    };
  }

  if (!params.targetWindowId || typeof params.targetWindowId !== 'string') {
    return {
      isValid: false,
      error: 'Target window ID is required and must be a string'
    };
  }

  if (params.width !== undefined && (typeof params.width !== 'number' || params.width <= 0)) {
    return {
      isValid: false,
      error: 'Lens width must be a positive number'
    };
  }

  if (params.height !== undefined && (typeof params.height !== 'number' || params.height <= 0)) {
    return {
      isValid: false,
      error: 'Lens height must be a positive number'
    };
  }

  return { isValid: true };
}

/**
 * Validates executeFunction action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateExecuteFunctionParams(params) {
  if (!params.functionName || typeof params.functionName !== 'string') {
    return {
      isValid: false,
      error: 'Function name is required and must be a string'
    };
  }

  if (params.args !== undefined && !Array.isArray(params.args)) {
    return {
      isValid: false,
      error: 'Function arguments must be an array'
    };
  }

  return { isValid: true };
}

/**
 * Validates openPath action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateOpenPathParams(params) {
  if (!params.path || typeof params.path !== 'string') {
    return {
      isValid: false,
      error: 'Path is required and must be a string'
    };
  }

  return { isValid: true };
}

/**
 * Handles createWindow action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleCreateWindow(params) {
  console.log('[EMAIL_ACTION] Executing createWindow action', { params });

  try {
    const windowOptions = {
      width: params.width || 800,
      height: params.height || 600,
      title: params.title || params.id,
      otherContents: params.otherContents || 'index.html'
    };

    const window = createWindow(params.id, windowOptions);

    if (!window || window.isDestroyed()) {
      throw new Error('Failed to create window');
    }

    console.log(`[EMAIL_ACTION] Window created successfully: ${params.id}`);

    return {
      success: true,
      message: `Window '${params.id}' created successfully`,
      windowId: params.id
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to create window', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to create window: ${error.message}`
    };
  }
}

/**
 * Handles createDoor action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleCreateDoor(params) {
  console.log('[EMAIL_ACTION] Executing createDoor action', { params });

  try {
    const door = createDoor(
      params.doorId,
      params.title || null,
      params.encrypt || false,
      params.otherContents || null
    );

    if (!door || door.isDestroyed()) {
      throw new Error('Failed to create door');
    }

    console.log(`[EMAIL_ACTION] Door created successfully: ${params.doorId}`);

    return {
      success: true,
      message: `Door '${params.doorId}' created successfully`,
      doorId: params.doorId
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to create door', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to create door: ${error.message}`
    };
  }
}

/**
 * Handles createLens action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleCreateLens(params) {
  console.log('[EMAIL_ACTION] Executing createLens action', { params });

  try {
    const lensOptions = {
      width: params.width || 300,
      height: params.height || 200
    };

    const result = createLensWindow(params.lensId, params.targetWindowId, lensOptions);

    if (!result.success) {
      throw new Error(result.message || 'Failed to create lens');
    }

    console.log(`[EMAIL_ACTION] Lens created successfully: ${params.lensId}`);

    return {
      success: true,
      message: `Lens '${params.lensId}' created successfully`,
      lensId: params.lensId
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to create lens', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to create lens: ${error.message}`
    };
  }
}

/**
 * Handles executeFunction action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleExecuteFunction(params) {
  console.log('[EMAIL_ACTION] Executing executeFunction action', { params });

  try {
    // For security, we only allow execution of whitelisted functions
    const allowedFunctions = {
      'console.log': (...args) => {
        console.log('[EMAIL_ACTION] Custom function:', ...args);
        return { logged: true, args };
      }
    };

    const func = allowedFunctions[params.functionName];

    if (!func) {
      throw new Error(`Function '${params.functionName}' is not whitelisted for execution`);
    }

    const args = params.args || [];
    const result = await func(...args);

    console.log(`[EMAIL_ACTION] Function executed successfully: ${params.functionName}`);

    return {
      success: true,
      message: `Function '${params.functionName}' executed successfully`,
      result
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to execute function', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to execute function: ${error.message}`
    };
  }
}

/**
 * Handles openPath action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleOpenPath(params) {
  console.log('[EMAIL_ACTION] Executing openPath action', { params });

  try {
    let fullPath = params.path;

    // If path is relative, resolve it relative to project root
    if (!path.isAbsolute(fullPath)) {
      fullPath = path.join(process.cwd(), fullPath);
    }

    // Use Electron's shell to open the path
    await shell.openPath(fullPath);

    console.log(`[EMAIL_ACTION] Path opened successfully: ${fullPath}`);

    return {
      success: true,
      message: `Path '${params.path}' opened successfully`,
      path: fullPath
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to open path', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to open path: ${error.message}`
    };
  }
}

/**
 * Validates callback action parameters
 * @param {Object} params - Action parameters
 * @returns {Object} Validation result
 */
function validateCallbackParams(params) {
  if (!params.name || typeof params.name !== 'string') {
    return {
      isValid: false,
      error: 'Callback name is required and must be a string'
    };
  }

  if (params.args !== undefined && !Array.isArray(params.args)) {
    return {
      isValid: false,
      error: 'Callback arguments must be an array'
    };
  }

  return { isValid: true };
}

/**
 * Handles callback action
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} Execution result
 */
async function handleCallback(params) {
  console.log('[EMAIL_ACTION] Executing callback action', { params });

  try {
    const callback = callbackRegistry.get(params.name);

    if (!callback) {
      throw new Error(`Callback '${params.name}' is not registered. Use registerEmailCallback() to register it first.`);
    }

    const args = params.args || [];
    const result = await callback(...args);

    console.log(`[EMAIL_ACTION] Callback executed successfully: ${params.name}`);

    return {
      success: true,
      message: `Callback '${params.name}' executed successfully`,
      result
    };
  } catch (error) {
    console.error('[EMAIL_ACTION] Failed to execute callback', {
      params,
      error: error.message
    });

    return {
      success: false,
      error: `Failed to execute callback: ${error.message}`
    };
  }
}

// Action handler mapping
const ACTION_HANDLERS = {
  [ACTION_TYPES.CREATE_WINDOW]: handleCreateWindow,
  [ACTION_TYPES.CREATE_DOOR]: handleCreateDoor,
  [ACTION_TYPES.CREATE_LENS]: handleCreateLens,
  [ACTION_TYPES.EXECUTE_FUNCTION]: handleExecuteFunction,
  [ACTION_TYPES.OPEN_PATH]: handleOpenPath,
  [ACTION_TYPES.CALLBACK]: handleCallback
};

// Parameter validation mapping
const PARAM_VALIDATORS = {
  [ACTION_TYPES.CREATE_WINDOW]: validateCreateWindowParams,
  [ACTION_TYPES.CREATE_DOOR]: validateCreateDoorParams,
  [ACTION_TYPES.CREATE_LENS]: validateCreateLensParams,
  [ACTION_TYPES.EXECUTE_FUNCTION]: validateExecuteFunctionParams,
  [ACTION_TYPES.OPEN_PATH]: validateOpenPathParams,
  [ACTION_TYPES.CALLBACK]: validateCallbackParams
};

/**
 * Executes an email action
 * @param {Object} action - Action object from email JSON
 * @param {string} emailId - Email ID that triggered the action (optional)
 * @returns {Promise<Object>} Execution result
 */
export async function executeEmailAction(action, emailId = null) {
  console.log('[EMAIL_ACTION] Executing email action', { action, emailId });

  try {
    // Validate action structure
    const actionValidation = validateAction(action);
    if (!actionValidation.isValid) {
      console.error('[EMAIL_ACTION] Action validation failed', {
        error: actionValidation.error
      });

      return {
        success: false,
        error: actionValidation.error
      };
    }

    // Validate action parameters
    const paramValidator = PARAM_VALIDATORS[action.type];
    if (paramValidator) {
      const paramValidation = paramValidator(action.parameters);
      if (!paramValidation.isValid) {
        console.error('[EMAIL_ACTION] Parameter validation failed', {
          type: action.type,
          error: paramValidation.error
        });

        return {
          success: false,
          error: paramValidation.error
        };
      }
    }

    // Execute action
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) {
      throw new Error(`No handler found for action type: ${action.type}`);
    }

    const result = await handler(action.parameters);

    console.log('[EMAIL_ACTION] Action execution completed', {
      type: action.type,
      success: result.success
    });

    // Trigger email action executed callback
    if (emailId) {
      triggerEmailActionExecuted(emailId, {
        actionType: action.type,
        actionLabel: action.label,
        parameters: action.parameters,
        result
      });
    }

    return result;
  } catch (error) {
    console.error('[EMAIL_ACTION] Action execution failed', {
      action,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: `Action execution failed: ${error.message}`
    };
  }
}

/**
 * Gets list of supported action types
 * @returns {Array<string>} Array of supported action types
 */
export function getSupportedActionTypes() {
  return Object.values(ACTION_TYPES);
}

/**
 * Validates an action without executing it
 * @param {Object} action - Action object to validate
 * @returns {Object} Validation result
 */
export function validateEmailAction(action) {
  const actionValidation = validateAction(action);
  if (!actionValidation.isValid) {
    return actionValidation;
  }

  const paramValidator = PARAM_VALIDATORS[action.type];
  if (paramValidator) {
    return paramValidator(action.parameters);
  }

  return { isValid: true };
}

/**
 * Registers a callback function for email actions
 * @param {string} name - Unique name for the callback
 * @param {Function} callback - Function to execute when action is triggered
 * @returns {Object} Registration result
 * 
 * @example
 * registerEmailCallback('startQuest', (questId, difficulty) => {
 *   console.log(`Starting quest ${questId} with difficulty ${difficulty}`);
 *   // Your quest logic here
 *   return { questStarted: true, questId, difficulty };
 * });
 */
export function registerEmailCallback(name, callback) {
  if (!name || typeof name !== 'string') {
    console.error('[EMAIL_ACTION] Invalid callback name', { name });
    return {
      success: false,
      error: 'Callback name must be a non-empty string'
    };
  }

  if (typeof callback !== 'function') {
    console.error('[EMAIL_ACTION] Invalid callback', { name });
    return {
      success: false,
      error: 'Callback must be a function'
    };
  }

  if (callbackRegistry.has(name)) {
    console.warn('[EMAIL_ACTION] Overwriting existing callback', { name });
  }

  callbackRegistry.set(name, callback);
  console.log('[EMAIL_ACTION] Callback registered', { name });

  return {
    success: true,
    message: `Callback '${name}' registered successfully`
  };
}

/**
 * Unregisters a callback function
 * @param {string} name - Name of the callback to unregister
 * @returns {Object} Unregistration result
 */
export function unregisterEmailCallback(name) {
  if (!callbackRegistry.has(name)) {
    console.warn('[EMAIL_ACTION] Callback not found', { name });
    return {
      success: false,
      error: `Callback '${name}' is not registered`
    };
  }

  callbackRegistry.delete(name);
  console.log('[EMAIL_ACTION] Callback unregistered', { name });

  return {
    success: true,
    message: `Callback '${name}' unregistered successfully`
  };
}

/**
 * Gets list of registered callback names
 * @returns {Array<string>} Array of registered callback names
 */
export function getRegisteredCallbacks() {
  return Array.from(callbackRegistry.keys());
}

/**
 * Checks if a callback is registered
 * @param {string} name - Callback name to check
 * @returns {boolean} True if callback is registered
 */
export function isCallbackRegistered(name) {
  return callbackRegistry.has(name);
}

/**
 * Clears all registered callbacks
 * @returns {Object} Clear result
 */
export function clearAllCallbacks() {
  const count = callbackRegistry.size;
  callbackRegistry.clear();
  console.log('[EMAIL_ACTION] All callbacks cleared', { count });

  return {
    success: true,
    message: `Cleared ${count} callback(s)`,
    count
  };
}
