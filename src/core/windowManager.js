import { BrowserWindow } from 'electron';
import path from 'node:path';
import url from 'node:url';

// 全局窗口映射
export const windows = new Map(); // id -> BrowserWindow

/**
 * 创建窗口
 * @param {string} id - 窗口ID
 * @param {Object} opts - 窗口选项
 * @returns {BrowserWindow} 创建的窗口
 */
export function createWindow(id, opts = {}) {
  console.debug(`[WINDOW] 开始创建窗口 ID: ${id}`);
  console.debug(`[WINDOW] 窗口配置:`, { 
    width: opts.width ?? 800, 
    height: opts.height ?? 500, 
    x: opts.x, 
    y: opts.y, 
    title: opts.title ?? id 
  });
  
  const win = new BrowserWindow({
    width: opts.width ?? 800,
    height: opts.height ?? 500,
    x: opts.x,
    y: opts.y,
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
  
  const win = createWindow(doorId, { 
    width: 320, 
    height: 420, 
    x: 900, 
    y: 280, 
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
  
  const win = createWindow(keyId, { 
    width: 200, 
    height: 200, 
    x: 600, 
    y: 280, 
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

