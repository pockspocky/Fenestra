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
  ipcMain.handle('terminal/get-file-completions', (_e, { partialPath, currentDir }) => {
    console.debug(`[IPC] 获取文件补全: ${partialPath}, 当前目录: ${currentDir}`);
    
    try {
      return getFileCompletions(partialPath, currentDir);
    } catch (error) {
      console.error('[IPC] 文件补全错误:', error);
      return { success: false, message: error.message, completions: [] };
    }
  });

  ipcMain.handle('terminal/get-current-directory', (_e) => {
    console.debug('[IPC] 获取当前工作目录');
    
    try {
      return getCurrentDirectory();
    } catch (error) {
      console.error('[IPC] 获取当前目录错误:', error);
      return { success: false, message: error.message };
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
        
        if (restoreResult.success && restoreResult.warnings && restoreResult.warnings.length > 0) {
          // Include warnings in the success message
          return {
            success: true,
            message: `${restoreResult.message}\n警告: ${restoreResult.warnings.join(', ')}`,
            windowId: restoreResult.windowId
          };
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
        return `${file.filename} (${sizeKB}KB, ${date} ${time})`;
      }).join('\n');
      
      return {
        success: true,
        message: `找到 ${listResult.files.length} 个已保存的窗口:\n${fileList}`,
        data: listResult.files
      };
    }
    
    case 'delete-saved': {
      if (args.length < 1) {
        return { success: false, message: '用法: delete-saved [文件名]' };
      }
      
      const filename = args[0];
      return deleteStoredWindow(filename);
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
    
    if (!validationResult.success) {
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
function getFileCompletions(partialPath, currentDir) {
  console.debug(`[FILE_COMPLETION] 处理补全请求: "${partialPath}", 当前目录: "${currentDir}"`);
  
  try {
    // 如果没有提供当前目录，使用进程工作目录
    const workingDir = currentDir || process.cwd();
    
    // 处理空输入
    if (!partialPath || partialPath.trim() === '') {
      return getDirectoryContents(workingDir);
    }
    
    // 确定搜索目录和文件名模式
    let searchDir, filePattern;
    
    if (path.isAbsolute(partialPath)) {
      // 绝对路径
      const dirname = path.dirname(partialPath);
      const basename = path.basename(partialPath);
      
      searchDir = dirname;
      filePattern = basename;
    } else {
      // 相对路径
      const dirname = path.dirname(partialPath);
      const basename = path.basename(partialPath);
      
      if (dirname === '.') {
        searchDir = workingDir;
      } else {
        searchDir = path.resolve(workingDir, dirname);
      }
      filePattern = basename;
    }
    
    console.debug(`[FILE_COMPLETION] 搜索目录: "${searchDir}", 文件模式: "${filePattern}"`);
    
    // 检查搜索目录是否存在
    if (!fs.existsSync(searchDir)) {
      console.debug(`[FILE_COMPLETION] 搜索目录不存在: ${searchDir}`);
      return {
        success: true,
        completions: [],
        commonPrefix: '',
        message: '目录不存在'
      };
    }
    
    // 检查目录访问权限
    try {
      fs.accessSync(searchDir, fs.constants.R_OK);
    } catch (accessError) {
      console.debug(`[FILE_COMPLETION] 目录访问权限不足: ${searchDir}`);
      return {
        success: true,
        completions: [],
        commonPrefix: '',
        message: '权限不足'
      };
    }
    
    // 读取目录内容
    const entries = fs.readdirSync(searchDir, { withFileTypes: true });
    
    // 过滤匹配的条目
    const matchingEntries = entries.filter(entry => {
      // 跳过隐藏文件（除非用户明确输入了点开头）
      if (entry.name.startsWith('.') && !filePattern.startsWith('.')) {
        return false;
      }
      
      // 检查是否匹配模式
      return entry.name.toLowerCase().startsWith(filePattern.toLowerCase());
    });
    
    // 转换为补全格式
    const completions = matchingEntries.map(entry => {
      const fullPath = path.join(searchDir, entry.name);
      const relativePath = path.relative(workingDir, fullPath);
      
      return {
        name: entry.isDirectory() ? `${entry.name}/` : entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: relativePath || entry.name
      };
    });
    
    // 计算公共前缀
    const commonPrefix = findCommonPrefix(completions.map(c => c.name));
    
    console.debug(`[FILE_COMPLETION] 找到 ${completions.length} 个匹配项`);
    
    return {
      success: true,
      completions: completions.slice(0, 50), // 限制返回数量
      commonPrefix,
      message: completions.length > 50 ? `显示前50个结果，共${completions.length}个匹配项` : ''
    };
    
  } catch (error) {
    console.error(`[FILE_COMPLETION] 补全处理失败:`, error);
    return {
      success: false,
      message: `补全失败: ${error.message}`,
      completions: []
    };
  }
}

/**
 * 获取目录内容
 * @param {string} dirPath - 目录路径
 * @returns {Object} 目录内容
 */
function getDirectoryContents(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const completions = entries
      .filter(entry => !entry.name.startsWith('.')) // 跳过隐藏文件
      .map(entry => ({
        name: entry.isDirectory() ? `${entry.name}/` : entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: entry.name
      }))
      .slice(0, 50); // 限制数量
    
    return {
      success: true,
      completions,
      commonPrefix: '',
      message: completions.length === 50 ? '显示前50个文件' : ''
    };
  } catch (error) {
    return {
      success: false,
      message: `读取目录失败: ${error.message}`,
      completions: []
    };
  }
}

/**
 * 查找字符串数组的公共前缀
 * @param {string[]} strings - 字符串数组
 * @returns {string} 公共前缀
 */
function findCommonPrefix(strings) {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];
  
  let prefix = '';
  const firstString = strings[0];
  
  for (let i = 0; i < firstString.length; i++) {
    const char = firstString[i];
    
    if (strings.every(str => str[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }
  
  return prefix;
}

/**
 * 获取当前工作目录
 * @returns {Object} 当前目录信息
 */
function getCurrentDirectory() {
  console.debug('[CURRENT_DIR] 获取当前工作目录');
  
  try {
    const currentDir = process.cwd();
    
    console.debug(`[CURRENT_DIR] 当前工作目录: ${currentDir}`);
    
    return {
      success: true,
      currentDirectory: currentDir,
      message: '获取成功'
    };
  } catch (error) {
    console.error(`[CURRENT_DIR] 获取当前目录失败:`, error);
    return {
      success: false,
      message: `获取失败: ${error.message}`
    };
  }
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
  
  console.debug('[IPC] IPC处理程序已清理');
}

