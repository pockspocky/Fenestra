import { BrowserWindow } from 'electron';
import path from 'node:path';
import url from 'node:url';
import '../../logger.js'; // 导入日志系统
import {
  registerLensSystem,
  unregisterLensSystem,
  getLensSystemInfo,
  getAllLensSystems,
  getLensSystemCount,
  lensSystemExists
} from './lensSystem.js';

// 全局窗口映射
export const windows = new Map(); // id -> BrowserWindow

// 窗口偏移配置
const WINDOW_OFFSET = {
  x: 30, // 水平偏移
  y: 30  // 垂直偏移
};

// 计算两个矩形的重叠比例
function calculateOverlapRatio(rect1, rect2) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  const interWidth = Math.max(0, x2 - x1);
  const interHeight = Math.max(0, y2 - y1);
  const interArea = interWidth * interHeight;
  
  if (interArea <= 0) {
    return 0;
  }
  
  const rect1Area = rect1.width * rect1.height;
  const rect2Area = rect2.width * rect2.height;
  const minArea = Math.min(rect1Area, rect2Area);
  
  return interArea / minArea;
}

// 检查位置是否与现有窗口重叠过多
function checkOverlapWithWindows(newBounds, windowId, maxOverlapRatio = 0.4) {
  for (const [id, win] of windows) {
    if (id === windowId) continue; // 跳过自己
    
    const existingBounds = win.getBounds();
    const overlapRatio = calculateOverlapRatio(newBounds, existingBounds);
    
    console.debug(`[OVERLAP_CHECK] 检查与窗口 ${id} 的重叠: ${(overlapRatio * 100).toFixed(1)}%`);
    
    if (overlapRatio > maxOverlapRatio) {
      return { hasOverlap: true, overlapWindow: id, ratio: overlapRatio };
    }
  }
  
  return { hasOverlap: false };
}

// 为钥匙窗口寻找合适的位置（避免与门重叠超过40%）
function findSuitablePositionForKey(keyId, width, height, maxOverlapRatio = 0.4) {
  console.debug(`[KEY_POSITION] 为钥匙 ${keyId} 寻找合适位置，避免与门重叠超过 ${(maxOverlapRatio * 100)}%`);
  
  // 获取所有门窗口
  const doorWindows = Array.from(windows.entries()).filter(([id, win]) => id.startsWith('door'));
  
  if (doorWindows.length === 0) {
    // 没有门窗口，使用默认偏移逻辑
    return getNextWindowPosition();
  }
  
  // 尝试多个位置
  const screenWidth = 1920; // 假设屏幕宽度
  const screenHeight = 1080; // 假设屏幕高度
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x, y;
    
    if (attempt < 10) {
      // 前10次尝试：在屏幕左上角区域
      x = 100 + (attempt % 5) * 250;
      y = 100 + Math.floor(attempt / 5) * 150;
    } else if (attempt < 20) {
      // 接下来10次尝试：在屏幕右上角区域
      x = screenWidth - width - 100 - (attempt % 10) * 50;
      y = 100 + Math.floor(attempt / 10) * 150;
    } else if (attempt < 30) {
      // 接下来10次尝试：在屏幕左下角区域
      x = 100 + (attempt % 10) * 100;
      y = screenHeight - height - 100 - Math.floor(attempt / 10) * 100;
    } else {
      // 最后20次尝试：随机位置
      x = 100 + Math.random() * (screenWidth - width - 200);
      y = 100 + Math.random() * (screenHeight - height - 200);
    }
    
    const newBounds = { x, y, width, height };
    const overlapCheck = checkOverlapWithWindows(newBounds, keyId, maxOverlapRatio);
    
    if (!overlapCheck.hasOverlap) {
      console.debug(`[KEY_POSITION] 找到合适位置: (${x}, ${y}), 尝试次数: ${attempt + 1}`);
      return { x, y };
    }
    
    console.debug(`[KEY_POSITION] 位置 (${x}, ${y}) 与窗口 ${overlapCheck.overlapWindow} 重叠 ${(overlapCheck.ratio * 100).toFixed(1)}%，继续尝试...`);
  }
  
  // 如果找不到合适位置，使用默认偏移逻辑
  console.warn(`[KEY_POSITION] 无法为钥匙 ${keyId} 找到合适位置，使用默认偏移逻辑`);
  return getNextWindowPosition();
}

// 获取下一个窗口位置
function getNextWindowPosition(defaultX, defaultY) {
  // 如果没有指定位置，使用默认位置
  if (defaultX !== undefined && defaultY !== undefined) {
    return { x: defaultX, y: defaultY };
  }
  
  // 获取最后一个窗口的位置
  const windowEntries = Array.from(windows.entries());
  if (windowEntries.length === 0) {
    // 如果没有窗口，使用默认位置
    return { x: 100, y: 100 };
  }
  
  // 获取最后一个窗口的边界
  const lastWindow = windowEntries[windowEntries.length - 1][1];
  const lastBounds = lastWindow.getBounds();
  
  // 计算新位置（加上偏移）
  const newX = lastBounds.x + WINDOW_OFFSET.x;
  const newY = lastBounds.y + WINDOW_OFFSET.y;
  
  console.debug(`[WINDOW_OFFSET] 计算新窗口位置: (${newX}, ${newY}), 基于窗口: ${windowEntries[windowEntries.length - 1][0]}`);
  
  return { x: newX, y: newY };
}

/**
 * 创建窗口
 * @param {string} id - 窗口ID
 * @param {Object} opts - 窗口选项
 * @returns {BrowserWindow} 创建的窗口
 */
export function createWindow(id, opts = {}) {
  console.debug(`[WINDOW] 开始创建窗口 ID: ${id}`);
  
  // 获取窗口位置（支持自动偏移）
  const position = getNextWindowPosition(opts.x, opts.y);
  
  console.debug(`[WINDOW] 窗口配置:`, { 
    width: opts.width ?? 800, 
    height: opts.height ?? 500, 
    x: position.x, 
    y: position.y, 
    title: opts.title ?? id,
    resizable: opts.resizable ?? true,
    transparent: opts.transparent ?? false,
    otherContents: opts.otherContents ?? "index.html",
  });
  
  const win = new BrowserWindow({
    width: opts.width ?? 800,
    height: opts.height ?? 500,
    x: position.x,
    y: position.y,
    title: opts.title ?? id,
    show: true,
    frame: true,
    transparent: opts.transparent ?? false,
    resizable: opts.resizable ?? true,
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  
  console.debug(`[WINDOW] BrowserWindow已创建，ID: ${id}, webContentsId: ${win.webContents.id}`);
  
  // 解析 otherContents 中的文件名和查询参数
  const otherContents = opts.otherContents ?? "index.html";
  const htmlName = opts.htmlName;
  let htmlFileName;
  let queryObj = { id };
  
  // 判断 otherContents 的类型
  if (typeof otherContents === 'string') {
    // 字符串格式：可能是 "file.html" 或 "file.html?param=value"
    if (otherContents.includes('?')) {
      const parts = otherContents.split('?');
      htmlFileName = parts[0];
      const additionalQuery = parts[1];
      
      // 合并查询参数
      const additionalParams = new url.URLSearchParams(additionalQuery);
      for (const [key, value] of additionalParams) {
        queryObj[key] = value;
      }
    } else {
      htmlFileName = otherContents;
    }
  } else if (typeof otherContents === 'object' && otherContents !== null) {
    // 对象格式：直接作为查询参数
    htmlFileName = htmlName || 'index.html';
    queryObj = { id, ...otherContents };
  } else {
    // 默认
    htmlFileName = 'index.html';
  }
  
  const htmlPath = path.join(process.cwd(), 'renderer', htmlFileName);
  console.debug(`[WINDOW] 加载HTML文件: ${htmlPath}`);
  console.debug(`[WINDOW] 查询参数对象:`, queryObj);
  win.loadFile(htmlPath, { query: queryObj });
  
  // 设置窗口事件监听器
  setupWindowEvents(win, id);
  
  windows.set(id, win);
  console.debug(`[WINDOW] 窗口已添加到映射, ID: ${id}, 总窗口数: ${windows.size}`);
  
  return win;
}

/**
 * 设置窗口事件监听器
 * @param {BrowserWindow} win - 窗口对象
 * @param {string} id - 窗口ID
 */
function setupWindowEvents(win, id) {
  win.on('closed', () => {
    console.debug(`[WINDOW] 窗口关闭事件触发, ID: ${id}`);
    windows.delete(id);
    console.log(`[WINDOW] 从窗口映射中移除 ID: ${id}, 剩余窗口数量: ${windows.size}`);
    
    // 触发窗口关闭回调
    if (windowCloseCallback) {
      windowCloseCallback(id);
    }
  });
  
  win.on('ready-to-show', () => {
    console.debug(`[WINDOW] 窗口准备显示, ID: ${id}`);
  });
  
  win.on('moved', () => {
    const bounds = win.getBounds();
    console.debug(`[WINDOW] 窗口移动, ID: ${id}, 新位置: (${bounds.x}, ${bounds.y})`);
  });
  
  win.on('resized', () => {
    const bounds = win.getBounds();
    console.debug(`[WINDOW] 窗口调整大小, ID: ${id}, 新尺寸: ${bounds.width}x${bounds.height}`);
  });
}

// 窗口关闭回调
let windowCloseCallback = null;

/**
 * 设置窗口关闭回调
 * @param {Function} callback - 回调函数
 */
export function setWindowCloseCallback(callback) {
  windowCloseCallback = callback;
}

/**
 * 设置窗口偏移量
 * @param {number} x - 水平偏移
 * @param {number} y - 垂直偏移
 */
export function setWindowOffset(x, y) {
  WINDOW_OFFSET.x = x;
  WINDOW_OFFSET.y = y;
  console.debug(`[WINDOW_OFFSET] 窗口偏移量设置为: (${x}, ${y})`);
}

/**
 * 获取当前窗口偏移量
 * @returns {Object} 偏移量配置
 */
export function getWindowOffset() {
  return { ...WINDOW_OFFSET };
}

// 钥匙与门重叠的最大允许比例
let keyDoorMaxOverlap = 0.4; // 40%

/**
 * 设置钥匙与门重叠的最大允许比例
 * @param {number} ratio - 重叠比例 (0.0 - 1.0)
 */
export function setKeyDoorMaxOverlap(ratio) {
  if (ratio < 0 || ratio > 1) {
    console.warn('[OVERLAP_CONFIG] 重叠比例必须在 0.0 到 1.0 之间');
    return;
  }
  keyDoorMaxOverlap = ratio;
  console.debug(`[OVERLAP_CONFIG] 钥匙与门最大重叠比例设置为: ${(ratio * 100).toFixed(1)}%`);
}

/**
 * 获取钥匙与门重叠的最大允许比例
 * @returns {number} 重叠比例
 */
export function getKeyDoorMaxOverlap() {
  return keyDoorMaxOverlap;
}

/**
 * 获取窗口边界
 * @param {string} id - 窗口ID
 * @returns {Object|null} 窗口边界或null
 */
export function getBounds(id) {
  console.debug(`[BOUNDS] 获取窗口边界, ID: ${id}`);
  const w = windows.get(id);
  if (w) {
    const bounds = w.getBounds();
    console.debug(`[BOUNDS] 获取成功, ID: ${id}, 边界:`, bounds);
    return bounds;
  } else {
    console.debug(`[BOUNDS] 获取失败, 窗口不存在, ID: ${id}`);
    return null;
  }
}

/**
 * 设置窗口边界
 * @param {string} id - 窗口ID
 * @param {Object} b - 边界对象
 */
export function setBounds(id, b) {
  console.debug(`[BOUNDS] 设置窗口边界, ID: ${id}, 新边界:`, b);
  const w = windows.get(id);
  if (w) {
    w.setBounds(b);
    console.debug(`[BOUNDS] 设置成功, ID: ${id}`);
  } else {
    console.debug(`[BOUNDS] 设置失败, 窗口不存在, ID: ${id}`);
  }
}

/**
 * 创建桌面窗口
 * @returns {BrowserWindow} 桌面窗口
 */
export function createDesktop() {
  console.debug('[WINDOW] 创建桌面窗口');
  const win = createWindow('desktop', { width: 1200, height: 800, title: 'Desktop' });
  console.debug('[WINDOW] 桌面窗口创建完成');
  return win;
}

/**
 * 创建视频窗口
 * @returns {BrowserWindow} 视频窗口
 */
export function createVideo() {
  console.debug('[WINDOW] 创建视频窗口');
  const win = createWindow('video', { width: 640, height: 360, x: 100, y: 120, title: 'Training Video' });
  console.debug('[WINDOW] 视频窗口创建完成');
  return win;
}

/**
 * 创建门窗口
 * @param {string} doorId - 门ID
 * @param {string} title - 门标题
 * @param {boolean} encrypt - 是否加密
 * @returns {BrowserWindow} 门窗口
 */
export function createDoor(doorId = 'door', title = null, encrypt = false) {
  const doorTitle = title || (encrypt ? `Door (encrypted)` : `Door (unlocked)`);
  console.log(`[WINDOW] 创建门窗口（${encrypt ? '加密' : '普通'}状态）`);
  
  // 使用自动偏移，不指定固定位置
  // 使用 pictureViewer.html 并传递默认门图片路径
  const win = createWindow(doorId, { 
    width: 220, 
    height: 320, 
    title: doorTitle,
    resizable: true,
    otherContents: "pictureViewer.html?imagePath=doors/Door.png&fitMode=fill",
  });
  
  console.log('[WINDOW] 门窗口创建完成 ' + win.getContentSize());
  return win;
}

/**
 * 创建图片窗口
 * @param {string} pictureId - 图片窗口ID
 * @param {string} imagePath - 图片路径（支持绝对路径和相对路径）
 * @param {string} fitMode - 缩放模式 (fill/contain/cover/scale-down/none)
 * @param {string} title - 窗口标题
 * @param {number} width - 窗口宽度
 * @param {number} height - 窗口高度
 * @returns {BrowserWindow} 图片窗口
 */
export function createPicture(pictureId = 'picture', imagePath = 'doors/Door.png', fitMode = 'fill', title = null, width = 400, height = 300) {
  const pictureTitle = title || `Picture: ${path.basename(imagePath)}`;
  console.log(`[WINDOW] 创建图片窗口, ID: ${pictureId}, 路径: ${imagePath}, 缩放模式: ${fitMode}`);
  
  // 验证 fitMode
  const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
  const actualFitMode = validFitModes.includes(fitMode) ? fitMode : 'fill';
  
  if (fitMode !== actualFitMode) {
    console.warn(`[WINDOW] 无效的缩放模式 ${fitMode}，使用默认值: fill`);
  }
  
  // 编码路径参数
  const encodedPath = encodeURIComponent(imagePath);
  const queryString = `imagePath=${encodedPath}&fitMode=${actualFitMode}`;
  
  const win = createWindow(pictureId, { 
    width, 
    height, 
    title: pictureTitle,
    resizable: true,
    otherContents: `pictureViewer.html?${queryString}`,
  });
  
  console.log('[WINDOW] 图片窗口创建完成');
  return win;
}

/**
 * 更改窗口显示的图片
 * @param {string} windowId - 窗口ID
 * @param {string} imagePath - 新的图片路径
 * @param {string} fitMode - 缩放模式（可选）
 * @returns {Object} 操作结果
 */
export function setPicture(windowId, imagePath, fitMode = null) {
  console.debug(`[WINDOW] 更改窗口图片, ID: ${windowId}, 路径: ${imagePath}`);
  
  const win = windows.get(windowId);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${windowId} 不存在` };
  }
  
  try {
    // 向窗口发送图片更改事件
    win.webContents.send('picture-change', imagePath, fitMode);
    console.log(`[WINDOW] 窗口 ${windowId} 图片已更新为: ${imagePath}`);
    return { success: true, message: `窗口 ${windowId} 图片已更新` };
  } catch (error) {
    console.error(`[WINDOW] 更改图片失败:`, error);
    return { success: false, message: `更新失败: ${error.message}` };
  }
}

/**
 * 更改窗口的缩放模式
 * @param {string} windowId - 窗口ID
 * @param {string} fitMode - 缩放模式
 * @returns {Object} 操作结果
 */
export function setFitMode(windowId, fitMode) {
  console.debug(`[WINDOW] 更改窗口缩放模式, ID: ${windowId}, 模式: ${fitMode}`);
  
  const win = windows.get(windowId);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${windowId} 不存在` };
  }
  
  const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
  if (!validFitModes.includes(fitMode)) {
    return { success: false, message: `无效的缩放模式: ${fitMode}。支持的模式: ${validFitModes.join(', ')}` };
  }
  
  try {
    // 向窗口发送缩放模式更改事件
    win.webContents.send('fit-mode-change', fitMode);
    console.log(`[WINDOW] 窗口 ${windowId} 缩放模式已更新为: ${fitMode}`);
    return { success: true, message: `窗口 ${windowId} 缩放模式已更新` };
  } catch (error) {
    console.error(`[WINDOW] 更改缩放模式失败:`, error);
    return { success: false, message: `更新失败: ${error.message}` };
  }
}

/**
 * 创建钥匙窗口
 * @param {string} keyId - 钥匙ID
 * @param {string} title - 钥匙标题
 * @param {boolean} encrypt - 是否加密
 * @param {Array} relatedDoors - 关联的门ID数组
 * @param {boolean} resizable - 是否可调整大小
 * @param {string} otherContents - 其他内容
 * @returns {BrowserWindow} 钥匙窗口
 */
export function createKey(keyId = 'key', title = null, encrypt = false, relatedDoors = []) {
  const keyTitle = title || (encrypt ? `Key (encrypted)` : `Key (master)`);
  console.log(`[WINDOW] 创建钥匙窗口（${encrypt ? '加密' : '普通'}）`);
  
  // 为钥匙寻找合适的位置，避免与门重叠超过配置的阈值
  const keyWidth = 200;
  const keyHeight = 200;

  const suitablePosition = findSuitablePositionForKey(keyId, keyWidth, keyHeight, keyDoorMaxOverlap);
  
  const win = createWindow(keyId, { 
    width: keyWidth, 
    height: keyHeight, 
    x: suitablePosition.x,
    y: suitablePosition.y,
    title: keyTitle 
  });
  
  console.log('[WINDOW] 钥匙窗口创建完成');
  return win;
}

/**
 * 获取所有窗口
 * @returns {Map} 窗口映射
 */
export function getAllWindows() {
  return windows;
}

/**
 * 获取指定窗口
 * @param {string} id - 窗口ID
 * @returns {BrowserWindow|null} 窗口对象或null
 */
export function getWindow(id) {
  return windows.get(id);
}

/**
 * 创建终端窗口
 * @returns {BrowserWindow} 终端窗口
 */
export function createTerminal() {
  console.debug('[WINDOW] 创建终端窗口');
  
  // 如果终端已存在，聚焦并返回
  const existingTerminal = windows.get('terminal');
  if (existingTerminal && !existingTerminal.isDestroyed()) {
    existingTerminal.show();
    existingTerminal.focus();
    console.debug('[WINDOW] 终端窗口已存在，聚焦显示');
    return existingTerminal;
  }
  
  // 计算3:2比例的窗口大小
  const width = 900;
  const height = 600;
  
  const win = createWindow('terminal', { 
    width, 
    height, 
    title: 'Fenestra Terminal',
    resizable: true,
    otherContents: "terminal.html",
  });
  
  console.log('[WINDOW] 终端窗口创建完成');
  return win;
}

/**
 * 获取所有窗口的详细信息
 * @returns {Array} 窗口信息数组
 */
export function getWindowsInfo() {
  console.debug('[WINDOW] 获取所有窗口信息');
  
  const windowsInfo = [];
  
  for (const [id, win] of windows) {
    if (win.isDestroyed()) {
      console.warn(`[WINDOW] 窗口 ${id} 已销毁，跳过`);
      continue;
    }
    
    const bounds = win.getBounds();
    const title = win.getTitle();
    
    windowsInfo.push({
      id,
      title,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      resizable: win.isResizable(),
      visible: win.isVisible(),
      minimized: win.isMinimized(),
      maximized: win.isMaximized(),
      focused: win.isFocused(),
    });
  }
  
  console.debug(`[WINDOW] 返回 ${windowsInfo.length} 个窗口的信息`);
  return windowsInfo;
}

/**
 * 获取单个窗口的详细信息
 * @param {string} id - 窗口ID
 * @returns {Object|null} 窗口信息或null
 */
export function getWindowInfo(id) {
  console.debug(`[WINDOW] 获取窗口信息, ID: ${id}`);
  
  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    console.warn(`[WINDOW] 窗口 ${id} 不存在或已销毁`);
    return null;
  }
  
  const bounds = win.getBounds();
  const title = win.getTitle();
  
  return {
    id,
    title,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    resizable: win.isResizable(),
    visible: win.isVisible(),
    minimized: win.isMinimized(),
    maximized: win.isMaximized(),
    focused: win.isFocused(),
  };
}

/**
 * 获取窗口标题
 * @param {string} id - 窗口ID
 * @returns {string|null} 窗口标题或null
 */
export function getWindowTitle(id) {
  console.debug(`[WINDOW] 获取窗口标题, ID: ${id}`);
  
  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    console.warn(`[WINDOW] 窗口 ${id} 不存在或已销毁`);
    return null;
  }
  
  const title = win.getTitle();
  console.debug(`[WINDOW] 窗口 ${id} 的标题: ${title}`);
  return title;
}

/**
 * 更新窗口属性
 * @param {string} id - 窗口ID
 * @param {string} property - 属性名
 * @param {any} value - 属性值
 * @returns {Object} 操作结果
 */
export function updateWindowProperty(id, property, value) {
  console.debug(`[WINDOW] 更新窗口属性, ID: ${id}, 属性: ${property}, 值: ${value}`);
  
  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${id} 不存在` };
  }
  
  try {
    switch (property) {
      case 'title':
        win.setTitle(value);
        console.log(`[WINDOW] 窗口 ${id} 标题已更新为: ${value}`);
        return { success: true, message: `窗口 ${id} 标题已更新` };
        
      case 'size':
        if (!Array.isArray(value) || value.length !== 2) {
          return { success: false, message: '大小值必须是 [宽度, 高度]' };
        }
        const [width, height] = value;
        if (width <= 0 || height <= 0) {
          return { success: false, message: '宽度和高度必须大于0' };
        }
        win.setSize(width, height);
        console.log(`[WINDOW] 窗口 ${id} 大小已更新为: ${width}x${height}`);
        return { success: true, message: `窗口 ${id} 大小已更新` };
        
      case 'position':
        if (!Array.isArray(value) || value.length !== 2) {
          return { success: false, message: '位置值必须是 [x, y]' };
        }
        const [x, y] = value;
        win.setPosition(x, y);
        console.log(`[WINDOW] 窗口 ${id} 位置已更新为: (${x}, ${y})`);
        return { success: true, message: `窗口 ${id} 位置已更新` };
        
      case 'resizable':
        if (typeof value !== 'boolean') {
          return { success: false, message: 'resizable 必须是 true 或 false' };
        }
        win.setResizable(value);
        console.log(`[WINDOW] 窗口 ${id} resizable 已更新为: ${value}`);
        return { success: true, message: `窗口 ${id} resizable 已更新` };
        
      case 'visible':
      case 'visibility':
        if (typeof value !== 'boolean') {
          return { success: false, message: 'visibility 必须是 true 或 false' };
        }
        if (value) {
          win.show();
          console.log(`[WINDOW] 窗口 ${id} 已显示`);
          return { success: true, message: `窗口 ${id} 已显示` };
        } else {
          win.hide();
          console.log(`[WINDOW] 窗口 ${id} 已隐藏`);
          return { success: true, message: `窗口 ${id} 已隐藏` };
        }
        
      default:
        return { success: false, message: `不支持的属性: ${property}` };
    }
  } catch (error) {
    console.error(`[WINDOW] 更新窗口属性失败:`, error);
    return { success: false, message: `更新失败: ${error.message}` };
  }
}

/**
 * 重新加载窗口HTML
 * @param {string} id - 窗口ID
 * @param {string} htmlPath - HTML文件路径
 * @returns {Object} 操作结果
 */
export function reloadWindowHtml(id, htmlPath) {
  console.debug(`[WINDOW] 重新加载窗口HTML, ID: ${id}, 路径: ${htmlPath}`);
  
  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${id} 不存在` };
  }
  
  try {
    const q = new url.URLSearchParams({ id });
    
    // 检查是否是完整路径
    let fullPath;
    if (path.isAbsolute(htmlPath)) {
      fullPath = htmlPath;
    } else {
      // 相对路径，假设在 renderer 目录下
      fullPath = path.join(process.cwd(), 'renderer', htmlPath);
    }
    
    console.debug(`[WINDOW] 加载HTML文件: ${fullPath}?${q.toString()}`);
    win.loadFile(fullPath, { query: q.toString() });
    
    console.log(`[WINDOW] 窗口 ${id} HTML已重新加载: ${htmlPath}`);
    return { success: true, message: `窗口 ${id} HTML已重新加载` };
  } catch (error) {
    console.error(`[WINDOW] 重新加载HTML失败:`, error);
    return { success: false, message: `加载失败: ${error.message}` };
  }
}

/**
 * 创建内容窗口（底层模糊窗口）
 * @param {string} id - 窗口ID
 * @param {Object} options - 配置选项
 * @returns {Object} 操作结果
 */
export function createContentWindow(id, options = {}) {
  console.log(`[WINDOW] 创建内容窗口, ID: ${id}`);

  const {
    contentType = 'text',       // 'text' 或 'image'
    contentPath = '',            // 内容路径
    blurAmount = 10,             // 模糊程度 (0-50)
    blurred = true,              // 是否初始模糊
    width = 800,
    height = 600,
    x,
    y,
    title = '内容窗口'
  } = options;

  // 构建URL参数
  const queryObj = {
    id,
    type: contentType,
    path: contentPath,
    blur: blurAmount.toString(),
    blurred: blurred.toString()
  };

  // 确定窗口位置
  const position = (x !== undefined && y !== undefined) 
    ? { x, y }
    : getNextWindowPosition();

  const windowOptions = {
    width,
    height,
    x: position.x,
    y: position.y,
    title,
    htmlName: 'contentViewer.html',
    otherContents: queryObj,
    resizable: true,
    frame: true,
    transparent: false,
  };

  const win = createWindow(id, windowOptions);
  
  if (win && !win.isDestroyed()) {
    console.log(`[WINDOW] 内容窗口创建成功: ${id}, 类型: ${contentType}, 模糊: ${blurred}`);
    return { success: true, message: `内容窗口 ${id} 创建成功`, id };
  }

  return { success: false, message: '创建内容窗口失败' };
}

/**
 * 创建镜头窗口
 * @param {string} lensId - 镜头窗口ID
 * @param {string} targetWindowId - 目标窗口ID
 * @param {Object} options - 配置选项
 * @returns {Object} 操作结果
 */
export function createLensWindow(lensId, targetWindowId, options = {}) {
  console.log(`[WINDOW] 创建镜头窗口, 镜头ID: ${lensId}, 目标ID: ${targetWindowId}`);

  // 检查镜头数量限制
  const currentLensCount = getLensSystemCount();
  if (currentLensCount >= 3) {
    return { 
      success: false, 
      message: '已达到最大镜头数量限制（3个）' 
    };
  }

  // 检查镜头ID是否已存在
  if (lensSystemExists(lensId)) {
    return {
      success: false,
      message: `镜头 ${lensId} 已存在`
    };
  }

  // 检查目标窗口是否存在
  const targetWindow = windows.get(targetWindowId);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return {
      success: false,
      message: `目标窗口 ${targetWindowId} 不存在`
    };
  }

  const {
    contentType = 'text',
    contentPath = '',
    width = 300,
    height = 200,
    x,
    y
  } = options;

  // 从目标窗口获取实际的内容信息
  let actualContentType = contentType;
  let actualContentPath = contentPath;

  try {
    const targetUrl = targetWindow.webContents.getURL();
    console.log(`[WINDOW] 目标窗口URL: ${targetUrl}`);
    
    const urlObj = new URL(targetUrl);
    const urlParams = urlObj.searchParams;
    
    // 如果没有明确指定，则从目标窗口获取
    if (!contentPath) {
      actualContentType = urlParams.get('type') || contentType;
      actualContentPath = urlParams.get('path') || '';
      console.log(`[WINDOW] 从目标窗口提取内容 - 类型: ${actualContentType}, 路径: ${actualContentPath}`);
    }
    
    console.log(`[WINDOW] 镜头将使用 - 类型: ${actualContentType}, 路径: ${actualContentPath}`);
  } catch (error) {
    console.warn(`[WINDOW] 无法从目标窗口获取内容信息:`, error);
  }

  // 构建URL参数
  const queryObj = {
    lensId,
    targetId: targetWindowId,
    type: actualContentType,
    path: actualContentPath
  };

  // 确定窗口位置（默认在目标窗口中心）
  let position;
  if (x !== undefined && y !== undefined) {
    position = { x, y };
  } else {
    const targetBounds = targetWindow.getBounds();
    position = {
      x: targetBounds.x + (targetBounds.width - width) / 2,
      y: targetBounds.y + (targetBounds.height - height) / 2
    };
  }

  const windowOptions = {
    width,
    height,
    x: position.x,
    y: position.y,
    title: `镜头 - ${lensId}`,
    htmlName: 'lensViewer.html',
    otherContents: queryObj,
    resizable: true,
    frame: false,           // 无边框
    transparent: true,      // 透明背景
    alwaysOnTop: true,      // 始终置顶
  };

  const lensWindow = createWindow(lensId, windowOptions);

  if (lensWindow && !lensWindow.isDestroyed()) {
    // 注册镜头系统
    registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow);

    // 监听镜头窗口关闭
    lensWindow.on('closed', () => {
      console.log(`[WINDOW] 镜头窗口关闭: ${lensId}`);
      unregisterLensSystem(lensId);
    });

    console.log(`[WINDOW] 镜头窗口创建成功: ${lensId} -> ${targetWindowId}`);
    return { success: true, message: `镜头窗口 ${lensId} 创建成功`, id: lensId };
  }

  return { success: false, message: '创建镜头窗口失败' };
}

/**
 * 设置窗口透明度
 * @param {string} id - 窗口ID
 * @param {number} opacity - 透明度 (0.0-1.0)
 * @returns {Object} 操作结果
 */
export function setWindowOpacity(id, opacity) {
  console.log(`[WINDOW] 设置窗口透明度, ID: ${id}, 透明度: ${opacity}`);

  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${id} 不存在` };
  }

  // 验证opacity参数
  // API查询结果：setOpacity(opacity)
  // - 用处：设置窗口不透明度
  // - 输入：opacity (Number) - 0.0（完全透明）到 1.0（完全不透明）
  // - 输出：void
  const opacityNum = parseFloat(opacity);
  if (isNaN(opacityNum) || opacityNum < 0 || opacityNum > 1) {
    return { 
      success: false, 
      message: 'opacity 必须是 0.0 到 1.0 之间的数字' 
    };
  }

  try {
    win.setOpacity(opacityNum);
    console.log(`[WINDOW] 窗口 ${id} 透明度已设置为 ${opacityNum}`);
    return { 
      success: true, 
      message: `窗口 ${id} 透明度已设置为 ${opacityNum}` 
    };
  } catch (error) {
    console.error(`[WINDOW] 设置透明度失败:`, error);
    return { 
      success: false, 
      message: `设置失败: ${error.message}` 
    };
  }
}

/**
 * 设置窗口始终置顶
 * @param {string} id - 窗口ID
 * @param {boolean} flag - 是否置顶
 * @param {string} level - 置顶级别（可选）
 * @returns {Object} 操作结果
 */
export function setWindowAlwaysOnTop(id, flag, level = 'normal') {
  console.log(`[WINDOW] 设置窗口置顶, ID: ${id}, 置顶: ${flag}, 级别: ${level}`);

  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${id} 不存在` };
  }

  // 验证flag参数
  if (typeof flag !== 'boolean') {
    return { 
      success: false, 
      message: 'flag 必须是 true 或 false' 
    };
  }

  // 验证level参数
  // API查询结果：setAlwaysOnTop(flag, level)
  // - 用处：设置窗口是否始终显示在其他窗口之上
  // - 输入：flag (Boolean), level (String, 可选) - 'normal', 'floating', 'torn-off-menu', etc.
  // - 输出：void
  const validLevels = ['normal', 'floating', 'torn-off-menu', 'modal-panel', 'main-menu', 'status', 'pop-up-menu', 'screen-saver'];
  if (!validLevels.includes(level)) {
    return {
      success: false,
      message: `不支持的level: ${level}。有效值: ${validLevels.join(', ')}`
    };
  }

  try {
    win.setAlwaysOnTop(flag, level);
    console.log(`[WINDOW] 窗口 ${id} 置顶状态已设置为 ${flag}, 级别: ${level}`);
    return { 
      success: true, 
      message: `窗口 ${id} 置顶状态已设置为 ${flag}` 
    };
  } catch (error) {
    console.error(`[WINDOW] 设置置顶状态失败:`, error);
    return { 
      success: false, 
      message: `设置失败: ${error.message}` 
    };
  }
}

/**
 * 更新内容窗口的模糊程度
 * @param {string} id - 窗口ID
 * @param {number} blurAmount - 模糊程度 (0-50)
 * @returns {Object} 操作结果
 */
export function updateContentBlur(id, blurAmount) {
  console.log(`[WINDOW] 更新内容窗口模糊度, ID: ${id}, 模糊度: ${blurAmount}`);

  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `窗口 ${id} 不存在` };
  }

  const blurNum = parseFloat(blurAmount);
  if (isNaN(blurNum) || blurNum < 0 || blurNum > 50) {
    return {
      success: false,
      message: 'blurAmount 必须是 0 到 50 之间的数字'
    };
  }

  try {
    win.webContents.send('update-blur', blurNum);
    console.log(`[WINDOW] 窗口 ${id} 模糊度已更新为 ${blurNum}`);
    return {
      success: true,
      message: `窗口 ${id} 模糊度已更新为 ${blurNum}`
    };
  } catch (error) {
    console.error(`[WINDOW] 更新模糊度失败:`, error);
    return {
      success: false,
      message: `更新失败: ${error.message}`
    };
  }
}

/**
 * 销毁镜头系统（镜头窗口和相关绑定）
 * @param {string} lensId - 镜头窗口ID
 * @returns {Object} 操作结果
 */
export function destroyLensSystem(lensId) {
  console.log(`[WINDOW] 销毁镜头系统, ID: ${lensId}`);

  const lensWindow = windows.get(lensId);
  if (!lensWindow || lensWindow.isDestroyed()) {
    return { success: false, message: `镜头 ${lensId} 不存在` };
  }

  try {
    // 注销镜头系统（会自动移除事件监听器）
    unregisterLensSystem(lensId);

    // 关闭窗口
    lensWindow.close();

    console.log(`[WINDOW] 镜头系统已销毁: ${lensId}`);
    return {
      success: true,
      message: `镜头系统 ${lensId} 已销毁`
    };
  } catch (error) {
    console.error(`[WINDOW] 销毁镜头系统失败:`, error);
    return {
      success: false,
      message: `销毁失败: ${error.message}`
    };
  }
}

/**
 * 获取所有镜头系统信息
 * @returns {Array} 镜头系统列表
 */
export function getLensSystems() {
  return getAllLensSystems();
}

/**
 * 获取镜头系统信息
 * @param {string} lensId - 镜头ID
 * @returns {Object|null} 镜头系统信息
 */
export function getLensSystem(lensId) {
  return getLensSystemInfo(lensId);
}

