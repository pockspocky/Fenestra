import { ipcMain } from 'electron';
import sizeOf from 'image-size';
import {
  getConfig,
  getGameDataDirectory,
  setGameDataDirectory,
  resetConfigToDefaults
} from '../core/config.js';
import {
  createWindow,
  setBounds,
  getBounds,
  getWindowsInfo,
  getWindowInfo,
  getWindowTitle,
  updateWindowProperty,
  reloadWindowHtml,
  createPicture,
  setPicture,
  setFitMode,
  createContentWindow,
  createLensWindow,
  setWindowOpacity,
  setWindowAlwaysOnTop,
  updateContentBlur,
  destroyLensSystem,
  getLensSystems,
  getLensSystem
} from '../systems/windowManager.js';
import {
  saveWindowToFile,
  loadWindowFromFile,
  deserializeWindow,
  listStoredWindows,
  deleteStoredWindow,
  validateWindowData
} from '../storage/windowStorage.js';
import { validateAndResolvePath, getDefaultGameDataDirectory, isWithinGameScope, pathValidator } from '../security/pathSecurityValidator.js';
// Note: This file uses validateAndResolvePath() for stateless path validation.
// For stateful operations (unlocking directories for game mechanics), import and use
// the pathValidator singleton directly. See pathSecurityValidator.js documentation.
import { 
  navigateToDirectory, 
  getDirectoryContents, 
  findCommonPrefix, 
  findCommonPrefixWithSpecialChars,
  normalizePathForCompletion,
  escapeFilenameForShell,
  unescapeFilenameFromShell,
  validatePathCharacters
} from '../utils/directoryNavigator.js';
import { checkDirectoryAccess, filterAccessibleDirectories } from '../systems/doorKeySystem.js';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  createErrorResponse, 
  createSuccessResponse,
  withErrorHandling,
  validateInput,
  logError 
} from '../utils/errorHandler.js';
import { wrapIpcHandler } from '../core/callbacks/ipcCallbacks.js';
import { IPCSecurityManager } from '../security/ipcSecurityManager.js';
import { memoryManager } from '../utils/memoryManager.js';
import { securityAuditSystem } from '../security/auditSystem.js';
import { resolveAssetPath } from '../utils/assetPathResolver.js';
import { parseArguments, commandSchemas } from '../utils/argumentParser.js';
import fs from 'node:fs';
import path from 'node:path';
import '../../logger.js'; // Import logging system

// Initialize IPC Security Manager
const ipcSecurityManager = new IPCSecurityManager({
  gameDataRoot: getDefaultGameDataDirectory(),
  auditEnabled: true,
  strictMode: true
});

/**
 * Secure IPC handler wrapper that integrates security validation
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Original handler function
 * @returns {Function} Secured handler function
 */
function secureIpcHandler(channel, handler) {
  return async (event, payload) => {
    const clientId = event.sender.id.toString();
    
    try {
      // Validate IPC message with security manager
      const validation = ipcSecurityManager.validateMessage(channel, payload, clientId);
      
      if (!validation.success) {
        console.warn('[IPC_SECURITY] Message validation failed', {
          channel,
          clientId,
          error: validation.error
        });
        
        return {
          success: false,
          error: validation.error || 'Security validation failed',
          code: validation.code || 'IPC_SECURITY_ERROR'
        };
      }
      
      // Use sanitized payload if available
      const sanitizedPayload = validation.sanitizedPayload || payload;
      
      // Call original handler with sanitized payload
      const result = await handler(event, sanitizedPayload);
      
      // Log successful IPC operation for audit
      securityAuditSystem.logSecurityEvent('ipc_operation', 'low', {
        component: 'IPCHandlers',
        function: channel,
        violationType: 'authorized_ipc_call',
        mitigationAction: 'request_processed',
        inputData: JSON.stringify(sanitizedPayload).substring(0, 200)
      }, {
        clientId,
        sessionId: `session_${clientId}_${Date.now()}`
      });
      
      return result;
      
    } catch (error) {
      console.error('[IPC_SECURITY] Handler execution error', {
        channel,
        clientId,
        error: error.message
      });
      
      // Log security event for handler errors
      securityAuditSystem.logSecurityEvent('ipc_violation', 'medium', {
        component: 'IPCHandlers',
        function: channel,
        violationType: 'handler_execution_error',
        mitigationAction: 'error_returned',
        inputData: error.message
      }, {
        clientId
      });
      
      return {
        success: false,
        error: 'Handler execution failed',
        code: 'IPC_HANDLER_ERROR'
      };
    }
  };
}

/**
 * Initialize IPC handlers
 */
export function initializeIpcHandlers() {
  console.debug('[IPC] Setting up IPC handlers...');

  // Register memory cleanup handler for IPC system
  memoryManager.registerCleanupHandler('ipcHandlers', () => {
    console.log('[IPC] Cleaning up IPC handlers');
    cleanupIpcHandlers();
  });

  ipcMain.handle('game/window/create', secureIpcHandler('game/window/create', wrapIpcHandler('game/window/create', (_e, payload) => {
    console.debug('[IPC] Received create window request:', payload);
    const { id, bounds = {}, title } = payload ?? {};

    if (!id) {
      console.warn('[IPC] Error: Missing window ID');
      return { error: 'id required' };
    }

    console.debug(`[IPC] Starting window creation, ID: ${id}`);
    const win = createWindow(id, { ...bounds, title });
    const response = { ok: true, id, webContentsId: win.webContents.id };

    console.debug('[IPC] Window creation response:', response);
    return response;
  })));

  ipcMain.handle('game/window/set-bounds', secureIpcHandler('game/window/set-bounds', wrapIpcHandler('game/window/set-bounds', (_e, { id, bounds }) => {
    console.debug(`[IPC] Received set bounds request, ID: ${id}, bounds:`, bounds);

    if (!id || !bounds) {
      console.warn('[IPC] Error: Missing ID or bounds parameter');
      return { error: 'id & bounds required' };
    }

    setBounds(id, bounds);
    const response = { ok: true };

    console.debug('[IPC] Set bounds response:', response);
    return response;
  })));

  ipcMain.handle('game/window/get-bounds', secureIpcHandler('game/window/get-bounds', wrapIpcHandler('game/window/get-bounds', (_e, { id }) => {
    console.debug(`[IPC] Received get bounds request, ID: ${id}`);

    const b = getBounds(id);
    const response = b ? { ok: true, bounds: b } : { error: 'not found' };

    console.debug('[IPC] Get bounds response:', response);
    return response;
  })));

  // Terminal command handler
  ipcMain.handle('terminal/execute-command', secureIpcHandler('terminal/execute-command', wrapIpcHandler('terminal/execute-command', (_e, { command, args }) => {
    console.debug(`[IPC] Executing command: ${command}, args:`, args);

    try {
      return executeTerminalCommand(command, args);
    } catch (error) {
      console.error('[IPC] Terminal command execution error:', error);
      return { success: false, message: error.message };
    }
  })));

  // Picture loading handler
  ipcMain.handle('picture/load', secureIpcHandler('picture/load', wrapIpcHandler('picture/load', (_e, imagePath) => {
    console.debug(`[IPC] Image loading request: ${imagePath}`);

    try {
      return loadPictureFile(imagePath);
    } catch (error) {
      console.error('[IPC] Image loading error:', error);
      return { success: false, error: error.message };
    }
  })));

  // Lens system handler
  ipcMain.handle('lens/get-position', secureIpcHandler('lens/get-position', wrapIpcHandler('lens/get-position', (_e, lensId) => {
    console.debug(`[IPC] Get lens position: ${lensId}`);
    const lensInfo = getLensSystem(lensId);
    if (lensInfo && lensInfo.lensBounds) {
      return { success: true, bounds: lensInfo.lensBounds };
    }
    return { success: false, error: 'Lens does not exist or missing position information' };
  })));

  ipcMain.handle('window/get-info', secureIpcHandler('window/get-info', wrapIpcHandler('window/get-info', (_e, windowId) => {
    console.debug(`[IPC] Get window info: ${windowId}`);
    const info = getWindowInfo(windowId);
    if (info) {
      return { success: true, bounds: { x: info.x, y: info.y, width: info.width, height: info.height } };
    }
    return { success: false, error: 'Window does not exist' };
  })));

  // Window storage validation handler
  ipcMain.handle('storage/validate-fenestra-file', secureIpcHandler('storage/validate-fenestra-file', (_e, filePath) => {
    console.debug(`[IPC] Validating .fenestra file: ${filePath}`);

    try {
      return validateFenestraFile(filePath);
    } catch (error) {
      console.error('[IPC] .fenestra file validation error:', error);
      return { success: false, message: error.message };
    }
  }));

  // File system auto-completion handlers
  ipcMain.handle('terminal/get-file-completions', secureIpcHandler('terminal/get-file-completions', async (_e, { partialPath, currentDir }) => {
    console.debug(`[IPC] Get file completions: ${partialPath}, current directory: ${currentDir}`);

    try {
      return await getFileCompletions(partialPath, currentDir);
    } catch (error) {
      console.error('[IPC] File completion error:', error);
      
      // Create standardized error response
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `File completion failed: ${error.message}`,
        { partialPath, currentDir, originalError: error.message }
      );
    }
  }));

  ipcMain.handle('terminal/get-current-directory', secureIpcHandler('terminal/get-current-directory', async (_e) => {
    console.debug('[IPC] Get current working directory');

    try {
      return await getCurrentDirectory();
    } catch (error) {
      console.error('[IPC] Get current directory error:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get current directory: ${error.message}`,
        { originalError: error.message }
      );
    }
  }));

  // Directory navigation handlers
  ipcMain.handle('terminal/change-directory', secureIpcHandler('terminal/change-directory', async (_e, { targetPath, currentDir }) => {
    console.debug(`[IPC] Change directory: ${targetPath}, current directory: ${currentDir}`);

    try {
      return await changeDirectory(targetPath, currentDir);
    } catch (error) {
      console.error('[IPC] Change directory error:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to change directory: ${error.message}`,
        { targetPath, currentDir, originalError: error.message }
      );
    }
  }));

  ipcMain.handle('terminal/list-directory', secureIpcHandler('terminal/list-directory', async (_e, { dirPath, showHidden }) => {
    console.debug(`[IPC] List directory contents: ${dirPath}, show hidden: ${showHidden}`);

    try {
      return await listDirectoryContents(dirPath, showHidden);
    } catch (error) {
      console.error('[IPC] List directory contents error:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to list directory: ${error.message}`,
        { dirPath, showHidden, originalError: error.message }
      );
    }
  }));

  ipcMain.handle('terminal/get-working-directory', secureIpcHandler('terminal/get-working-directory', async (_e) => {
    console.debug('[IPC] Get current working directory');

    try {
      return await getWorkingDirectory();
    } catch (error) {
      console.error('[IPC] Get working directory error:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get working directory: ${error.message}`,
        { originalError: error.message }
      );
    }
  }));

  // Configuration management handlers
  ipcMain.handle('config/get-game-data-directory', secureIpcHandler('config/get-game-data-directory', async (_e) => {
    console.debug('[IPC] Get game data directory configuration');
    
    try {
      const { getGameDataDirectory } = await import('../core/config.js');
      const gameDataDir = getGameDataDirectory();
      
      console.debug(`[IPC] Game data directory: ${gameDataDir}`);
      
      return {
        success: true,
        gameDataDirectory: gameDataDir
      };
      
    } catch (error) {
      console.error('[IPC] Failed to get game data directory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('config/set-game-data-directory', secureIpcHandler('config/set-game-data-directory', async (_e, { path: newPath }) => {
    console.debug(`[IPC] Set game data directory: ${newPath}`);
    
    try {
      const { setGameDataDirectory } = await import('../core/config.js');
      const result = setGameDataDirectory(newPath);
      
      if (result.success) {
        console.log(`[IPC] Game data directory updated: ${result.path}`);
      } else {
        console.warn(`[IPC] Failed to set game data directory: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] Failed to set game data directory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('config/get-config', secureIpcHandler('config/get-config', async (_e) => {
    console.debug('[IPC] Get full configuration');
    
    try {
      const { getConfig } = await import('../core/config.js');
      const config = getConfig();
      
      console.debug('[IPC] Configuration retrieved successfully');
      
      return {
        success: true,
        config
      };
      
    } catch (error) {
      console.error('[IPC] Failed to get configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('config/reset-to-defaults', secureIpcHandler('config/reset-to-defaults', async (_e) => {
    console.debug('[IPC] Reset configuration to defaults');
    
    try {
      const { resetConfigToDefaults } = await import('../core/config.js');
      const result = resetConfigToDefaults();
      
      if (result.success) {
        console.log('[IPC] Configuration reset to defaults');
      } else {
        console.warn(`[IPC] Failed to reset configuration: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] Failed to reset configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  // Email system handlers
  ipcMain.handle('email/get-list', secureIpcHandler('email/get-list', async (_e, { limit, offset }) => {
    console.debug(`[IPC] Get email list: limit=${limit}, offset=${offset}`);
    
    try {
      const { getEmails, getInboxPath } = await import('../storage/emailStorage.js');
      const emails = await getEmails(limit, offset);
      
      console.debug(`[IPC] Returning ${emails.length} emails`);
      
      return {
        success: true,
        emails,
        count: emails.length
      };
      
    } catch (error) {
      console.error('[IPC] Failed to get email list:', error);
      
      // Import getInboxPath to provide context in error
      let inboxPath = null;
      try {
        const { getInboxPath } = await import('../storage/emailStorage.js');
        inboxPath = getInboxPath();
      } catch (e) {
        // Ignore if we can't get inbox path
      }
      
      return {
        success: false,
        error: error.message,
        userMessage: error.userMessage || 'Failed to load emails. Please check the inbox directory.',
        inboxPath,
        emails: []
      };
    }
  }));

  ipcMain.handle('email/get-by-id', secureIpcHandler('email/get-by-id', async (_e, { emailId }) => {
    console.debug(`[IPC] Get email: ${emailId}`);
    
    try {
      const { getEmailById } = await import('../storage/emailStorage.js');
      const email = await getEmailById(emailId);
      
      if (!email) {
        console.warn(`[IPC] Email not found: ${emailId}`);
        return {
          success: false,
          error: 'Email not found',
          email: null
        };
      }
      
      console.debug(`[IPC] Email retrieved successfully: ${emailId}`);
      
      return {
        success: true,
        email
      };
      
    } catch (error) {
      console.error(`[IPC] Failed to get email: ${emailId}`, error);
      return {
        success: false,
        error: error.message,
        email: null
      };
    }
  }));

  ipcMain.handle('email/mark-read', secureIpcHandler('email/mark-read', async (_e, { emailId }) => {
    console.debug(`[IPC] Mark email as read: ${emailId}`);
    
    try {
      const { markEmailAsRead } = await import('../storage/emailStorage.js');
      const result = await markEmailAsRead(emailId);
      
      if (result.success) {
        console.log(`[IPC] Email marked as read: ${emailId}`);
      } else {
        console.warn(`[IPC] Failed to mark email as read: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] Failed to mark email as read: ${emailId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('email/get-inbox-path', secureIpcHandler('email/get-inbox-path', async (_e) => {
    console.debug('[IPC] Get inbox path');
    
    try {
      const { getInboxPath } = await import('../storage/emailStorage.js');
      const inboxPath = getInboxPath();
      
      if (!inboxPath) {
        console.warn('[IPC] Email system not initialized');
        return {
          success: false,
          error: 'Email system not initialized',
          inboxPath: null
        };
      }
      
      console.debug(`[IPC] Inbox path: ${inboxPath}`);
      
      return {
        success: true,
        inboxPath
      };
      
    } catch (error) {
      console.error('[IPC] Failed to get inbox path:', error);
      return {
        success: false,
        error: error.message,
        inboxPath: null
      };
    }
  }));

  ipcMain.handle('email/execute-action', secureIpcHandler('email/execute-action', async (_e, { emailId, actionIndex }) => {
    console.debug(`[IPC] Execute email action: emailId=${emailId}, actionIndex=${actionIndex}`);
    
    try {
      const { getEmailById } = await import('../storage/emailStorage.js');
      const { executeEmailAction } = await import('../storage/emailActions.js');
      
      // Get the email to retrieve the action
      const email = await getEmailById(emailId);
      
      if (!email) {
        console.warn(`[IPC] Email not found: ${emailId}`);
        return {
          success: false,
          error: 'Email not found'
        };
      }
      
      // Check if email has actions
      if (!email.actions || !Array.isArray(email.actions)) {
        console.warn(`[IPC] Email has no actions: ${emailId}`);
        return {
          success: false,
          error: 'Email has no actions'
        };
      }
      
      // Check if action index is valid
      if (actionIndex < 0 || actionIndex >= email.actions.length) {
        console.warn(`[IPC] Invalid action index: ${actionIndex} (total: ${email.actions.length})`);
        return {
          success: false,
          error: 'Invalid action index'
        };
      }
      
      // Get the action
      const action = email.actions[actionIndex];
      
      console.log(`[IPC] Executing action: ${action.type} - ${action.label}`);
      
      // Execute the action
      const result = await executeEmailAction(action);
      
      if (result.success) {
        console.log(`[IPC] Action executed successfully: ${action.label}`);
      } else {
        console.warn(`[IPC] Action execution failed: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] Failed to execute email action: ${emailId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  // Start menu handlers
  ipcMain.handle('start-menu/new-game', secureIpcHandler('start-menu/new-game', async (_e) => {
    console.debug('[IPC] Received new game request');
    
    try {
      const { handleNewGame } = await import('./startMenuManager.js');
      const result = await handleNewGame();
      
      if (result.success) {
        console.log('[IPC] New game started successfully');
      } else {
        console.warn('[IPC] Failed to start new game:', result.message);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] Failed to start new game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('start-menu/continue-game', secureIpcHandler('start-menu/continue-game', async (_e) => {
    console.debug('[IPC] Received continue game request');
    
    try {
      const { handleContinueGame } = await import('./startMenuManager.js');
      const result = await handleContinueGame();
      
      if (result.success) {
        console.log('[IPC] Game continued successfully');
      } else {
        console.warn('[IPC] Failed to continue game:', result.message);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] Failed to continue game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('start-menu/check-save-exists', secureIpcHandler('start-menu/check-save-exists', async (_e) => {
    console.debug('[IPC] Check if save exists');
    
    try {
      const { hasSavedState } = await import('../systems/gameStateManager.js');
      const exists = hasSavedState();
      
      console.debug(`[IPC] Save exists: ${exists}`);
      
      return {
        success: true,
        exists
      };
      
    } catch (error) {
      console.error('[IPC] Failed to check save:', error);
      return {
        success: false,
        error: error.message,
        exists: false
      };
    }
  }));

  ipcMain.handle('start-menu/get-save-metadata', secureIpcHandler('start-menu/get-save-metadata', async (_e) => {
    console.debug('[IPC] Get save metadata');
    
    try {
      const { getSaveMetadata } = await import('../systems/gameStateManager.js');
      const metadata = getSaveMetadata();
      
      if (metadata) {
        console.debug('[IPC] Save metadata retrieved successfully');
      } else {
        console.debug('[IPC] No save found');
      }
      
      return {
        success: true,
        metadata
      };
      
    } catch (error) {
      console.error('[IPC] Failed to get save metadata:', error);
      return {
        success: false,
        error: error.message,
        metadata: null
      };
    }
  }));

  // Door state management handlers
  ipcMain.handle('door/get-state', secureIpcHandler('door/get-state', async (_e, doorId) => {
    console.debug(`[IPC] Get door state: ${doorId}`);
    
    try {
      const { getDoorState, getDoorStateValue, isDoorLocked } = await import('../systems/doorKeySystem.js');
      
      const fullState = getDoorState(doorId);
      if (!fullState) {
        return {
          success: false,
          error: 'Door not found'
        };
      }
      
      const state = getDoorStateValue(doorId);
      const isLocked = isDoorLocked(doorId);
      
      return {
        success: true,
        state,
        isLocked,
        isEncrypted: fullState.isEncrypted || false
      };
      
    } catch (error) {
      console.error(`[IPC] Failed to get door state: ${doorId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('door/set-state', secureIpcHandler('door/set-state', async (_e, { doorId, state }) => {
    console.debug(`[IPC] Set door state: ${doorId} -> ${state}`);
    
    try {
      const { setDoorState } = await import('../systems/doorKeySystem.js');
      
      const result = setDoorState(doorId, state);
      
      if (result.success) {
        console.log(`[IPC] Door state updated: ${doorId} -> ${state}`);
      } else {
        console.warn(`[IPC] Failed to set door state: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] Failed to set door state: ${doorId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('door/toggle-state', secureIpcHandler('door/toggle-state', async (_e, doorId) => {
    console.debug(`[IPC] Toggle door state: ${doorId}`);
    
    try {
      const { toggleDoorState } = await import('../systems/doorKeySystem.js');
      
      const result = toggleDoorState(doorId);
      
      if (result.success) {
        console.log(`[IPC] Door state toggled: ${doorId} -> ${result.newState}`);
      } else {
        console.warn(`[IPC] Failed to toggle door state: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] Failed to toggle door state: ${doorId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  ipcMain.handle('door/set-locked', secureIpcHandler('door/set-locked', async (_e, { doorId, isLocked }) => {
    console.debug(`[IPC] Set door locked state: ${doorId} -> ${isLocked}`);
    
    try {
      const { setDoorLocked } = await import('../systems/doorKeySystem.js');
      
      const result = setDoorLocked(doorId, isLocked);
      
      if (result.success) {
        console.log(`[IPC] Door locked state updated: ${doorId} -> ${isLocked}`);
      } else {
        console.warn(`[IPC] Failed to set door locked state: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] Failed to set door locked state: ${doorId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }));

  console.debug('[IPC] All IPC handlers set up complete');
}

/**
 * Get image dimensions from file path
 * @param {string} imagePath - Path to the image file
 * @returns {Object|null} Object with width and height, or null if unable to read
 */
function getImageDimensions(imagePath) {
  try {
    // Resolve the path relative to the app
    const resolvedPath = resolveAssetPath(imagePath);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[IMAGE] File not found: ${resolvedPath}`);
      return null;
    }
    
    // Read file into buffer
    const buffer = fs.readFileSync(resolvedPath);
    
    // Get image dimensions from buffer
    const dimensions = sizeOf(buffer);
    console.log(`[IMAGE] Dimensions for ${imagePath}: ${dimensions.width}x${dimensions.height}`);
    return { width: dimensions.width, height: dimensions.height };
  } catch (error) {
    console.error(`[IMAGE] Failed to get dimensions for ${resolvedPath}:`, error);
    return null;
  }
}

/**
 * Execute terminal command
 * @param {string} command - Command name
 * @param {Array} args - Arguments array
 * @returns {Object} Execution result
 */
async function executeTerminalCommand(command, args) {
  console.debug(`[TERMINAL] Executing command: ${command}, args:`, args);

  switch (command) {
    case 'list':
    case 'ls': {
      // Parse arguments using schema - this enables future switch support
      // Note: Frontend already handles help switches and sends only positionals
      // But we prepare the handler for future backend switch processing
      
      // For now, args should be empty (no positional arguments expected)
      // Future switches like -a/--all or -v/--verbose would be handled here
      
      const windows = getWindowsInfo();
      
      // Standardize output formatting
      if (windows.length === 0) {
        return {
          success: true,
          message: 'No windows are currently open',
        };
      }
      
      // Basic format: ID: Title
      // Future enhancement: could support verbose mode with more details
      const message = windows.map(w => `${w.id}: ${w.title || '(Untitled)'}`).join('\n');
      
      return {
        success: true,
        message: message,
        data: {
          count: windows.length,
          windows: windows.map(w => ({
            id: w.id,
            title: w.title || '(Untitled)',
            // Future: could include more details for verbose mode
            // visible: w.visible,
            // type: w.type,
            // bounds: w.bounds
          }))
        }
      };
    }

    case 'getwindows': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['getwindows']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'getwindows' };
      }
      
      // Extract filtering switches
      const showVerbose = parsed.switches.verbose || parsed.switches.v;
      const showAll = parsed.switches.all || parsed.switches.a;
      
      // Execute command logic with potential filtering
      try {
        let windows = getWindowsInfo();
        
        // Apply filtering based on switches
        if (!showAll) {
          // Filter out hidden windows if --all is not specified
          windows = windows.filter(window => {
            // Assume windows have a visible property or similar
            // For now, we'll show all windows since the filtering logic
            // would need to be implemented in the windowManager
            return true;
          });
        }
        
        // Format output based on verbose flag
        let message;
        if (showVerbose) {
          // Detailed information for each window
          if (windows.length === 0) {
            message = 'No windows found';
          } else {
            message = windows.map(w => {
              const details = [
                `ID: ${w.id}`,
                `Title: ${w.title || '(Untitled)'}`,
                `Type: ${w.type || 'unknown'}`,
                `Size: ${w.width || 'unknown'}x${w.height || 'unknown'}`,
                `Position: (${w.x || 'unknown'}, ${w.y || 'unknown'})`
              ];
              return details.join(', ');
            }).join('\n');
          }
        } else {
          // Standard format
          if (windows.length === 0) {
            message = 'No windows found';
          } else {
            message = `Found ${windows.length} windows`;
          }
        }
        
        return {
          success: true,
          message: message,
          data: {
            count: windows.length,
            windows: windows,
            verbose: showVerbose,
            showAll: showAll
          }
        };
      } catch (error) {
        return { success: false, message: `Failed to get windows: ${error.message}` };
      }
    }

    case 'info': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length === 0) {
        return { success: false, message: 'Usage: info [windowID]' };
      }

      const windowId = args[0];
      const info = getWindowInfo(windowId);

      if (!info) {
        return { success: false, message: `Window ${windowId} not found` };
      }

      return {
        success: true,
        message: `Window ${windowId} information:`,
        data: info
      };
    }

    case 'get-title': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length === 0) {
        return { success: false, message: 'Usage: get-title [windowID]' };
      }

      const windowId = args[0];

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Execute command logic
      try {
        const title = getWindowTitle(windowId);

        if (title === null) {
          return { success: false, message: `Window '${windowId}' not found. Use 'list' to see available windows.` };
        }

        return {
          success: true,
          message: `Window '${windowId}' title: ${title}`,
          data: { title }
        };
      } catch (error) {
        return { success: false, message: `Failed to get title: ${error.message}` };
      }
    }

    case 'set-title': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length < 2) {
        return { success: false, message: 'Usage: set-title [windowID] [title...]' };
      }

      const windowId = args[0];
      // Handle multi-word titles by joining all remaining arguments
      const title = args.slice(1).join(' ');

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Validate title content and length
      if (!title || title.trim() === '') {
        return { success: false, message: 'Title cannot be empty' };
      }

      // Check title length (reasonable limit)
      if (title.length > 200) {
        return { success: false, message: 'Title too long (maximum 200 characters)' };
      }

      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'title', title);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set title: ${error.message}` };
      }
    }

    case 'set-size': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['set-size']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'set-size' };
      }
      
      // Extract positional arguments
      const [windowId, widthStr, heightStr] = parsed.positionals;
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate and parse width and height
      const width = parseInt(widthStr);
      const height = parseInt(heightStr);
      
      if (isNaN(width) || width <= 0) {
        return { 
          success: false, 
          message: `Invalid width: '${widthStr}'. Must be a positive number.` 
        };
      }
      
      if (isNaN(height) || height <= 0) {
        return { 
          success: false, 
          message: `Invalid height: '${heightStr}'. Must be a positive number.` 
        };
      }
      
      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'size', [width, height]);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set window size: ${error.message}` };
      }
    }

    case 'set-position': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['set-position']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'set-position' };
      }
      
      // Extract positional arguments
      const [windowId, xStr, yStr] = parsed.positionals;
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate and parse x and y coordinates
      const x = parseInt(xStr);
      const y = parseInt(yStr);
      
      if (isNaN(x)) {
        return { 
          success: false, 
          message: `Invalid x coordinate: '${xStr}'. Must be a number.` 
        };
      }
      
      if (isNaN(y)) {
        return { 
          success: false, 
          message: `Invalid y coordinate: '${yStr}'. Must be a number.` 
        };
      }
      
      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'position', [x, y]);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set window position: ${error.message}` };
      }
    }

    case 'set-resizable': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length < 2) {
        return { success: false, message: 'Usage: set-resizable [windowID] [true/false/1/0]' };
      }

      // Extract positional arguments
      const windowId = args[0];
      const resizableValue = args[1];

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Validate resizable parameter (true/false/1/0)
      const normalizedValue = resizableValue.toLowerCase();
      let resizable;
      
      if (normalizedValue === 'true' || normalizedValue === '1') {
        resizable = true;
      } else if (normalizedValue === 'false' || normalizedValue === '0') {
        resizable = false;
      } else {
        return { 
          success: false, 
          message: `Invalid resizable value: '${resizableValue}'. Must be true, false, 1, or 0.` 
        };
      }

      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'resizable', resizable);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set resizable property: ${error.message}` };
      }
    }

    case 'set-visibility': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length < 2) {
        return { success: false, message: 'Usage: set-visibility [windowID] [visible]' };
      }

      const windowId = args[0];
      const visibilityParam = args[1];

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Validate visibility parameter values
      const visibility = visibilityParam.toLowerCase();
      if (visibility !== 'true' && visibility !== 'false') {
        return { success: false, message: 'Visibility parameter must be "true" or "false"' };
      }

      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'visibility', visibility === 'true');
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set visibility: ${error.message}` };
      }
    }

    case 'show': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length === 0) {
        return { success: false, message: 'Usage: show [windowID]' };
      }

      const windowId = args[0];
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'visibility', true);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to show window: ${error.message}` };
      }
    }

    case 'hide': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      
      // Validate required arguments
      if (args.length === 0) {
        return { 
          success: false, 
          message: 'Usage: hide [windowID]\nUse "hide --help" for more information.' 
        };
      }

      // Extract positional arguments
      const windowId = args[0];
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { 
          success: false, 
          message: 'Window ID must be a non-empty string.\nUse "list" to see available window IDs.' 
        };
      }
      
      // Execute command logic
      try {
        const result = updateWindowProperty(windowId, 'visibility', false);
        
        // Enhance success message
        if (result.success) {
          return {
            success: true,
            message: `Window '${windowId}' has been hidden successfully.`
          };
        }
        
        return result;
      } catch (error) {
        return { 
          success: false, 
          message: `Failed to hide window '${windowId}': ${error.message}` 
        };
      }
    }

    case 'reload-html': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['reload-html']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'reload-html' };
      }
      
      // Extract positional arguments
      const [windowId, htmlPath] = parsed.positionals;
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate HTML file path and accessibility
      if (!htmlPath || typeof htmlPath !== 'string' || htmlPath.trim() === '') {
        return { success: false, message: 'HTML path must be a non-empty string' };
      }
      
      // Validate file extension
      if (!htmlPath.toLowerCase().endsWith('.html') && !htmlPath.toLowerCase().endsWith('.htm')) {
        return { success: false, message: 'File must have .html or .htm extension' };
      }
      
      // Use blocklist validation for file operations - allows access to any directory
      // except specifically blocked ones (node_modules, .git, src, etc.)
      // This enables loading HTML files from user directories anywhere on the system
      try {
        const validationResult = validateAndResolvePath(htmlPath, process.cwd(), null, true);
        if (!validationResult.isValid) {
          return { success: false, message: `Invalid HTML path: ${validationResult.error}` };
        }
        
        const fullPath = validationResult.resolvedPath;
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          return { 
            success: false, 
            message: `HTML file not found: ${htmlPath}. Check the file path and ensure it exists.` 
          };
        }
        
        // Check if it's actually a file (not a directory)
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          return { 
            success: false, 
            message: `Path is not a file: ${htmlPath}` 
          };
        }
        
        // Check if file is readable
        try {
          fs.accessSync(fullPath, fs.constants.R_OK);
        } catch (accessError) {
          return { 
            success: false, 
            message: `HTML file is not readable: ${htmlPath}. Check file permissions.` 
          };
        }
        
      } catch (error) {
        return { 
          success: false, 
          message: `Failed to validate HTML file: ${error.message}` 
        };
      }
      
      // Execute command logic with graceful error handling
      try {
        const result = reloadWindowHtml(windowId, htmlPath);
        
        // Handle file loading errors gracefully
        if (!result.success) {
          // Provide more helpful error messages
          if (result.message && result.message.includes('does not exist')) {
            return { 
              success: false, 
              message: `Window '${windowId}' not found. Use 'list' to see available windows.` 
            };
          } else if (result.message && result.message.includes('loading failed')) {
            return { 
              success: false, 
              message: `Failed to load HTML file '${htmlPath}'. Check if the file is valid HTML and accessible.` 
            };
          } else {
            return { 
              success: false, 
              message: result.message || `Failed to reload HTML in window '${windowId}'` 
            };
          }
        }
        
        return {
          success: true,
          message: `Successfully reloaded HTML content in window '${windowId}' from '${htmlPath}'`
        };
        
      } catch (error) {
        return { 
          success: false, 
          message: `Failed to reload HTML: ${error.message}` 
        };
      }
    }

    case 'create-picture': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['create-picture']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'create-picture' };
      }
      
      // Extract positional arguments
      const [pictureId, imagePath, fitMode] = parsed.positionals;
      
      // Extract opacity switch with default value
      const opacity = parsed.switches.opacity !== undefined ? parseFloat(parsed.switches.opacity) : 1.0;
      
      // Validate opacity range
      if (isNaN(opacity) || opacity < 0.0 || opacity > 1.0) {
        return { 
          success: false, 
          message: 'Opacity must be a number between 0.0 and 1.0' 
        };
      }
      
      // Validate business logic (beyond schema validation)
      if (!pictureId || typeof pictureId !== 'string' || pictureId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate file path
      if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') {
        return { success: false, message: 'Image path must be a non-empty string' };
      }
      
      // Validate fitMode values if provided
      const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
      const actualFitMode = fitMode || 'fill'; // Default to 'fill' if not provided
      
      if (fitMode && !validFitModes.includes(fitMode)) {
        return { 
          success: false, 
          message: `Invalid fit mode '${fitMode}'. Valid modes: ${validFitModes.join(', ')}` 
        };
      }
      
      // Execute command logic
      try {
        // Validate and resolve the image path
        const resolvedPath = resolveAssetPath(imagePath);
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          return { 
            success: false, 
            message: `Image file not found: ${imagePath}. Please check the file path and try again.` 
          };
        }
        
        // Get image dimensions
        const dimensions = getImageDimensions(imagePath);
        const width = dimensions ? dimensions.width : 400;
        const height = dimensions ? dimensions.height : 300;
        
        createPicture(pictureId, imagePath, actualFitMode, null, width, height);
        
        // Apply opacity after window creation
        const window = BrowserWindow.fromId(pictureId) || BrowserWindow.getAllWindows().find(w => w.getTitle() === pictureId);
        if (window && opacity !== 1.0) {
          window.setOpacity(opacity);
        }
        
        return { 
          success: true, 
          message: `Picture window '${pictureId}' created successfully (${width}x${height}) with fit mode '${actualFitMode}' and opacity ${opacity}` 
        };
      } catch (error) {
        return { success: false, message: `Failed to create picture window: ${error.message}` };
      }
    }

    case 'set-picture': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['set-picture']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'set-picture' };
      }
      
      // Extract positional arguments
      const [windowId, imagePath, fitMode] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') {
        return { success: false, message: 'Image path must be a non-empty string' };
      }
      
      // Validate image file path and format
      try {
        // Use blocklist validation for file operations - allows access to any directory
        // except specifically blocked ones (node_modules, .git, src, etc.)
        // This enables setting pictures from user image files anywhere on the system
        const validationResult = validateAndResolvePath(imagePath, process.cwd(), null, true);
        if (!validationResult.isValid) {
          return { success: false, message: `Invalid image path: ${validationResult.error}` };
        }
        
        // Resolve the image path
        const resolvedPath = resolveAssetPath(imagePath);
        
        // Check if file exists
        let fullPath;
        if (path.isAbsolute(resolvedPath)) {
          fullPath = resolvedPath;
        } else {
          fullPath = path.join(process.cwd(), resolvedPath);
        }
        
        if (!fs.existsSync(fullPath)) {
          return { success: false, message: `Image file not found: ${imagePath}` };
        }
        
        // Check if it's a file
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          return { success: false, message: `Path is not a file: ${imagePath}` };
        }
        
        // Validate image format
        const ext = path.extname(fullPath).toLowerCase();
        const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
        
        if (!supportedFormats.includes(ext)) {
          return { 
            success: false, 
            message: `Unsupported image format: ${ext}. Supported formats: ${supportedFormats.join(', ')}` 
          };
        }
        
        // Validate fitMode if provided
        if (fitMode) {
          const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
          if (!validFitModes.includes(fitMode)) {
            return { 
              success: false, 
              message: `Invalid fit mode: ${fitMode}. Valid modes: ${validFitModes.join(', ')}` 
            };
          }
        }
        
        // Execute command logic
        const result = setPicture(windowId, resolvedPath, fitMode);
        return result;
        
      } catch (error) {
        return { success: false, message: `Failed to validate image: ${error.message}` };
      }
    }

    case 'set-fit-mode': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['set-fit-mode']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'set-fit-mode' };
      }
      
      // Extract positional arguments
      const [windowId, fitMode] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate fitMode values (contain, cover, fill, etc.)
      const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
      if (!fitMode || !validFitModes.includes(fitMode)) {
        return { 
          success: false, 
          message: `Invalid fit mode: '${fitMode}'. Valid modes are: ${validFitModes.join(', ')}` 
        };
      }
      
      // Execute command logic
      try {
        const result = setFitMode(windowId, fitMode);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set fit mode: ${error.message}` };
      }
    }

    // Lens system commands
    case 'create-content': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['create-content']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'create-content' };
      }
      
      // Extract switch values with defaults (subtasks 8.5, 8.6)
      const opacity = parsed.switches.opacity !== undefined ? parseFloat(parsed.switches.opacity) : 1.0;
      const transparent = parsed.switches.transparent !== undefined ? parsed.switches.transparent : false;
      
      // Validate opacity is between 0.0 and 1.0 (subtask 8.7)
      if (isNaN(opacity) || opacity < 0.0 || opacity > 1.0) {
        return {
          success: false,
          message: 'Opacity must be a number between 0.0 and 1.0'
        };
      }
      
      // Extract positional arguments
      const [windowID, type, path, blurAmount, shouldBlur] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      
      // Validate windowID
      if (!windowID || typeof windowID !== 'string' || windowID.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate and normalize content type
      const validTypes = ['text', 'image'];
      const contentType = type ? type.toLowerCase() : 'text';
      if (!validTypes.includes(contentType)) {
        return { 
          success: false, 
          message: `Invalid content type '${type}'. Valid types: ${validTypes.join(', ')}` 
        };
      }
      
      // Validate file path for image type
      let contentPath = path || '';
      if (contentType === 'image') {
        if (!contentPath || contentPath.trim() === '') {
          return { success: false, message: 'Image path is required when type is "image"' };
        }
        
        // Validate path security and existence
        try {
          // Use blocklist validation for file operations - allows access to any directory
          // except specifically blocked ones (node_modules, .git, src, etc.)
          // This enables content creation from user files anywhere on the system
          const validationResult = validateAndResolvePath(contentPath, process.cwd(), null, true);
          if (!validationResult.isValid) {
            return { success: false, message: `Invalid image path: ${validationResult.error}` };
          }
          contentPath = validationResult.resolvedPath;
          
          // Check if file exists
          if (!fs.existsSync(contentPath)) {
            return { success: false, message: `Image file not found: ${contentPath}` };
          }
          
          // Validate file is an image by checking extension
          const ext = path.extname(contentPath).toLowerCase();
          const validImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
          if (!validImageExts.includes(ext)) {
            return { 
              success: false, 
              message: `Invalid image format. Supported formats: ${validImageExts.join(', ')}` 
            };
          }
        } catch (error) {
          return { success: false, message: `Path validation failed: ${error.message}` };
        }
      }
      
      // Validate blur amount
      let parsedBlurAmount = 10; // default
      if (blurAmount !== undefined) {
        parsedBlurAmount = parseFloat(blurAmount);
        if (isNaN(parsedBlurAmount) || parsedBlurAmount < 0 || parsedBlurAmount > 50) {
          return { 
            success: false, 
            message: 'Blur amount must be a number between 0 and 50' 
          };
        }
      }
      
      // Validate shouldBlur parameter
      let parsedShouldBlur = true; // default
      if (shouldBlur !== undefined) {
        const lowerShouldBlur = shouldBlur.toLowerCase();
        if (lowerShouldBlur === 'true' || lowerShouldBlur === '1' || lowerShouldBlur === 'yes') {
          parsedShouldBlur = true;
        } else if (lowerShouldBlur === 'false' || lowerShouldBlur === '0' || lowerShouldBlur === 'no') {
          parsedShouldBlur = false;
        } else {
          return { 
            success: false, 
            message: 'shouldBlur must be true/false, yes/no, or 1/0' 
          };
        }
      }
      
      // Execute command logic
      try {
        // Get image dimensions if content type is image
        let width = 800;
        let height = 600;
        
        if (contentType === 'image' && contentPath) {
          const dimensions = getImageDimensions(contentPath);
          if (dimensions) {
            width = dimensions.width;
            height = dimensions.height;
          }
        }
        
        const result = createContentWindow(windowID, {
          contentType,
          contentPath,
          blurAmount: parsedBlurAmount,
          blurred: parsedShouldBlur,
          width,
          height
        });
        
        // Apply opacity after window creation (subtasks 8.8, 8.9, 8.10)
        if (result.success) {
          // Handle transparent flag by setting opacity to 0.0 if true (overrides -o value)
          const finalOpacity = transparent ? 0.0 : opacity;
          
          // Apply opacity using setWindowOpacity
          const opacityResult = setWindowOpacity(windowID, finalOpacity);
          if (!opacityResult.success) {
            console.warn(`[WINDOW] Failed to set opacity for window ${windowID}: ${opacityResult.message}`);
          }
        }
        
        return result;
      } catch (error) {
        return { success: false, message: `Failed to create content window: ${error.message}` };
      }
    }

    case 'create-lens': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['create-lens']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'create-lens' };
      }
      
      // Extract positional arguments
      const [lensId, targetWindowId, widthStr, heightStr] = parsed.positionals;
      
      // Extract opacity value from switches with default 1.0
      const opacityStr = parsed.switches.opacity || parsed.switches.o;
      const opacity = opacityStr ? parseFloat(opacityStr) : 1.0;
      
      // Validate opacity is between 0.0 and 1.0
      if (isNaN(opacity) || opacity < 0.0 || opacity > 1.0) {
        return { 
          success: false, 
          message: `Invalid opacity value: '${opacityStr}'. Must be a number between 0.0 and 1.0.` 
        };
      }
      
      // Validate business logic (beyond schema validation)
      if (!lensId || typeof lensId !== 'string' || lensId.trim() === '') {
        return { success: false, message: 'Lens ID must be a non-empty string' };
      }
      
      if (!targetWindowId || typeof targetWindowId !== 'string' || targetWindowId.trim() === '') {
        return { success: false, message: 'Target window ID must be a non-empty string' };
      }
      
      // Parse optional width and height with defaults
      const width = widthStr ? parseInt(widthStr) : 300;
      const height = heightStr ? parseInt(heightStr) : 200;
      
      // Validate width and height if provided
      if (widthStr && (isNaN(width) || width <= 0)) {
        return { success: false, message: `Invalid width: '${widthStr}'. Must be a positive number.` };
      }
      
      if (heightStr && (isNaN(height) || height <= 0)) {
        return { success: false, message: `Invalid height: '${heightStr}'. Must be a positive number.` };
      }

      // Execute command logic
      try {
        // Get target window information to determine content type and path
        const targetInfo = getWindowInfo(targetWindowId);
        if (!targetInfo) {
          return { success: false, message: `Target window '${targetWindowId}' not found. Use 'list' to see available windows.` };
        }

        const result = createLensWindow(lensId, targetWindowId, {
          width,
          height,
          contentType: 'text', // Default text type, can be extended later
          contentPath: ''
        });
        
        // Apply opacity after lens creation if successful
        if (result.success && opacity !== 1.0) {
          const opacityResult = setWindowOpacity(lensId, opacity);
          if (!opacityResult.success) {
            console.warn(`Lens created but failed to set opacity: ${opacityResult.message}`);
          }
        }
        
        return result;
      } catch (error) {
        return { success: false, message: `Failed to create lens: ${error.message}` };
      }
    }

    case 'set-opacity': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length < 2) {
        return { success: false, message: 'Usage: set-opacity [windowID] [opacity]' };
      }

      // Extract positional arguments
      const windowId = args[0];
      const opacityValue = args[1];

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Validate opacity range (0.0-1.0)
      const opacity = parseFloat(opacityValue);
      
      // Check if parsing was successful
      if (isNaN(opacity)) {
        return { 
          success: false, 
          message: `Invalid opacity value: '${opacityValue}'. Must be a number between 0.0 and 1.0.` 
        };
      }

      // Validate opacity range (0.0-1.0)
      if (opacity < 0.0 || opacity > 1.0) {
        return { 
          success: false, 
          message: `Opacity value out of range: ${opacity}. Must be between 0.0 (transparent) and 1.0 (opaque).` 
        };
      }

      // Execute command logic
      try {
        const result = setWindowOpacity(windowId, opacity);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set opacity: ${error.message}` };
      }
    }

    case 'set-always-on-top': {
      // Arguments are already parsed by frontend using parseArguments()
      // Frontend sends only positionals, help switches are handled there
      if (args.length < 2) {
        return { success: false, message: 'Usage: set-always-on-top [windowID] [alwaysOnTop] [level]' };
      }

      // Extract positional arguments
      const windowId = args[0];
      const alwaysOnTopValue = args[1];
      const level = args[2] || 'normal';

      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }

      // Validate boolean parameter
      let flag;
      const lowerValue = alwaysOnTopValue.toLowerCase();
      
      if (lowerValue === 'true' || lowerValue === '1') {
        flag = true;
      } else if (lowerValue === 'false' || lowerValue === '0') {
        flag = false;
      } else {
        return { 
          success: false, 
          message: `Invalid alwaysOnTop value: '${alwaysOnTopValue}'. Must be 'true', 'false', '1', or '0'.` 
        };
      }

      // Validate level parameter if provided
      const validLevels = ['normal', 'floating', 'torn-off-menu', 'modal-panel', 'main-menu', 'status', 'pop-up-menu', 'screen-saver'];
      if (level && !validLevels.includes(level)) {
        return { 
          success: false, 
          message: `Invalid level: '${level}'. Valid levels: ${validLevels.join(', ')}.` 
        };
      }

      // Execute command logic
      try {
        const result = setWindowAlwaysOnTop(windowId, flag, level);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to set always-on-top: ${error.message}` };
      }
    }

    case 'update-blur': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['update-blur']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'update-blur' };
      }
      
      // Extract positional arguments
      const [windowId, blurAmountStr] = parsed.positionals;
      
      // Validate windowID parameter (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Validate and parse blur amount with numeric parameter validation
      const blurAmount = parseFloat(blurAmountStr);
      
      // Check if parsing was successful
      if (isNaN(blurAmount)) {
        return { 
          success: false, 
          message: `Invalid blur amount: '${blurAmountStr}'. Must be a number between 0 and 50.` 
        };
      }
      
      // Validate blur amount range (0-50)
      if (blurAmount < 0 || blurAmount > 50) {
        return { 
          success: false, 
          message: `Blur amount out of range: ${blurAmount}. Must be between 0 (no blur) and 50 (maximum blur).` 
        };
      }
      
      // Execute command logic
      try {
        const result = updateContentBlur(windowId, blurAmount);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to update blur: ${error.message}` };
      }
    }

    case 'destroy-lens': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['destroy-lens']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'destroy-lens' };
      }
      
      // Extract positional arguments
      const [lensId] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!lensId || typeof lensId !== 'string' || lensId.trim() === '') {
        return { success: false, message: 'Lens ID must be a non-empty string' };
      }

      // Execute command logic
      try {
        const result = destroyLensSystem(lensId);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to destroy lens: ${error.message}` };
      }
    }

    case 'list-lens':
    case 'lens-list': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['list-lens']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'list-lens' };
      }
      
      // Execute command logic
      try {
        const lensSystems = getLensSystems();

        if (lensSystems.length === 0) {
          return { 
            success: true, 
            message: 'No lens windows are currently active',
            data: { count: 0, lenses: [] }
          };
        }

        const message = lensSystems.map(lens =>
          `${lens.lensId} -> ${lens.targetWindowId} (tracking: ${lens.isTracking})`
        ).join('\n');

        return {
          success: true,
          message: `Found ${lensSystems.length} lens system${lensSystems.length === 1 ? '' : 's'}:\n${message}`,
          data: { count: lensSystems.length, lenses: lensSystems }
        };
      } catch (error) {
        return { success: false, message: `Failed to list lens systems: ${error.message}` };
      }
    }

    case 'lens-info': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['lens-info']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'lens-info' };
      }
      
      // Extract positional arguments
      const [lensId] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!lensId || typeof lensId !== 'string' || lensId.trim() === '') {
        return { success: false, message: 'Lens ID must be a non-empty string' };
      }

      // Execute command logic
      try {
        const lensInfo = getLensSystem(lensId);

        if (!lensInfo) {
          return { success: false, message: `Lens '${lensId}' not found. Use 'list-lens' to see available lens systems.` };
        }

        return {
          success: true,
          message: `Lens '${lensId}' information:`,
          data: lensInfo
        };
      } catch (error) {
        return { success: false, message: `Failed to get lens info: ${error.message}` };
      }
    }

    // Window storage commands
    case 'save-window': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['save-window']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'save-window' };
      }
      
      // Extract positional arguments
      const [windowId, customFilename] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!windowId || typeof windowId !== 'string' || windowId.trim() === '') {
        return { success: false, message: 'Window ID must be a non-empty string' };
      }
      
      // Execute command logic
      try {
        const result = saveWindowToFile(windowId, customFilename || null);
        return result;
      } catch (error) {
        return { success: false, message: `Failed to save window: ${error.message}` };
      }
    }

    case 'restore-window': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['restore-window']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'restore-window' };
      }
      
      // Extract positional arguments - join all for file path with spaces
      const filePath = parsed.positionals.join(' ');
      
      // Validate business logic (beyond schema validation)
      if (!filePath || filePath.trim() === '') {
        return { success: false, message: 'File path cannot be empty' };
      }
      
      // Use blocklist validation for file operations - allows access to any directory
      // except specifically blocked ones (node_modules, .git, src, etc.)
      // This enables restoring windows from .fenestra files anywhere on the system
      try {
        const validationResult = validateAndResolvePath(filePath, process.cwd(), null, true);
        if (!validationResult.isValid) {
          return { success: false, message: `Invalid file path: ${validationResult.error}` };
        }
      } catch (error) {
        return { success: false, message: `Path validation failed: ${error.message}` };
      }
      
      // Execute command logic
      try {
        // Load window data from file
        const loadResult = loadWindowFromFile(filePath);
        if (!loadResult.success) {
          return loadResult;
        }

        // Deserialize and recreate window
        const restoreResult = deserializeWindow(loadResult.data, { forceNewId: false });

        // If window restoration was successful, delete the .fenestra file
        if (restoreResult.success) {
          try {
            // Extract filename from the full path for deletion
            const filename = path.basename(loadResult.filePath);
            const deleteResult = deleteStoredWindow(filename);
            
            let successMessage = restoreResult.message;
            
            if (deleteResult.success) {
              successMessage += `\n.fenestra file automatically deleted: ${filename}`;
              console.log(`[TERMINAL] .fenestra file deleted after window restoration: ${filename}`);
            } else {
              successMessage += `\nWarning: Unable to delete .fenestra file: ${deleteResult.message}`;
              console.warn(`[TERMINAL] Unable to delete .fenestra file: ${deleteResult.message}`);
            }

            if (restoreResult.warnings && restoreResult.warnings.length > 0) {
              successMessage += `\nWarning: ${restoreResult.warnings.join(', ')}`;
            }

            return {
              success: true,
              message: successMessage,
              windowId: restoreResult.windowId
            };
          } catch (deleteError) {
            console.error(`[TERMINAL] Error occurred while deleting .fenestra file:`, deleteError);
            return {
              success: true,
              message: `${restoreResult.message}\nWarning: Failed to delete .fenestra file: ${deleteError.message}`,
              windowId: restoreResult.windowId
            };
          }
        }

        return restoreResult;

      } catch (error) {
        return { success: false, message: `Restore failed: ${error.message}` };
      }
    }

    case 'list-saved': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['list-saved']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'list-saved' };
      }
      
      // Execute command logic
      try {
        const listResult = listStoredWindows();

        if (!listResult.success) {
          return listResult;
        }

        if (listResult.files.length === 0) {
          return { success: true, message: 'No saved window files found' };
        }

        const fileList = listResult.files.map(file => {
          const date = file.modified.toLocaleDateString();
          const time = file.modified.toLocaleTimeString();
          const sizeKB = Math.round(file.size / 1024 * 100) / 100;
          return `${file.filename} (${sizeKB}KB, ${date})`;
          // return `${file.filename} (${sizeKB}KB, ${date} ${time})`;
        }).join('\n');

        return {
          success: true,
          message: `Found ${listResult.files.length} saved windows:\n${fileList}`
        };
      } catch (error) {
        return { success: false, message: `Failed to list saved windows: ${error.message}` };
      }
    }

    case 'delete-saved': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['delete-saved']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        // Return help content or trigger help display
        return { success: true, showHelp: true, command: 'delete-saved' };
      }
      
      // Extract positional arguments
      const [filename] = parsed.positionals;
      
      // Validate business logic (beyond schema validation)
      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        return { success: false, message: 'Filename must be a non-empty string' };
      }
      
      // Check for confirmation switch
      const skipConfirmation = parsed.switches.confirm || parsed.switches.c;
      
      // Execute command logic
      try {
        // If confirmation is skipped, proceed directly
        if (skipConfirmation) {
          const result = deleteStoredWindow(filename);
          return result;
        }
        
        // For now, we'll proceed without interactive confirmation
        // In a future enhancement, this could trigger a confirmation dialog
        // For the terminal interface, we assume the user wants to proceed
        const result = deleteStoredWindow(filename);
        
        // Add a note about the confirmation switch for future use
        if (result.success) {
          result.message += '\nTip: Use --confirm or -c to skip confirmation in the future';
        }
        
        return result;
      } catch (error) {
        return { success: false, message: `Failed to delete saved window: ${error.message}` };
      }
    }

    // Directory navigation commands
    case 'cd': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['cd']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'cd' };
      }
      
      // Extract target path from positional arguments
      const targetPath = parsed.positionals.length > 0 ? parsed.positionals.join(' ') : '';
      
      // Path validation (beyond schema validation)
      if (targetPath && !validatePathCharacters(targetPath)) {
        return {
          success: false,
          message: 'Invalid characters in path. Use only alphanumeric characters, spaces, hyphens, underscores, dots, and forward/back slashes.'
        };
      }
      
      // Execute command logic
      try {
        const result = changeDirectory(targetPath);
        return result;
      } catch (error) {
        return {
          success: false,
          message: `Directory change failed: ${error.message}`
        };
      }
    }

    case 'pwd': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['pwd']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'pwd' };
      }
      
      // Execute command logic
      try {
        const result = await getWorkingDirectory();
        return result;
      } catch (error) {
        return {
          success: false,
          message: `Failed to get current directory: ${error.message}`
        };
      }
    }

    case 'dir': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['dir']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'dir' };
      }
      
      // Extract switches and positional arguments
      const showHidden = parsed.switches.all || parsed.switches.a;
      const targetPath = parsed.positionals.length > 0 ? parsed.positionals.join(' ') : '';
      
      // Execute command logic
      try {
        const result = listDirectoryContents(targetPath, showHidden);
        return result;
      } catch (error) {
        return {
          success: false,
          message: `Failed to list directory contents: ${error.message}`
        };
      }
    }

    case 'config': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['config']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'config' };
      }
      
      // Extract positional arguments
      const [subCommand, configKey, ...configValueParts] = parsed.positionals;
      
      if (!subCommand) {
        return { 
          success: false, 
          message: 'Usage: config [get|set|reset] [parameters...]\n' +
                   '  config get - Show current configuration\n' +
                   '  config get game-data-dir - Show game data directory\n' +
                   '  config set game-data-dir [path] - Set game data directory\n' +
                   '  config reset - Reset configuration to defaults\n' +
                   '  config --help - Show detailed help'
        };
      }

      switch (subCommand) {
        case 'get': {
          if (!configKey) {
            // Show full configuration
            try {
              const config = getConfig();
              const configStr = JSON.stringify(config, null, 2);
              return {
                success: true,
                message: `Current configuration:\n${configStr}`
              };
            } catch (error) {
              return {
                success: false,
                message: `Failed to get configuration: ${error.message}`
              };
            }
          } else if (configKey === 'game-data-dir') {
            // Show game data directory
            try {
              const gameDataDir = getGameDataDirectory();
              return {
                success: true,
                message: `Game data directory: ${gameDataDir}`
              };
            } catch (error) {
              return {
                success: false,
                message: `Failed to get game data directory: ${error.message}`
              };
            }
          } else {
            return {
              success: false,
              message: `Unknown configuration key: ${configKey}\nAvailable keys: game-data-dir`
            };
          }
        }

        case 'set': {
          if (!configKey || configValueParts.length === 0) {
            return {
              success: false,
              message: 'Usage: config set [key] [value]\nAvailable keys: game-data-dir'
            };
          }

          const configValue = configValueParts.join(' ');

          if (configKey === 'game-data-dir') {
            // Validate path before setting
            if (!configValue.trim()) {
              return {
                success: false,
                message: 'Game data directory path cannot be empty'
              };
            }
            
            try {
              const result = setGameDataDirectory(configValue);
              
              if (result.success) {
                return {
                  success: true,
                  message: `Game data directory set to: ${result.path}`
                };
              } else {
                return {
                  success: false,
                  message: `Failed to set game data directory: ${result.error}`
                };
              }
            } catch (error) {
              return {
                success: false,
                message: `Failed to set game data directory: ${error.message}`
              };
            }
          } else {
            return {
              success: false,
              message: `Unknown configuration key: ${configKey}\nAvailable keys: game-data-dir`
            };
          }
        }

        case 'reset': {
          try {
            const result = resetConfigToDefaults();
            
            if (result.success) {
              return {
                success: true,
                message: 'Configuration reset to defaults'
              };
            } else {
              return {
                success: false,
                message: `Failed to reset configuration: ${result.error}`
              };
            }
          } catch (error) {
            return {
              success: false,
              message: `Failed to reset configuration: ${error.message}`
            };
          }
        }

        default: {
          return {
            success: false,
            message: `Unknown subcommand: ${subCommand}\nAvailable subcommands: get, set, reset`
          };
        }
      }
    }

    case 'clear': {
      // Parse arguments using schema
      const parsed = parseArguments(args, commandSchemas['clear']);
      
      // Handle parsing errors
      if (!parsed.success) {
        return { success: false, message: parsed.error.message };
      }
      
      // Handle help switch
      if (parsed.switches.help || parsed.switches.h) {
        return { success: true, showHelp: true, command: 'clear' };
      }
      
      // Execute command logic (minimal implementation)
      // The clear command is primarily handled by the frontend
      // This backend handler mainly provides help support and validation
      return {
        success: true,
        message: 'Terminal cleared',
        action: 'clear' // Signal to frontend to clear the display
      };
    }

    default:
      return {
        success: false,
        message: `Unknown command: ${command}\nType 'help' to see available commands`
      };
  }
}

/**
 * Load and validate image file
 * @param {string} imagePath - Image path
 * @returns {Object} Load result
 */
function loadPictureFile(imagePath) {
  console.debug(`[PICTURE] Validating image file: ${imagePath}`);

  try {
    // Parse path
    let fullPath;
    if (path.isAbsolute(imagePath)) {
      fullPath = imagePath;
    } else {
      // Relative path, relative to project root
      fullPath = path.join(process.cwd(), imagePath);
    }

    console.debug(`[PICTURE] Full path: ${fullPath}`);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.warn(`[PICTURE] File does not exist: ${fullPath}`);
      return {
        success: false,
        error: `File does not exist: ${imagePath}`
      };
    }

    // Check if it's a file
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      console.warn(`[PICTURE] Path is not a file: ${fullPath}`);
      return {
        success: false,
        error: `Path is not a file: ${imagePath}`
      };
    }

    // Check file extension
    const ext = path.extname(fullPath).toLowerCase();
    const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

    if (!supportedFormats.includes(ext)) {
      console.warn(`[PICTURE] Unsupported image format: ${ext}`);
      return {
        success: false,
        error: `Unsupported image format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`
      };
    }

    // Read file and convert to base64
    try {
      const fileData = fs.readFileSync(fullPath);
      const base64Data = fileData.toString('base64');
      const mimeType = getMimeType(ext);
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log(`[PICTURE] Image loaded successfully, size: ${stats.size} bytes`);

      return {
        success: true,
        path: fullPath,
        dataUrl: dataUrl,
        size: stats.size,
        format: ext
      };
    } catch (readError) {
      console.error(`[PICTURE] Failed to read file:`, readError);
      return {
        success: false,
        error: `Unable to read file: ${readError.message}`
      };
    }

  } catch (error) {
    console.error(`[PICTURE] Image validation failed:`, error);
    return {
      success: false,
      error: `Validation failed: ${error.message}`
    };
  }
}

/**
 * Get MIME type based on file extension
 * @param {string} ext - File extension
 * @returns {string} MIME type
 */
function getMimeType(ext) {
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp'
  };

  return mimeTypes[ext.toLowerCase()] || 'image/png';
}

/**
 * Validate .fenestra file
 * @param {string} filePath - File path
 * @returns {Object} Validation result
 */
function validateFenestraFile(filePath) {
  console.debug(`[STORAGE] Validating .fenestra file: ${filePath}`);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File does not exist' };
    }

    // Check file extension
    if (!filePath.toLowerCase().endsWith('.fenestra')) {
      return { success: false, message: 'File extension must be .fenestra' };
    }

    // Read and parse JSON
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let windowData;

    try {
      windowData = JSON.parse(fileContent);
    } catch (parseError) {
      return { success: false, message: 'Invalid file format, not valid JSON' };
    }

    // Validate window data structure
    const validationResult = validateWindowData(windowData);

    if (!validationResult.isValid) {
      return { success: false, message: `Invalid file content: ${validationResult.message}` };
    }

    console.log(`[STORAGE] .fenestra file validation successful: ${filePath}`);
    return {
      success: true,
      message: 'File validation successful',
      data: windowData
    };

  } catch (error) {
    console.error(`[STORAGE] .fenestra file validation failed:`, error);
    return {
      success: false,
      message: `Validation failed: ${error.message}`
    };
  }
}

/**
 * Get file completion suggestions
 * @param {string} partialPath - Partial path
 * @param {string} currentDir - Current working directory
 * @returns {Object} Completion result
 */
async function getFileCompletions(partialPath, currentDir) {
  return withErrorHandling(async () => {
    console.debug(`[FILE_COMPLETION] Processing completion request: "${partialPath}", current directory: "${currentDir}"`);

    // SPECIAL CASES
    const caseMap = new Map();
    caseMap.set('restore-window', '')
    caseMap.set('save-window', '$')


    if (caseMap.has(partialPath)) {partialPath=caseMap.get(partialPath)}
    // SPECIAL CASES ENCLOSE

    // Validate input parameters
    const inputValidation = validateInput(
      { partialPath, currentDir }, 
      [] // No required fields - both can be empty/null
    );
    if (inputValidation) {
      return inputValidation;
    }

    // Get the game data directory (defaults to project root)
    const gameDataRoot = getDefaultGameDataDirectory();
    
    // Determine working directory - use current directory or default to game data root
    let workingDir = currentDir || gameDataRoot;
    
    // Validate the working directory is within game scope
    // Use allowlist mode (useBlocklist=false) for directory navigation to enforce game scope
    const workingDirValidation = validateAndResolvePath(workingDir, gameDataRoot, gameDataRoot, false);
    if (!workingDirValidation.isValid) {
      console.warn(`[FILE_COMPLETION] Invalid working directory: ${workingDirValidation.error}`);
      
      // If current directory is invalid, fall back to game data root
      workingDir = gameDataRoot;
      
      // Log this as a warning but continue with fallback
      const error = new FileCompletionError(
        `Working directory invalid, using fallback: ${workingDirValidation.error}`,
        workingDirValidation.errorCode || ERROR_CODES.INVALID_PATH,
        { 
          originalCurrentDir: currentDir,
          fallbackDir: gameDataRoot,
          validationError: workingDirValidation.error
        }
      );
      logError(error);
    } else {
      workingDir = workingDirValidation.resolvedPath;
    }

    console.debug(`[FILE_COMPLETION] Using working directory: "${workingDir}"`);

    // Handle empty input - show all contents of working directory
    if (!partialPath || partialPath.trim() === '') {
      return await getDirectoryContentsForCompletion(workingDir, '', gameDataRoot);
    }

    // Determine search directory and file pattern
    const { searchDir, filePattern } = parseCompletionPath(partialPath, workingDir, gameDataRoot);
    
    if (!searchDir) {
      return createErrorResponse(
        ERROR_CODES.INVALID_PATH,
        'Invalid path or access denied',
        { partialPath, workingDir, gameDataRoot }
      );
    }

    console.debug(`[FILE_COMPLETION] Search directory: "${searchDir}", file pattern: "${filePattern}"`);

    // Get directory contents with door-key system integration
    return await getDirectoryContentsForCompletion(searchDir, filePattern, gameDataRoot);
  }, 'getFileCompletions', { partialPath, currentDir });
}

/**
 * Parses completion path to determine search directory and file pattern
 * @param {string} partialPath - The partial path input
 * @param {string} workingDir - Current working directory
 * @param {string} gameDataRoot - Game data root directory
 * @returns {Object} Object with searchDir and filePattern
 */
function parseCompletionPath(partialPath, workingDir, gameDataRoot) {
  try {
    // Normalize the input path
    const normalizedPath = normalizePathInput(partialPath);
    
    // Validate normalized path
    if (!normalizedPath) {
      const error = new FileCompletionError(
        'Path normalization resulted in empty path',
        ERROR_CODES.MALFORMED_PATH,
        { partialPath, normalizedPath }
      );
      logError(error);
      return { searchDir: null, filePattern: '', error };
    }
    
    // Determine search directory and file pattern
    let searchDir, filePattern;

    if (path.isAbsolute(normalizedPath)) {
      // Absolute path
      const dirname = path.dirname(normalizedPath);
      const basename = path.basename(normalizedPath);

      // Validate the directory is within game scope
      // Use allowlist mode (useBlocklist=false) for directory navigation to enforce game scope
      const dirValidation = validateAndResolvePath(dirname, workingDir, gameDataRoot, false);
      if (!dirValidation.isValid) {
        const error = new FileCompletionError(
          `Absolute path outside scope: ${dirValidation.error}`,
          dirValidation.errorCode || ERROR_CODES.PATH_OUTSIDE_SCOPE,
          { 
            partialPath, 
            dirname, 
            workingDir, 
            gameDataRoot,
            validationError: dirValidation.error
          }
        );
        logError(error);
        return { searchDir: null, filePattern: '', error };
      }

      searchDir = dirValidation.resolvedPath;
      filePattern = basename;
    } else {
      // Relative path
      const dirname = path.dirname(normalizedPath);
      const basename = path.basename(normalizedPath);

      if (dirname === '.') {
        searchDir = workingDir;
      } else {
        // Validate the relative directory is within game scope
        // Use allowlist mode (useBlocklist=false) for directory navigation to enforce game scope
        const dirValidation = validateAndResolvePath(dirname, workingDir, gameDataRoot, false);
        if (!dirValidation.isValid) {
          const error = new FileCompletionError(
            `Relative path outside scope: ${dirValidation.error}`,
            dirValidation.errorCode || ERROR_CODES.PATH_OUTSIDE_SCOPE,
            { 
              partialPath, 
              dirname, 
              workingDir, 
              gameDataRoot,
              validationError: dirValidation.error
            }
          );
          logError(error);
          return { searchDir: null, filePattern: '', error };
        }
        searchDir = dirValidation.resolvedPath;
      }
      filePattern = basename;
    }

    console.debug(`[FILE_COMPLETION] Path parsing successful: searchDir="${searchDir}", filePattern="${filePattern}"`);
    return { searchDir, filePattern, error: null };

  } catch (error) {
    const completionError = new FileCompletionError(
      `Path parsing failed: ${error.message}`,
      ERROR_CODES.MALFORMED_PATH,
      { 
        partialPath, 
        workingDir, 
        gameDataRoot,
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    );
    logError(completionError);
    return { searchDir: null, filePattern: '', error: completionError };
  }
}

/**
 * Gets directory contents for file completion with door-key integration
 * @param {string} dirPath - Directory path to read
 * @param {string} pattern - File pattern to match
 * @param {string} gameDataRoot - Game data root directory
 * @returns {Object} Completion results
 */
async function getDirectoryContentsForCompletion(dirPath, pattern, gameDataRoot) {
  return withErrorHandling(async () => {
    // Check directory access with door-key system
    const doorKeyAccess = checkDirectoryAccess(dirPath);
    if (!doorKeyAccess.hasAccess) {
      console.debug(`[FILE_COMPLETION] Directory access denied by door-key system: ${dirPath}`);
      
      // Create appropriate error response based on door-key system result
      let errorCode = doorKeyAccess.errorCode || ERROR_CODES.ACCESS_DENIED;
      let message = doorKeyAccess.lockReason || 'Directory access denied';
      
      if (doorKeyAccess.isLocked) {
        if (doorKeyAccess.requiredKey) {
          if (doorKeyAccess.keyAvailable) {
            message = `Directory is locked. Use key "${doorKeyAccess.requiredKey}" to unlock.`;
          } else {
            message = `Directory is locked. Required key "${doorKeyAccess.requiredKey}" is not available.`;
            errorCode = ERROR_CODES.MISSING_KEY;
          }
        } else {
          message = doorKeyAccess.lockReason || 'Directory is locked';
        }
      }
      
      return createErrorResponse(errorCode, message, {
        path: dirPath,
        pattern,
        doorKeyInfo: doorKeyAccess
      });
    }

    // Use directory navigator to get contents with improved options
    // Don't pass pattern here - we'll do enhanced filtering at completion level
    const contentsResult = await getDirectoryContents(dirPath, '', {
      includeHidden: pattern.startsWith('.'), // Show hidden files if pattern starts with dot
      includeDirectories: true,
      includeFiles: true,
      caseSensitive: false, // Case-insensitive matching by default
      sortAlphabetically: false, // We'll do our own sorting with scoring
      maxResults: 1000 // Higher limit since we'll filter at completion level
    });

    if (!contentsResult.success) {
      throw new FileCompletionError(
        contentsResult.error || 'Failed to read directory contents',
        ERROR_CODES.DIRECTORY_READ_FAILED,
        { path: dirPath, pattern, originalError: contentsResult.error }
      );
    }

    // Filter accessible directories using door-key system
    const accessibleEntries = filterAccessibleDirectories(contentsResult.entries);

    // Apply enhanced filtering for better pattern matching
    const filteredEntries = filterMatchingEntries(accessibleEntries, pattern, {
      caseSensitive: false,
      includeAllFileTypes: true,
      maxResults: 100 // Reasonable limit for UI display
    });

    // Convert to completion format with enhanced special character handling
    const completions = filteredEntries.map(entry => {
      // Clean up the display name - remove trailing slash for processing
      const baseName = entry.name.replace(/\/$/, '');
      const displayName = entry.type === 'directory' ? `${baseName}/` : baseName;
      
      // Use enhanced escaping logic
      const needsEscaping = entry.hasSpecialChars || hasSpecialCharacters(baseName);
      
      // Use the new escaping function for better shell compatibility
      let escapedName;
      if (needsEscaping) {
        escapedName = escapeFilenameForShell(baseName, { 
          forceQuotes: false, 
          preferSingleQuotes: false 
        });
      } else {
        escapedName = baseName;
      }
      
      const finalEscapedName = entry.type === 'directory' ? `${escapedName}/` : escapedName;

      const completion = {
        name: displayName, // Display name with trailing slash for directories
        escapedName: finalEscapedName, // Properly escaped name for shell usage
        type: entry.type,
        path: entry.relativePath || baseName,
        hasSpecialChars: needsEscaping,
        isLocked: entry.isLocked || false
      };

      // Add door-key system information if entry is locked
      if (entry.isLocked) {
        completion.lockReason = entry.lockReason;
        completion.requiredKey = entry.requiredKey;
        completion.doorType = entry.doorType;
        if (entry.progress) {
          completion.progress = entry.progress;
        }
      }

      return completion;
    });

    // Calculate common prefix with enhanced special character handling
    const commonPrefix = findCommonPrefixWithSpecialChars(
      completions.map(c => c.name),
      {
        caseSensitive: false,
        respectWordBoundaries: true,
        minPrefixLength: 1,
        includePathSeparators: true
      }
    );

    console.debug(`[FILE_COMPLETION] Found ${completions.length} accessible entries`);

    // Determine appropriate message
    let message = '';
    if (completions.length === 0) {
      if (pattern) {
        message = `No files match the pattern "${pattern}"`;
      } else {
        message = 'No accessible files found in this directory';
      }
    }

    return createSuccessResponse(completions, commonPrefix, {
      totalMatches: completions.length,
      message,
      searchPath: dirPath,
      searchPattern: pattern,
      totalEntriesFound: contentsResult.totalCount,
      accessibleEntriesFound: accessibleEntries.length
    });
  }, 'getDirectoryContentsForCompletion', { dirPath, pattern, gameDataRoot });
}

/**
 * Normalizes path input for completion processing with enhanced special character handling
 * @param {string} inputPath - Raw input path
 * @returns {string} Normalized path
 */
function normalizePathInput(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }

  // Use the enhanced normalization function
  let normalized = normalizePathForCompletion(inputPath);

  // Additional validation for path characters
  const validation = validatePathCharacters(normalized);
  if (!validation.isValid) {
    console.warn(`[PATH_NORMALIZE] Path validation warning: ${validation.error}`);
    // Continue with the normalized path but log the warning
  }

  return normalized;
}

/**
 * Enhanced filtering for file completion entries
 * Removes storage-specific filtering and applies more flexible matching
 * @param {Array} entries - Array of directory entries
 * @param {string} pattern - Pattern to match against
 * @param {Object} options - Filtering options
 * @returns {Array} Filtered entries
 */
function filterMatchingEntries(entries, pattern, options = {}) {
  const {
    caseSensitive = false,
    includeAllFileTypes = true,
    maxResults = 200
  } = options;

  if (!pattern || pattern.trim() === '') {
    // No pattern - return all entries (up to limit)
    // Sort to prioritize directories first, then alphabetically
    const sortedEntries = [...entries].sort((a, b) => {
      // Directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // Then alphabetically (case-insensitive)
      return a.name.localeCompare(b.name, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });
    
    return sortedEntries.slice(0, maxResults);
  }

  const filteredEntries = [];
  const searchPattern = caseSensitive ? pattern.trim() : pattern.trim().toLowerCase();

  // Create scoring system for better match ranking
  const scoredMatches = [];

  for (const entry of entries) {
    const entryName = caseSensitive ? entry.name : entry.name.toLowerCase();
    const baseEntryName = entryName.replace(/\/$/, ''); // Remove trailing slash for matching
    
    let matchScore = 0;
    let matches = false;

    // 1. Exact match (highest priority - score 100)
    if (baseEntryName === searchPattern) {
      matches = true;
      matchScore = 100;
    }
    // 2. Prefix matching (high priority - score 80-90)
    else if (baseEntryName.startsWith(searchPattern)) {
      matches = true;
      // Shorter matches get higher scores
      matchScore = 90 - Math.min(10, baseEntryName.length - searchPattern.length);
    }
    // 3. Word boundary matching (medium-high priority - score 60-70)
    else {
      const nameParts = baseEntryName.split(/[-_.\s]/);
      for (let i = 0; i < nameParts.length; i++) {
        const part = nameParts[i];
        if (part.startsWith(searchPattern)) {
          matches = true;
          // Earlier word boundaries get higher scores
          matchScore = 70 - (i * 5);
          break;
        }
      }
    }
    
    // 4. Substring matching (medium priority - score 40-50)
    if (!matches && baseEntryName.includes(searchPattern)) {
      matches = true;
      const index = baseEntryName.indexOf(searchPattern);
      // Earlier occurrences get higher scores
      matchScore = 50 - Math.min(10, index);
    }
    
    // 5. Extension matching (lower priority - score 30)
    if (!matches && searchPattern.startsWith('.') && baseEntryName.endsWith(searchPattern)) {
      matches = true;
      matchScore = 30;
    }
    
    // 6. Fuzzy matching for very partial matches (lowest priority - score 10-20)
    if (!matches && searchPattern.length >= 2) {
      // Check if all characters in pattern appear in order (not necessarily consecutive)
      let patternIndex = 0;
      for (let i = 0; i < baseEntryName.length && patternIndex < searchPattern.length; i++) {
        if (baseEntryName[i] === searchPattern[patternIndex]) {
          patternIndex++;
        }
      }
      
      if (patternIndex === searchPattern.length) {
        matches = true;
        matchScore = 20 - Math.min(10, baseEntryName.length - searchPattern.length);
      }
    }

    if (matches) {
      // Boost score for directories to prioritize them
      if (entry.type === 'directory') {
        matchScore += 5;
      }
      
      // Boost score for files that don't start with dot (unless pattern starts with dot)
      if (!entry.name.startsWith('.') || searchPattern.startsWith('.')) {
        matchScore += 2;
      }

      scoredMatches.push({
        entry,
        score: matchScore
      });
    }
  }

  // Sort by score (descending) then alphabetically
  scoredMatches.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score; // Higher scores first
    }
    // Same score - sort alphabetically
    return a.entry.name.localeCompare(b.entry.name, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });

  // Extract entries and apply limit
  const sortedEntries = scoredMatches.map(match => match.entry);
  return sortedEntries.slice(0, maxResults);
}

/**
 * Checks if a filename contains special characters that need escaping
 * @param {string} filename - The filename to check
 * @returns {boolean} True if filename has special characters
 */
function hasSpecialCharacters(filename) {
  // Characters that typically need escaping in shell contexts
  // Enhanced pattern for comprehensive special character detection
  // Includes: spaces, quotes, backslashes, wildcards, brackets, braces, parentheses,
  // pipes, redirections, semicolons, ampersands, tildes, backticks, dollar signs, hash
  const specialChars = /[\s'"\\!*?[\]{}()&|;><$`~#]/;
  return specialChars.test(filename);
}



/**
 * Check if filename needs quoting
 * @param {string} filename - Filename
 * @returns {boolean} Whether quoting is needed
 */
function needsQuoting(filename) {
  // Check if contains spaces, special characters, or characters that need escaping
  // Enhanced pattern to handle more shell metacharacters and edge cases
  // Includes: spaces, quotes, backslashes, wildcards, brackets, braces, parentheses,
  // pipes, redirections, semicolons, ampersands, tildes, backticks, dollar signs, hash
  return /[\s'"\\&|<>(){}[\]$`!?*;~#]/.test(filename);
}



/**
 * Get current working directory
 * @returns {Object} Current directory information
 */
function getCurrentDirectory() {
  return withErrorHandling(async () => {
    console.debug('[CURRENT_DIR] Get current working directory');

    const currentDir = process.cwd();
    console.debug(`[CURRENT_DIR] Current working directory: ${currentDir}`);

    return {
      success: true,
      currentDirectory: currentDir,
      message: 'Retrieved successfully'
    };
  }, 'getCurrentDirectory', {});
}

/**
 * Change current working directory
 * @param {string} targetPath - Target directory path
 * @param {string} currentDir - Current working directory (optional)
 * @returns {Object} Directory change result
 */
async function changeDirectory(targetPath, currentDir = null) {
  return withErrorHandling(async () => {
    console.debug(`[CHANGE_DIR] Change directory to: "${targetPath}"`);

    // Get the game data directory as the root scope
    const gameDataRoot = getDefaultGameDataDirectory();
    const workingDir = currentDir || process.cwd();

    // Handle empty path - go to game data root
    if (!targetPath || targetPath.trim() === '') {
      const navigationResult = navigateToDirectory(gameDataRoot, workingDir, gameDataRoot);
      
      if (!navigationResult.success) {
        throw new FileCompletionError(
          navigationResult.error,
          ERROR_CODES.DIRECTORY_NOT_FOUND,
          { targetPath: gameDataRoot, currentDir: workingDir }
        );
      }

      return createSuccessResponse([], '', {
        message: `Switched to game data root directory: ${navigationResult.newPath}`,
        newDirectory: navigationResult.newPath,
        previousDirectory: workingDir
      });
    }

    // Handle special paths
    if (targetPath === '..') {
      // Go to parent directory
      const { getParentDirectory } = await import('../utils/directoryNavigator.js');
      const parentResult = getParentDirectory(workingDir, gameDataRoot);
      
      if (!parentResult.success) {
        return createErrorResponse(
          ERROR_CODES.INVALID_PATH,
          parentResult.error,
          { targetPath, currentDir: workingDir, gameDataRoot }
        );
      }

      return createSuccessResponse([], '', {
        message: `Switched to parent directory: ${parentResult.parentPath}`,
        newDirectory: parentResult.parentPath,
        previousDirectory: workingDir
      });
    }

    if (targetPath === '~' || targetPath === '$HOME') {
      // Go to game data root (equivalent to home in this context)
      const navigationResult = navigateToDirectory(gameDataRoot, workingDir, gameDataRoot);
      
      if (!navigationResult.success) {
        throw new FileCompletionError(
          navigationResult.error,
          ERROR_CODES.DIRECTORY_NOT_FOUND,
          { targetPath: gameDataRoot, currentDir: workingDir }
        );
      }

      return createSuccessResponse([], '', {
        message: `Switched to game data root directory: ${navigationResult.newPath}`,
        newDirectory: navigationResult.newPath,
        previousDirectory: workingDir
      });
    }

    // Navigate to the specified directory
    const navigationResult = navigateToDirectory(targetPath, workingDir, gameDataRoot);
    
    if (!navigationResult.success) {
      return createErrorResponse(
        ERROR_CODES.DIRECTORY_NOT_FOUND,
        navigationResult.error,
        { targetPath, currentDir: workingDir, gameDataRoot }
      );
    }

    // Check door-key system access
    const doorKeyAccess = checkDirectoryAccess(navigationResult.newPath);
    if (!doorKeyAccess.hasAccess) {
      let errorMessage = 'Directory access denied';
      
      if (doorKeyAccess.isLocked) {
        if (doorKeyAccess.requiredKey) {
          errorMessage = `Directory is locked, required key: ${doorKeyAccess.requiredKey}`;
        } else {
          errorMessage = doorKeyAccess.lockReason || 'Directory is locked';
        }
      }
      
      return createErrorResponse(
        ERROR_CODES.ACCESS_DENIED,
        errorMessage,
        { 
          targetPath, 
          resolvedPath: navigationResult.newPath,
          doorKeyInfo: doorKeyAccess 
        }
      );
    }

    console.debug(`[CHANGE_DIR] Directory change successful: ${navigationResult.newPath}`);

    return createSuccessResponse([], '', {
      message: `Switched to directory: ${navigationResult.newPath}`,
      newDirectory: navigationResult.newPath,
      previousDirectory: workingDir
    });
  }, 'changeDirectory', { targetPath, currentDir });
}

/**
 * List directory contents
 * @param {string} dirPath - Directory path (optional, defaults to current directory)
 * @param {boolean} showHidden - Whether to show hidden files
 * @returns {Object} Directory contents list result
 */
async function listDirectoryContents(dirPath = '', showHidden = false) {
  return withErrorHandling(async () => {
    console.debug(`[LIST_DIR] List directory contents: "${dirPath}", show hidden: ${showHidden}`);

    // Get the game data directory as the root scope
    const gameDataRoot = getDefaultGameDataDirectory();
    
    // Get the working directory (defaults to .fenestra-storage)
    const workingDirResult = await getWorkingDirectory();
    const currentDir = workingDirResult.currentDirectory || process.cwd();
    
    // Determine target directory
    let targetDir = dirPath.trim();
    if (!targetDir) {
      targetDir = currentDir;
    } else {
      // Resolve the path within game scope
      // Use allowlist validation (useBlocklist=false) for directory navigation commands (cd, pwd, dir)
      // This enforces game scope restrictions - users can only navigate within the game data directory
      // File operation commands use blocklist validation for broader access to user content
      const pathValidation = validateAndResolvePath(targetDir, currentDir, gameDataRoot, false);
      if (!pathValidation.isValid) {
        return createErrorResponse(
          pathValidation.errorCode || ERROR_CODES.INVALID_PATH,
          pathValidation.error,
          { dirPath, currentDir, gameDataRoot }
        );
      }
      targetDir = pathValidation.resolvedPath;
    }

    // Check door-key system access
    const doorKeyAccess = checkDirectoryAccess(targetDir);
    if (!doorKeyAccess.hasAccess) {
      let errorMessage = 'Directory access denied';
      
      if (doorKeyAccess.isLocked) {
        if (doorKeyAccess.requiredKey) {
          errorMessage = `Directory is locked, required key: ${doorKeyAccess.requiredKey}`;
        } else {
          errorMessage = doorKeyAccess.lockReason || 'Directory is locked';
        }
      }
      
      return createErrorResponse(
        ERROR_CODES.ACCESS_DENIED,
        errorMessage,
        { 
          dirPath: targetDir,
          doorKeyInfo: doorKeyAccess 
        }
      );
    }

    // Get directory contents
    const contentsResult = await getDirectoryContents(targetDir, '', {
      includeHidden: showHidden,
      includeDirectories: true,
      includeFiles: true,
      caseSensitive: false,
      sortAlphabetically: true,
      maxResults: 1000
    });

    if (!contentsResult.success) {
      return createErrorResponse(
        ERROR_CODES.DIRECTORY_READ_FAILED,
        contentsResult.error,
        { dirPath: targetDir, showHidden }
      );
    }

    // Filter accessible directories using door-key system
    const accessibleEntries = filterAccessibleDirectories(contentsResult.entries);

    // Format the output
    let message = `Directory contents: ${targetDir}\n`;
    
    if (accessibleEntries.length === 0) {
      message += '(empty directory)';
    } else {
      // Group by type and format
      const directories = accessibleEntries.filter(entry => entry.type === 'directory');
      const files = accessibleEntries.filter(entry => entry.type === 'file');
      
      if (directories.length > 0) {
        message += '\nDirectories:\n';
        directories.forEach(dir => {
          const displayName = dir.name.replace(/\/$/, ''); // Remove trailing slash for display
          const lockIndicator = dir.isLocked ? ' [locked]' : '';
          message += `  ${displayName}/${lockIndicator}\n`;
        });
      }
      
      if (files.length > 0) {
        message += '\nFiles:\n';
        files.forEach(file => {
          const sizeInfo = file.size ? ` (${Math.round(file.size / 1024)}KB)` : '';
          message += `  ${file.name}${sizeInfo}\n`;
        });
      }
      
      message += `\nTotal: ${directories.length} directories, ${files.length} files`;
    }

    console.debug(`[LIST_DIR] Found ${accessibleEntries.length} accessible entries`);

    return createSuccessResponse(accessibleEntries, '', {
      message,
      directoryPath: targetDir,
      totalEntries: accessibleEntries.length,
      directories: accessibleEntries.filter(e => e.type === 'directory').length,
      files: accessibleEntries.filter(e => e.type === 'file').length,
      showHidden
    });
  }, 'listDirectoryContents', { dirPath, showHidden });
}

/**
 * Get current working directory (for terminal display)
 * @returns {Object} Working directory information
 */
async function getWorkingDirectory() {
  return withErrorHandling(async () => {
    console.debug('[GET_WORKING_DIR] Get working directory');

    const gameDataRoot = getDefaultGameDataDirectory();
    const fenestraStoragePath = path.join(gameDataRoot, '.fenestra-storage');
    
    // Ensure .fenestra-storage directory exists
    try {
      if (!fs.existsSync(fenestraStoragePath)) {
        console.debug(`[GET_WORKING_DIR] Creating .fenestra-storage directory: ${fenestraStoragePath}`);
        fs.mkdirSync(fenestraStoragePath, { recursive: true });
        console.log(`[GET_WORKING_DIR] .fenestra-storage directory created`);
      }
    } catch (error) {
      console.error(`[GET_WORKING_DIR] Failed to create .fenestra-storage directory:`, error);
      // Fall back to game data root if we can't create .fenestra-storage
    }
    
    // Default to .fenestra-storage directory if it exists and is accessible
    let workingDirectory = process.cwd();
    let shouldUseFenestraStorage = false;
    
    try {
      if (fs.existsSync(fenestraStoragePath)) {
        // Validate that .fenestra-storage is within game scope
        if (isWithinGameScope(fenestraStoragePath, gameDataRoot)) {
          workingDirectory = fenestraStoragePath;
          shouldUseFenestraStorage = true;
          console.debug(`[GET_WORKING_DIR] Using .fenestra-storage as working directory`);
        }
      }
    } catch (error) {
      console.warn(`[GET_WORKING_DIR] Could not access .fenestra-storage directory:`, error);
    }
    
    // Check if working directory is within game scope
    const isWithinScope = isWithinGameScope(workingDirectory, gameDataRoot);
    
    let displayPath = workingDirectory;
    let message = `Current working directory: ${workingDirectory}`;
    
    if (isWithinScope) {
      // Show relative path from game data root for better readability
      const relativePath = path.relative(gameDataRoot, workingDirectory);
      if (relativePath) {
        displayPath = `./${relativePath}`;
        if (shouldUseFenestraStorage) {
          message = `Current working directory: ${displayPath} (Fenestra storage directory)`;
        } else {
          message = `Current working directory: ${displayPath} (${workingDirectory})`;
        }
      } else {
        displayPath = './';
        message = `Current working directory: ${displayPath} (game data root directory)`;
      }
    } else {
      message += ' [Warning: not within game data scope]';
    }

    console.debug(`[GET_WORKING_DIR] Working directory: ${workingDirectory}`);

    return createSuccessResponse([], '', {
      message,
      currentDirectory: workingDirectory,
      displayPath,
      gameDataRoot,
      isWithinScope,
      isFenestraStorage: shouldUseFenestraStorage
    });
  }, 'getWorkingDirectory', {});
}

/**
 * Clean up IPC handlers
 */
export function cleanupIpcHandlers() {
  // Remove all IPC handlers
  ipcMain.removeAllListeners('game/window/create');
  ipcMain.removeAllListeners('game/window/set-bounds');
  ipcMain.removeAllListeners('game/window/get-bounds');
  ipcMain.removeAllListeners('terminal/execute-command');
  ipcMain.removeAllListeners('picture/load');
  ipcMain.removeAllListeners('lens/get-position');
  ipcMain.removeAllListeners('window/get-info');
  ipcMain.removeAllListeners('storage/validate-fenestra-file');
  ipcMain.removeAllListeners('terminal/get-file-completions');
  ipcMain.removeAllListeners('terminal/get-current-directory');
  ipcMain.removeAllListeners('terminal/change-directory');
  ipcMain.removeAllListeners('terminal/list-directory');
  ipcMain.removeAllListeners('terminal/get-working-directory');
  ipcMain.removeAllListeners('config/get-game-data-directory');
  ipcMain.removeAllListeners('config/set-game-data-directory');
  ipcMain.removeAllListeners('config/get-config');
  ipcMain.removeAllListeners('config/reset-to-defaults');
  ipcMain.removeAllListeners('email/get-list');
  ipcMain.removeAllListeners('email/get-by-id');
  ipcMain.removeAllListeners('email/mark-read');
  ipcMain.removeAllListeners('email/get-inbox-path');
  ipcMain.removeAllListeners('email/execute-action');
  ipcMain.removeAllListeners('start-menu/new-game');
  ipcMain.removeAllListeners('start-menu/continue-game');
  ipcMain.removeAllListeners('start-menu/check-save-exists');
  ipcMain.removeAllListeners('start-menu/get-save-metadata');

  console.debug('[IPC] IPC handlers cleaned up');
}

