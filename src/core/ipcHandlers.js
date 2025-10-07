import { ipcMain } from 'electron';
import { 
  createWindow, 
  setBounds, 
  getBounds, 
  getWindowsInfo, 
  getWindowInfo,
  updateWindowProperty,
  reloadWindowHtml,
  createPicture,
  setPicture,
  setFitMode
} from './windowManager.js';
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
        data: windows 
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
 * 清理 IPC 处理程序
 */
export function cleanupIpcHandlers() {
  // 移除所有 IPC 处理程序
  ipcMain.removeAllListeners('game/window/create');
  ipcMain.removeAllListeners('game/window/set-bounds');
  ipcMain.removeAllListeners('game/window/get-bounds');
  ipcMain.removeAllListeners('terminal/execute-command');
  ipcMain.removeAllListeners('picture/load');
  
  console.debug('[IPC] IPC处理程序已清理');
}

