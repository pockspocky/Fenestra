import { BrowserWindow } from 'electron';
import path from 'node:path';
import url from 'node:url';
import '../../logger.js'; // 导入日志系统

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
  });
  
  const win = new BrowserWindow({
    width: opts.width ?? 800,
    height: opts.height ?? 500,
    x: position.x,
    y: position.y,
    title: opts.title ?? id,
    show: true,
    frame: true,
    transparent: false,
    resizable: true,
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  
  console.debug(`[WINDOW] BrowserWindow已创建，ID: ${id}, webContentsId: ${win.webContents.id}`);
  
  const q = new url.URLSearchParams({ id });
  const htmlPath = path.join(process.cwd(), 'renderer', 'index.html');
  console.debug(`[WINDOW] 加载HTML文件: ${htmlPath}?${q.toString()}`);
  win.loadFile(htmlPath, { query: q.toString() });
  
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
  const win = createWindow(doorId, { 
    width: 320, 
    height: 420, 
    title: doorTitle 
  });
  
  console.log('[WINDOW] 门窗口创建完成');
  return win;
}

/**
 * 创建钥匙窗口
 * @param {string} keyId - 钥匙ID
 * @param {string} title - 钥匙标题
 * @param {boolean} encrypt - 是否加密
 * @param {Array} relatedDoors - 关联的门ID数组
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

