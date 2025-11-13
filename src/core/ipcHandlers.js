import { ipcMain } from 'electron';
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
} from './windowManager.js';
import {
  saveWindowToFile,
  loadWindowFromFile,
  deserializeWindow,
  listStoredWindows,
  deleteStoredWindow,
  validateWindowData
} from './windowStorage.js';
import { validateAndResolvePath, getDefaultGameDataDirectory, isWithinGameScope } from './utils/pathSecurityValidator.js';
import { 
  navigateToDirectory, 
  getDirectoryContents, 
  findCommonPrefix, 
  findCommonPrefixWithSpecialChars,
  normalizePathForCompletion,
  escapeFilenameForShell,
  unescapeFilenameFromShell,
  validatePathCharacters
} from './utils/directoryNavigator.js';
import { checkDirectoryAccess, filterAccessibleDirectories } from './doorKeySystem.js';
import { 
  FileCompletionError, 
  ERROR_CODES, 
  createErrorResponse, 
  createSuccessResponse,
  withErrorHandling,
  validateInput,
  logError 
} from './utils/errorHandler.js';
import fs from 'node:fs';
import path from 'node:path';
import '../../logger.js'; // 导入日志系统

/**
 * 初始化 IPC 处理程序
 */
export function initializeIpcHandlers() {
  console.debug('[IPC] 设置IPC处理程序...');

  ipcMain.handle('game/window/create', (_e, payload) => {
    console.debug('[IPC] 收到创建窗口请求:', payload);
    const { id, bounds = {}, title } = payload ?? {};

    if (!id) {
      console.warn('[IPC] 错误: 缺少窗口ID');
      return { error: 'id required' };
    }

    console.debug(`[IPC] 开始创建窗口, ID: ${id}`);
    const win = createWindow(id, { ...bounds, title });
    const response = { ok: true, id, webContentsId: win.webContents.id };

    console.debug('[IPC] 窗口创建响应:', response);
    return response;
  });

  ipcMain.handle('game/window/set-bounds', (_e, { id, bounds }) => {
    console.debug(`[IPC] 收到设置边界请求, ID: ${id}, 边界:`, bounds);

    if (!id || !bounds) {
      console.warn('[IPC] 错误: 缺少ID或边界参数');
      return { error: 'id & bounds required' };
    }

    setBounds(id, bounds);
    const response = { ok: true };

    console.debug('[IPC] 设置边界响应:', response);
    return response;
  });

  ipcMain.handle('game/window/get-bounds', (_e, { id }) => {
    console.debug(`[IPC] 收到获取边界请求, ID: ${id}`);

    const b = getBounds(id);
    const response = b ? { ok: true, bounds: b } : { error: 'not found' };

    console.debug('[IPC] 获取边界响应:', response);
    return response;
  });

  // 终端命令处理程序
  ipcMain.handle('terminal/execute-command', (_e, { command, args }) => {
    console.debug(`[IPC] 收到终端命令: ${command}, 参数:`, args);

    try {
      return executeTerminalCommand(command, args);
    } catch (error) {
      console.error('[IPC] 终端命令执行错误:', error);
      return { success: false, message: error.message };
    }
  });

  // 图片加载处理程序
  ipcMain.handle('picture/load', (_e, imagePath) => {
    console.debug(`[IPC] 收到图片加载请求: ${imagePath}`);

    try {
      return loadPictureFile(imagePath);
    } catch (error) {
      console.error('[IPC] 图片加载错误:', error);
      return { success: false, error: error.message };
    }
  });

  // 镜头系统处理程序
  ipcMain.handle('lens/get-position', (_e, lensId) => {
    console.debug(`[IPC] 获取镜头位置: ${lensId}`);
    const lensInfo = getLensSystem(lensId);
    if (lensInfo && lensInfo.lensBounds) {
      return { success: true, bounds: lensInfo.lensBounds };
    }
    return { success: false, error: '镜头不存在或缺少位置信息' };
  });

  ipcMain.handle('window/get-info', (_e, windowId) => {
    console.debug(`[IPC] 获取窗口信息: ${windowId}`);
    const info = getWindowInfo(windowId);
    if (info) {
      return { success: true, bounds: { x: info.x, y: info.y, width: info.width, height: info.height } };
    }
    return { success: false, error: '窗口不存在' };
  });

  // Window storage validation handler
  ipcMain.handle('storage/validate-fenestra-file', (_e, filePath) => {
    console.debug(`[IPC] 验证.fenestra文件: ${filePath}`);

    try {
      return validateFenestraFile(filePath);
    } catch (error) {
      console.error('[IPC] .fenestra文件验证错误:', error);
      return { success: false, message: error.message };
    }
  });

  // File system auto-completion handlers
  ipcMain.handle('terminal/get-file-completions', async (_e, { partialPath, currentDir }) => {
    console.debug(`[IPC] 获取文件补全: ${partialPath}, 当前目录: ${currentDir}`);

    try {
      return await getFileCompletions(partialPath, currentDir);
    } catch (error) {
      console.error('[IPC] 文件补全错误:', error);
      
      // Create standardized error response
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `File completion failed: ${error.message}`,
        { partialPath, currentDir, originalError: error.message }
      );
    }
  });

  ipcMain.handle('terminal/get-current-directory', async (_e) => {
    console.debug('[IPC] 获取当前工作目录');

    try {
      return await getCurrentDirectory();
    } catch (error) {
      console.error('[IPC] 获取当前目录错误:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get current directory: ${error.message}`,
        { originalError: error.message }
      );
    }
  });

  // Directory navigation handlers
  ipcMain.handle('terminal/change-directory', async (_e, { targetPath, currentDir }) => {
    console.debug(`[IPC] 更改目录: ${targetPath}, 当前目录: ${currentDir}`);

    try {
      return await changeDirectory(targetPath, currentDir);
    } catch (error) {
      console.error('[IPC] 更改目录错误:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to change directory: ${error.message}`,
        { targetPath, currentDir, originalError: error.message }
      );
    }
  });

  ipcMain.handle('terminal/list-directory', async (_e, { dirPath, showHidden }) => {
    console.debug(`[IPC] 列出目录内容: ${dirPath}, 显示隐藏文件: ${showHidden}`);

    try {
      return await listDirectoryContents(dirPath, showHidden);
    } catch (error) {
      console.error('[IPC] 列出目录内容错误:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to list directory: ${error.message}`,
        { dirPath, showHidden, originalError: error.message }
      );
    }
  });

  ipcMain.handle('terminal/get-working-directory', async (_e) => {
    console.debug('[IPC] 获取当前工作目录');

    try {
      return await getWorkingDirectory();
    } catch (error) {
      console.error('[IPC] 获取工作目录错误:', error);
      
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get working directory: ${error.message}`,
        { originalError: error.message }
      );
    }
  });

  // Configuration management handlers
  ipcMain.handle('config/get-game-data-directory', async (_e) => {
    console.debug('[IPC] 获取游戏数据目录配置');
    
    try {
      const { getGameDataDirectory } = await import('./config.js');
      const gameDataDir = getGameDataDirectory();
      
      console.debug(`[IPC] 游戏数据目录: ${gameDataDir}`);
      
      return {
        success: true,
        gameDataDirectory: gameDataDir
      };
      
    } catch (error) {
      console.error('[IPC] 获取游戏数据目录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('config/set-game-data-directory', async (_e, { path: newPath }) => {
    console.debug(`[IPC] 设置游戏数据目录: ${newPath}`);
    
    try {
      const { setGameDataDirectory } = await import('./config.js');
      const result = setGameDataDirectory(newPath);
      
      if (result.success) {
        console.log(`[IPC] 游戏数据目录已更新: ${result.path}`);
      } else {
        console.warn(`[IPC] 游戏数据目录设置失败: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] 设置游戏数据目录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('config/get-config', async (_e) => {
    console.debug('[IPC] 获取完整配置');
    
    try {
      const { getConfig } = await import('./config.js');
      const config = getConfig();
      
      console.debug('[IPC] 配置获取成功');
      
      return {
        success: true,
        config
      };
      
    } catch (error) {
      console.error('[IPC] 获取配置失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('config/reset-to-defaults', async (_e) => {
    console.debug('[IPC] 重置配置为默认值');
    
    try {
      const { resetConfigToDefaults } = await import('./config.js');
      const result = resetConfigToDefaults();
      
      if (result.success) {
        console.log('[IPC] 配置已重置为默认值');
      } else {
        console.warn(`[IPC] 配置重置失败: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('[IPC] 重置配置失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Email system handlers
  ipcMain.handle('email/get-list', async (_e, { limit, offset }) => {
    console.debug(`[IPC] 获取邮件列表: limit=${limit}, offset=${offset}`);
    
    try {
      const { getEmails } = await import('./emailStorage.js');
      const emails = await getEmails(limit, offset);
      
      console.debug(`[IPC] 返回 ${emails.length} 封邮件`);
      
      return {
        success: true,
        emails,
        count: emails.length
      };
      
    } catch (error) {
      console.error('[IPC] 获取邮件列表失败:', error);
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  ipcMain.handle('email/get-by-id', async (_e, { emailId }) => {
    console.debug(`[IPC] 获取邮件: ${emailId}`);
    
    try {
      const { getEmailById } = await import('./emailStorage.js');
      const email = await getEmailById(emailId);
      
      if (!email) {
        console.warn(`[IPC] 邮件未找到: ${emailId}`);
        return {
          success: false,
          error: 'Email not found',
          email: null
        };
      }
      
      console.debug(`[IPC] 邮件获取成功: ${emailId}`);
      
      return {
        success: true,
        email
      };
      
    } catch (error) {
      console.error(`[IPC] 获取邮件失败: ${emailId}`, error);
      return {
        success: false,
        error: error.message,
        email: null
      };
    }
  });

  ipcMain.handle('email/mark-read', async (_e, { emailId }) => {
    console.debug(`[IPC] 标记邮件为已读: ${emailId}`);
    
    try {
      const { markEmailAsRead } = await import('./emailStorage.js');
      const result = await markEmailAsRead(emailId);
      
      if (result.success) {
        console.log(`[IPC] 邮件已标记为已读: ${emailId}`);
      } else {
        console.warn(`[IPC] 标记邮件为已读失败: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[IPC] 标记邮件为已读失败: ${emailId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('email/get-inbox-path', async (_e) => {
    console.debug('[IPC] 获取收件箱路径');
    
    try {
      const { getInboxPath } = await import('./emailStorage.js');
      const inboxPath = getInboxPath();
      
      if (!inboxPath) {
        console.warn('[IPC] 邮件系统未初始化');
        return {
          success: false,
          error: 'Email system not initialized',
          inboxPath: null
        };
      }
      
      console.debug(`[IPC] 收件箱路径: ${inboxPath}`);
      
      return {
        success: true,
        inboxPath
      };
      
    } catch (error) {
      console.error('[IPC] 获取收件箱路径失败:', error);
      return {
        success: false,
        error: error.message,
        inboxPath: null
      };
    }
  });

  console.debug('[IPC] 所有IPC处理程序已设置完成');
}

/**
 * 执行终端命令
 * @param {string} command - 命令名
 * @param {Array} args - 参数数组
 * @returns {Object} 执行结果
 */
function executeTerminalCommand(command, args) {
  console.debug(`[TERMINAL] 执行命令: ${command}, 参数:`, args);

  switch (command) {
    case 'list':
    case 'ls': {
      const windows = getWindowsInfo();
      const message = windows.map(w => `${w.id}: ${w.title}`).join('\n');
      return {
        success: true,
        message: message || '没有打开的窗口',
      };
    }

    case 'getwindows': {
      const windows = getWindowsInfo();
      return {
        success: true,
        message: `找到 ${windows.length} 个窗口`,
        data: null
      };
    }

    case 'info': {
      if (args.length === 0) {
        return { success: false, message: '用法: info [窗口ID]' };
      }

      const windowId = args[0];
      const info = getWindowInfo(windowId);

      if (!info) {
        return { success: false, message: `窗口 ${windowId} 不存在` };
      }

      return {
        success: true,
        message: `窗口 ${windowId} 的信息:`,
        data: info
      };
    }

    case 'get-title': {
      if (args.length < 1) {
        return { success: false, message: '用法: get-title [窗口ID]' };
      }

      const windowId = args[0];
      const title = getWindowTitle(windowId);

      if (title === null) {
        return { success: false, message: `窗口 ${windowId} 不存在` };
      }

      return {
        success: true,
        message: `窗口 ${windowId} 的标题: ${title}`,
        data: { title }
      };
    }

    case 'set-title': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-title [窗口ID] "标题"' };
      }

      const windowId = args[0];
      const title = args.slice(1).join(' ');

      return updateWindowProperty(windowId, 'title', title);
    }

    case 'set-size': {
      if (args.length < 3) {
        return { success: false, message: '用法: set-size [窗口ID] [宽度] [高度]' };
      }

      const windowId = args[0];
      const width = parseInt(args[1]);
      const height = parseInt(args[2]);

      if (isNaN(width) || isNaN(height)) {
        return { success: false, message: '宽度和高度必须是数字' };
      }

      return updateWindowProperty(windowId, 'size', [width, height]);
    }

    case 'set-position': {
      if (args.length < 3) {
        return { success: false, message: '用法: set-position [窗口ID] [x] [y]' };
      }

      const windowId = args[0];
      const x = parseInt(args[1]);
      const y = parseInt(args[2]);

      if (isNaN(x) || isNaN(y)) {
        return { success: false, message: 'x 和 y 必须是数字' };
      }

      return updateWindowProperty(windowId, 'position', [x, y]);
    }

    case 'set-resizable': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-resizable [窗口ID] [true/false]' };
      }

      const windowId = args[0];
      const resizable = args[1].toLowerCase();

      if (resizable !== 'true' && resizable !== 'false') {
        return { success: false, message: 'resizable 必须是 true 或 false' };
      }

      return updateWindowProperty(windowId, 'resizable', resizable === 'true');
    }

    case 'set-visibility': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-visibility [窗口ID] [true/false]' };
      }

      const windowId = args[0];
      const visibility = args[1].toLowerCase();

      if (visibility !== 'true' && visibility !== 'false') {
        return { success: false, message: 'visibility 必须是 true 或 false' };
      }

      return updateWindowProperty(windowId, 'visibility', visibility === 'true');
    }

    case 'show': {
      if (args.length < 1) {
        return { success: false, message: '用法: show [窗口ID]' };
      }

      const windowId = args[0];
      return updateWindowProperty(windowId, 'visibility', true);
    }

    case 'hide': {
      if (args.length < 1) {
        return { success: false, message: '用法: hide [窗口ID]' };
      }

      const windowId = args[0];
      return updateWindowProperty(windowId, 'visibility', false);
    }

    case 'reload-html': {
      if (args.length < 2) {
        return { success: false, message: '用法: reload-html [窗口ID] [htmlPath]' };
      }

      const windowId = args[0];
      const htmlPath = args.slice(1).join(' ');

      return reloadWindowHtml(windowId, htmlPath);
    }

    case 'create-picture': {
      if (args.length < 2) {
        return { success: false, message: '用法: create-picture [窗口ID] [图片路径] [缩放模式(可选)]' };
      }

      const pictureId = args[0];
      const imagePath = args[1];
      const fitMode = args[2] || 'fill';

      try {
        createPicture(pictureId, imagePath, fitMode);
        return { success: true, message: `图片窗口 ${pictureId} 已创建` };
      } catch (error) {
        return { success: false, message: `创建失败: ${error.message}` };
      }
    }

    case 'set-picture': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-picture [窗口ID] [图片路径] [缩放模式(可选)]' };
      }

      const windowId = args[0];
      const imagePath = args[1];
      const fitMode = args[2] || null;

      return setPicture(windowId, imagePath, fitMode);
    }

    case 'set-fit-mode': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-fit-mode [窗口ID] [缩放模式]' };
      }

      const windowId = args[0];
      const fitMode = args[1];

      return setFitMode(windowId, fitMode);
    }

    // 镜头系统命令
    case 'create-content': {
      if (args.length < 2) {
        return { success: false, message: '用法: create-content [ID] [类型:text/image] [路径] [模糊度:0-50] [是否模糊:true/false]' };
      }

      const id = args[0];
      const contentType = args[1];
      const contentPath = args[2] || '';
      const blurAmount = args[3] ? parseFloat(args[3]) : 10;
      const blurred = args[4] !== 'false'; // 默认为true

      try {
        const result = createContentWindow(id, {
          contentType,
          contentPath,
          blurAmount,
          blurred
        });
        return result;
      } catch (error) {
        return { success: false, message: `创建失败: ${error.message}` };
      }
    }

    case 'create-lens': {
      if (args.length < 2) {
        return { success: false, message: '用法: create-lens [镜头ID] [目标窗口ID] [宽度] [高度]' };
      }

      const lensId = args[0];
      const targetWindowId = args[1];
      const width = args[2] ? parseInt(args[2]) : 300;
      const height = args[3] ? parseInt(args[3]) : 200;

      try {
        // 获取目标窗口信息以确定内容类型和路径
        const targetInfo = getWindowInfo(targetWindowId);
        if (!targetInfo) {
          return { success: false, message: `目标窗口 ${targetWindowId} 不存在` };
        }

        const result = createLensWindow(lensId, targetWindowId, {
          width,
          height,
          contentType: 'text', // 默认文字类型，后续可扩展
          contentPath: ''
        });
        return result;
      } catch (error) {
        return { success: false, message: `创建失败: ${error.message}` };
      }
    }

    case 'set-opacity': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-opacity [窗口ID] [0-1]' };
      }

      const windowId = args[0];
      const opacity = parseFloat(args[1]);

      return setWindowOpacity(windowId, opacity);
    }

    case 'set-always-on-top': {
      if (args.length < 2) {
        return { success: false, message: '用法: set-always-on-top [窗口ID] [true/false] [level(可选)]' };
      }

      const windowId = args[0];
      const flag = args[1] === 'true';
      const level = args[2] || 'normal';

      return setWindowAlwaysOnTop(windowId, flag, level);
    }

    case 'update-blur': {
      if (args.length < 2) {
        return { success: false, message: '用法: update-blur [窗口ID] [0-50]' };
      }

      const windowId = args[0];
      const blurAmount = parseFloat(args[1]);

      return updateContentBlur(windowId, blurAmount);
    }

    case 'destroy-lens': {
      if (args.length < 1) {
        return { success: false, message: '用法: destroy-lens [镜头ID]' };
      }

      const lensId = args[0];
      return destroyLensSystem(lensId);
    }

    case 'list-lens':
    case 'lens-list': {
      const lensSystems = getLensSystems();

      if (lensSystems.length === 0) {
        return { success: true, message: '当前没有镜头窗口' };
      }

      const message = lensSystems.map(lens =>
        `${lens.lensId} -> ${lens.targetWindowId} (追踪: ${lens.isTracking})`
      ).join('\n');

      return {
        success: true,
        message: `找到 ${lensSystems.length} 个镜头系统:\n${message}`,
        data: lensSystems
      };
    }

    case 'lens-info': {
      if (args.length < 1) {
        return { success: false, message: '用法: lens-info [镜头ID]' };
      }

      const lensId = args[0];
      const lensInfo = getLensSystem(lensId);

      if (!lensInfo) {
        return { success: false, message: `镜头 ${lensId} 不存在` };
      }

      return {
        success: true,
        message: `镜头 ${lensId} 的信息:`,
        data: lensInfo
      };
    }

    // Window storage commands
    case 'save-window': {
      if (args.length < 1) {
        return { success: false, message: '用法: save-window [窗口ID] [文件名(可选)]' };
      }

      const windowId = args[0];
      const customFilename = args[1] || null;

      return saveWindowToFile(windowId, customFilename);
    }

    case 'restore-window': {
      if (args.length < 1) {
        return { success: false, message: '用法: restore-window [文件路径]' };
      }

      const filePath = args.slice(0).join(' '); // Join all args to handle paths with spaces

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
              successMessage += `\n.fenestra文件已自动删除: ${filename}`;
              console.log(`[TERMINAL] .fenestra文件已在窗口恢复后删除: ${filename}`);
            } else {
              successMessage += `\n警告: 无法删除.fenestra文件: ${deleteResult.message}`;
              console.warn(`[TERMINAL] 无法删除.fenestra文件: ${deleteResult.message}`);
            }

            if (restoreResult.warnings && restoreResult.warnings.length > 0) {
              successMessage += `\n警告: ${restoreResult.warnings.join(', ')}`;
            }

            return {
              success: true,
              message: successMessage,
              windowId: restoreResult.windowId
            };
          } catch (deleteError) {
            console.error(`[TERMINAL] 删除.fenestra文件时发生错误:`, deleteError);
            return {
              success: true,
              message: `${restoreResult.message}\n警告: 删除.fenestra文件失败: ${deleteError.message}`,
              windowId: restoreResult.windowId
            };
          }
        }

        return restoreResult;

      } catch (error) {
        return { success: false, message: `恢复失败: ${error.message}` };
      }
    }

    case 'list-saved': {
      const listResult = listStoredWindows();

      if (!listResult.success) {
        return listResult;
      }

      if (listResult.files.length === 0) {
        return { success: true, message: '没有找到已保存的窗口文件' };
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
        message: `找到 ${listResult.files.length} 个已保存的窗口:\n${fileList}`
      };
    }

    case 'delete-saved': {
      if (args.length < 1) {
        return { success: false, message: '用法: delete-saved [文件名]' };
      }

      const filename = args[0];
      return deleteStoredWindow(filename);
    }

    // Directory navigation commands
    case 'cd': {
      const targetPath = args.length > 0 ? args.join(' ') : '';
      
      try {
        const result = changeDirectory(targetPath);
        return result;
      } catch (error) {
        return {
          success: false,
          message: `目录切换失败: ${error.message}`
        };
      }
    }

    case 'pwd': {
      try {
        const result = getWorkingDirectory();
        return result;
      } catch (error) {
        return {
          success: false,
          message: `获取当前目录失败: ${error.message}`
        };
      }
    }

    case 'dir': {
      const showHidden = args.includes('-a') || args.includes('--all');
      const targetPath = args.filter(arg => !arg.startsWith('-')).join(' ') || '';
      
      try {
        const result = listDirectoryContents(targetPath, showHidden);
        return result;
      } catch (error) {
        return {
          success: false,
          message: `列出目录内容失败: ${error.message}`
        };
      }
    }

    case 'config': {
      if (args.length === 0) {
        return { 
          success: false, 
          message: '用法: config [get|set|reset] [参数...]\n' +
                   '  config get - 显示当前配置\n' +
                   '  config get game-data-dir - 显示游戏数据目录\n' +
                   '  config set game-data-dir [路径] - 设置游戏数据目录\n' +
                   '  config reset - 重置配置为默认值'
        };
      }

      const subCommand = args[0];

      switch (subCommand) {
        case 'get': {
          if (args.length === 1) {
            // Show full configuration
            try {
              const { getConfig } = require('./config.js');
              const config = getConfig();
              const configStr = JSON.stringify(config, null, 2);
              return {
                success: true,
                message: `当前配置:\n${configStr}`
              };
            } catch (error) {
              return {
                success: false,
                message: `获取配置失败: ${error.message}`
              };
            }
          } else if (args[1] === 'game-data-dir') {
            // Show game data directory
            try {
              const { getGameDataDirectory } = require('./config.js');
              const gameDataDir = getGameDataDirectory();
              return {
                success: true,
                message: `游戏数据目录: ${gameDataDir}`
              };
            } catch (error) {
              return {
                success: false,
                message: `获取游戏数据目录失败: ${error.message}`
              };
            }
          } else {
            return {
              success: false,
              message: `未知配置项: ${args[1]}\n可用配置项: game-data-dir`
            };
          }
        }

        case 'set': {
          if (args.length < 3) {
            return {
              success: false,
              message: '用法: config set [配置项] [值]\n可用配置项: game-data-dir'
            };
          }

          const configKey = args[1];
          const configValue = args.slice(2).join(' ');

          if (configKey === 'game-data-dir') {
            try {
              const { setGameDataDirectory } = require('./config.js');
              const result = setGameDataDirectory(configValue);
              
              if (result.success) {
                return {
                  success: true,
                  message: `游戏数据目录已设置为: ${result.path}`
                };
              } else {
                return {
                  success: false,
                  message: `设置游戏数据目录失败: ${result.error}`
                };
              }
            } catch (error) {
              return {
                success: false,
                message: `设置游戏数据目录失败: ${error.message}`
              };
            }
          } else {
            return {
              success: false,
              message: `未知配置项: ${configKey}\n可用配置项: game-data-dir`
            };
          }
        }

        case 'reset': {
          try {
            const { resetConfigToDefaults } = require('./config.js');
            const result = resetConfigToDefaults();
            
            if (result.success) {
              return {
                success: true,
                message: '配置已重置为默认值'
              };
            } else {
              return {
                success: false,
                message: `重置配置失败: ${result.error}`
              };
            }
          } catch (error) {
            return {
              success: false,
              message: `重置配置失败: ${error.message}`
            };
          }
        }

        default: {
          return {
            success: false,
            message: `未知子命令: ${subCommand}\n可用子命令: get, set, reset`
          };
        }
      }
    }

    default:
      return {
        success: false,
        message: `未知命令: ${command}\n输入 'help' 查看可用命令`
      };
  }
}

/**
 * 加载图片文件并验证
 * @param {string} imagePath - 图片路径
 * @returns {Object} 加载结果
 */
function loadPictureFile(imagePath) {
  console.debug(`[PICTURE] 验证图片文件: ${imagePath}`);

  try {
    // 解析路径
    let fullPath;
    if (path.isAbsolute(imagePath)) {
      fullPath = imagePath;
    } else {
      // 相对路径，相对于项目根目录
      fullPath = path.join(process.cwd(), imagePath);
    }

    console.debug(`[PICTURE] 完整路径: ${fullPath}`);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.warn(`[PICTURE] 文件不存在: ${fullPath}`);
      return {
        success: false,
        error: `文件不存在: ${imagePath}`
      };
    }

    // 检查是否是文件
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      console.warn(`[PICTURE] 路径不是文件: ${fullPath}`);
      return {
        success: false,
        error: `路径不是文件: ${imagePath}`
      };
    }

    // 检查文件扩展名
    const ext = path.extname(fullPath).toLowerCase();
    const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

    if (!supportedFormats.includes(ext)) {
      console.warn(`[PICTURE] 不支持的图片格式: ${ext}`);
      return {
        success: false,
        error: `不支持的图片格式: ${ext}。支持的格式: ${supportedFormats.join(', ')}`
      };
    }

    // 读取文件并转换为 base64
    try {
      const fileData = fs.readFileSync(fullPath);
      const base64Data = fileData.toString('base64');
      const mimeType = getMimeType(ext);
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log(`[PICTURE] 图片加载成功, 大小: ${stats.size} bytes`);

      return {
        success: true,
        path: fullPath,
        dataUrl: dataUrl,
        size: stats.size,
        format: ext
      };
    } catch (readError) {
      console.error(`[PICTURE] 读取文件失败:`, readError);
      return {
        success: false,
        error: `无法读取文件: ${readError.message}`
      };
    }

  } catch (error) {
    console.error(`[PICTURE] 验证图片失败:`, error);
    return {
      success: false,
      error: `验证失败: ${error.message}`
    };
  }
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param {string} ext - 文件扩展名
 * @returns {string} MIME 类型
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
 * 验证 .fenestra 文件
 * @param {string} filePath - 文件路径
 * @returns {Object} 验证结果
 */
function validateFenestraFile(filePath) {
  console.debug(`[STORAGE] 验证.fenestra文件: ${filePath}`);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, message: '文件不存在' };
    }

    // Check file extension
    if (!filePath.toLowerCase().endsWith('.fenestra')) {
      return { success: false, message: '文件扩展名必须是.fenestra' };
    }

    // Read and parse JSON
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let windowData;

    try {
      windowData = JSON.parse(fileContent);
    } catch (parseError) {
      return { success: false, message: '文件格式无效，不是有效的JSON' };
    }

    // Validate window data structure
    const validationResult = validateWindowData(windowData);

    if (!validationResult.isValid) {
      return { success: false, message: `文件内容无效: ${validationResult.message}` };
    }

    console.log(`[STORAGE] .fenestra文件验证成功: ${filePath}`);
    return {
      success: true,
      message: '文件验证成功',
      data: windowData
    };

  } catch (error) {
    console.error(`[STORAGE] 验证.fenestra文件失败:`, error);
    return {
      success: false,
      message: `验证失败: ${error.message}`
    };
  }
}

/**
 * 获取文件补全建议
 * @param {string} partialPath - 部分路径
 * @param {string} currentDir - 当前工作目录
 * @returns {Object} 补全结果
 */
async function getFileCompletions(partialPath, currentDir) {
  return withErrorHandling(async () => {
    console.debug(`[FILE_COMPLETION] 处理补全请求: "${partialPath}", 当前目录: "${currentDir}"`);

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
    const workingDirValidation = validateAndResolvePath(workingDir, gameDataRoot, gameDataRoot);
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

    console.debug(`[FILE_COMPLETION] 搜索目录: "${searchDir}", 文件模式: "${filePattern}"`);

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
      const dirValidation = validateAndResolvePath(dirname, workingDir, gameDataRoot);
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
        const dirValidation = validateAndResolvePath(dirname, workingDir, gameDataRoot);
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
 * 检查文件名是否需要引号包围
 * @param {string} filename - 文件名
 * @returns {boolean} 是否需要引号
 */
function needsQuoting(filename) {
  // 检查是否包含空格、特殊字符或需要转义的字符
  // Enhanced pattern to handle more shell metacharacters and edge cases
  // Includes: spaces, quotes, backslashes, wildcards, brackets, braces, parentheses,
  // pipes, redirections, semicolons, ampersands, tildes, backticks, dollar signs, hash
  return /[\s'"\\&|<>(){}[\]$`!?*;~#]/.test(filename);
}



/**
 * 获取当前工作目录
 * @returns {Object} 当前目录信息
 */
function getCurrentDirectory() {
  return withErrorHandling(async () => {
    console.debug('[CURRENT_DIR] 获取当前工作目录');

    const currentDir = process.cwd();
    console.debug(`[CURRENT_DIR] 当前工作目录: ${currentDir}`);

    return {
      success: true,
      currentDirectory: currentDir,
      message: '获取成功'
    };
  }, 'getCurrentDirectory', {});
}

/**
 * 更改当前工作目录
 * @param {string} targetPath - 目标目录路径
 * @param {string} currentDir - 当前工作目录（可选）
 * @returns {Object} 目录更改结果
 */
async function changeDirectory(targetPath, currentDir = null) {
  return withErrorHandling(async () => {
    console.debug(`[CHANGE_DIR] 更改目录到: "${targetPath}"`);

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
        message: `已切换到游戏数据根目录: ${navigationResult.newPath}`,
        newDirectory: navigationResult.newPath,
        previousDirectory: workingDir
      });
    }

    // Handle special paths
    if (targetPath === '..') {
      // Go to parent directory
      const { getParentDirectory } = await import('./utils/directoryNavigator.js');
      const parentResult = getParentDirectory(workingDir, gameDataRoot);
      
      if (!parentResult.success) {
        return createErrorResponse(
          ERROR_CODES.INVALID_PATH,
          parentResult.error,
          { targetPath, currentDir: workingDir, gameDataRoot }
        );
      }

      return createSuccessResponse([], '', {
        message: `已切换到上级目录: ${parentResult.parentPath}`,
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
        message: `已切换到游戏数据根目录: ${navigationResult.newPath}`,
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
      let errorMessage = '目录访问被拒绝';
      
      if (doorKeyAccess.isLocked) {
        if (doorKeyAccess.requiredKey) {
          errorMessage = `目录已锁定，需要钥匙: ${doorKeyAccess.requiredKey}`;
        } else {
          errorMessage = doorKeyAccess.lockReason || '目录已锁定';
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

    console.debug(`[CHANGE_DIR] 目录更改成功: ${navigationResult.newPath}`);

    return createSuccessResponse([], '', {
      message: `已切换到目录: ${navigationResult.newPath}`,
      newDirectory: navigationResult.newPath,
      previousDirectory: workingDir
    });
  }, 'changeDirectory', { targetPath, currentDir });
}

/**
 * 列出目录内容
 * @param {string} dirPath - 目录路径（可选，默认为当前目录）
 * @param {boolean} showHidden - 是否显示隐藏文件
 * @returns {Object} 目录内容列表结果
 */
async function listDirectoryContents(dirPath = '', showHidden = false) {
  return withErrorHandling(async () => {
    console.debug(`[LIST_DIR] 列出目录内容: "${dirPath}", 显示隐藏文件: ${showHidden}`);

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
      const pathValidation = validateAndResolvePath(targetDir, currentDir, gameDataRoot);
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
      let errorMessage = '目录访问被拒绝';
      
      if (doorKeyAccess.isLocked) {
        if (doorKeyAccess.requiredKey) {
          errorMessage = `目录已锁定，需要钥匙: ${doorKeyAccess.requiredKey}`;
        } else {
          errorMessage = doorKeyAccess.lockReason || '目录已锁定';
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
    let message = `目录内容: ${targetDir}\n`;
    
    if (accessibleEntries.length === 0) {
      message += '(空目录)';
    } else {
      // Group by type and format
      const directories = accessibleEntries.filter(entry => entry.type === 'directory');
      const files = accessibleEntries.filter(entry => entry.type === 'file');
      
      if (directories.length > 0) {
        message += '\n目录:\n';
        directories.forEach(dir => {
          const displayName = dir.name.replace(/\/$/, ''); // Remove trailing slash for display
          const lockIndicator = dir.isLocked ? ' [锁定]' : '';
          message += `  ${displayName}/${lockIndicator}\n`;
        });
      }
      
      if (files.length > 0) {
        message += '\n文件:\n';
        files.forEach(file => {
          const sizeInfo = file.size ? ` (${Math.round(file.size / 1024)}KB)` : '';
          message += `  ${file.name}${sizeInfo}\n`;
        });
      }
      
      message += `\n总计: ${directories.length} 个目录, ${files.length} 个文件`;
    }

    console.debug(`[LIST_DIR] 找到 ${accessibleEntries.length} 个可访问条目`);

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
 * 获取当前工作目录（用于终端显示）
 * @returns {Object} 工作目录信息
 */
async function getWorkingDirectory() {
  return withErrorHandling(async () => {
    console.debug('[GET_WORKING_DIR] 获取工作目录');

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
    let message = `当前工作目录: ${workingDirectory}`;
    
    if (isWithinScope) {
      // Show relative path from game data root for better readability
      const relativePath = path.relative(gameDataRoot, workingDirectory);
      if (relativePath) {
        displayPath = `./${relativePath}`;
        if (shouldUseFenestraStorage) {
          message = `当前工作目录: ${displayPath} (Fenestra存储目录)`;
        } else {
          message = `当前工作目录: ${displayPath} (${workingDirectory})`;
        }
      } else {
        displayPath = './';
        message = `当前工作目录: ${displayPath} (游戏数据根目录)`;
      }
    } else {
      message += ' [警告: 不在游戏数据范围内]';
    }

    console.debug(`[GET_WORKING_DIR] 工作目录: ${workingDirectory}`);

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
 * 清理 IPC 处理程序
 */
export function cleanupIpcHandlers() {
  // 移除所有 IPC 处理程序
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

  console.debug('[IPC] IPC处理程序已清理');
}

