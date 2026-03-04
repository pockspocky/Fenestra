import { BrowserWindow } from 'electron';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import '../../logger.js'; // Import logging system
import {
  registerLensSystem,
  unregisterLensSystem,
  getLensSystemInfo,
  getAllLensSystems,
  getLensSystemCount,
  lensSystemExists
} from './lensSystem.js';
import { resolveAssetPath, resolveDoorImagePath, resolveKeyImagePath } from '../utils/assetPathResolver.js';
import { initializeDoorState } from './doorKeySystem.js';
import { getWindowDimensionsConfig } from '../core/config.js';
import {
  triggerWindowCreated,
  triggerWindowClosed,
  triggerWindowMoved,
  triggerWindowResized,
  triggerWindowReady
} from '../core/callbacks/windowCallbacks.js';
import { validateAndResolvePath, getDefaultGameDataDirectory } from '../security/pathSecurityValidator.js';
import { memoryManager } from '../utils/memoryManager.js';
import { securityAuditSystem } from '../security/auditSystem.js';

// Global window mapping
export const windows = new Map(); // id -> BrowserWindow

// Window offset configuration
const WINDOW_OFFSET = {
  x: 30, // Horizontal offset
  y: 30  // Vertical offset
};

/**
 * Valid fRole values for window type identification
 * fRole (Fenestra Role) is a custom property stored on BrowserWindow instances
 * to identify their functional role in the system.
 * @constant {string[]}
 */
export const VALID_FROLES = [
  'door',      // Door windows (door-key system)
  'key',       // Key windows (door-key system)
  'picture',   // Picture/image windows
  'content',   // Content display windows
  'lens',      // Lens/magnification windows
  'terminal',  // Terminal windows
  'desktop',   // Desktop windows
  'video',     // Video player windows
  'generic'    // Default/fallback for all other windows
];

/**
 * Validate an fRole value
 * @param {string} fRole - The fRole to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidFRole(fRole) {
  return VALID_FROLES.includes(fRole);
}

/**
 * Sanitize an fRole value, returning 'generic' if invalid
 * @param {string} fRole - The fRole to sanitize
 * @param {string} context - Context for logging (e.g., window ID)
 * @returns {string} Valid fRole value
 */
export function sanitizeFRole(fRole, context = '') {
  if (!isValidFRole(fRole)) {
    const contextMsg = context ? ` ${context}` : '';
    console.warn(`[FROLE] Invalid fRole '${fRole}'${contextMsg}, using 'generic'`);
    return 'generic';
  }
  return fRole;
}

// Calculate overlap ratio between two rectangles
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

// Check if position overlaps too much with existing windows
function checkOverlapWithWindows(newBounds, windowId, maxOverlapRatio = 0.4) {
  for (const [id, win] of windows) {
    if (id === windowId) continue; // Skip self
    
    const existingBounds = win.getBounds();
    const overlapRatio = calculateOverlapRatio(newBounds, existingBounds);
    
    console.debug(`[OVERLAP_CHECK] Checking overlap with window ${id}: ${(overlapRatio * 100).toFixed(1)}%`);
    
    if (overlapRatio > maxOverlapRatio) {
      return { hasOverlap: true, overlapWindow: id, ratio: overlapRatio };
    }
  }
  
  return { hasOverlap: false };
}

// Find suitable position for key window (avoid overlapping with doors more than 40%)
function findSuitablePositionForKey(keyId, width, height, maxOverlapRatio = 0.4) {
  console.debug(`[KEY_POSITION] Finding suitable position for key ${keyId}, avoiding door overlap exceeding ${(maxOverlapRatio * 100)}%`);
  
  // Get all door windows using fRole property
  const doorWindows = Array.from(windows.entries()).filter(([id, win]) => win && win.fRole === 'door');
  
  if (doorWindows.length === 0) {
    // No door windows, use default offset logic
    return getNextWindowPosition();
  }
  
  // Try multiple positions
  const screenWidth = 1920; // Assumed screen width
  const screenHeight = 1080; // Assumed screen height
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x, y;
    
    if (attempt < 10) {
      // First 10 attempts: top-left area of screen
      x = 100 + (attempt % 5) * 250;
      y = 100 + Math.floor(attempt / 5) * 150;
    } else if (attempt < 20) {
      // Next 10 attempts: top-right area of screen
      x = screenWidth - width - 100 - (attempt % 10) * 50;
      y = 100 + Math.floor(attempt / 10) * 150;
    } else if (attempt < 30) {
      // Next 10 attempts: bottom-left area of screen
      x = 100 + (attempt % 10) * 100;
      y = screenHeight - height - 100 - Math.floor(attempt / 10) * 100;
    } else {
      // Last 20 attempts: random positions
      x = 100 + Math.random() * (screenWidth - width - 200);
      y = 100 + Math.random() * (screenHeight - height - 200);
    }
    
    const newBounds = { x, y, width, height };
    const overlapCheck = checkOverlapWithWindows(newBounds, keyId, maxOverlapRatio);
    
    if (!overlapCheck.hasOverlap) {
      console.debug(`[KEY_POSITION] Found suitable position: (${x}, ${y}), attempts: ${attempt + 1}`);
      return { x, y };
    }
    
    console.debug(`[KEY_POSITION] Position (${x}, ${y}) overlaps with window ${overlapCheck.overlapWindow} by ${(overlapCheck.ratio * 100).toFixed(1)}%, continuing...`);
  }
  
  // If no suitable position found, use default offset logic
  console.warn(`[KEY_POSITION] Unable to find suitable position for key ${keyId}, using default offset logic`);
  return getNextWindowPosition();
}

// Get next window position
function getNextWindowPosition(defaultX, defaultY) {
  // If no position specified, use default position
  if (defaultX !== undefined && defaultY !== undefined) {
    return { x: defaultX, y: defaultY };
  }
  
  // Get position of last window
  const windowEntries = Array.from(windows.entries());
  if (windowEntries.length === 0) {
    // If no windows, use default position
    return { x: 100, y: 100 };
  }
  
  // Get bounds of last window
  const lastWindow = windowEntries[windowEntries.length - 1][1];
  const lastBounds = lastWindow.getBounds();
  
  // Calculate new position (add offset)
  const newX = lastBounds.x + WINDOW_OFFSET.x;
  const newY = lastBounds.y + WINDOW_OFFSET.y;
  
  console.debug(`[WINDOW_OFFSET] Calculating new window position: (${newX}, ${newY}), based on window: ${windowEntries[windowEntries.length - 1][0]}`);
  
  return { x: newX, y: newY };
}

/**
 * Create window
 * @param {string} id - Window ID
 * @param {Object} opts - Window options
 * @param {number} [opts.width=800] - Window width
 * @param {number} [opts.height=500] - Window height
 * @param {number} [opts.x] - Window x position (auto-calculated if not provided)
 * @param {number} [opts.y] - Window y position (auto-calculated if not provided)
 * @param {string} [opts.title] - Window title (defaults to window ID)
 * @param {boolean} [opts.resizable=true] - Whether window is resizable
 * @param {boolean} [opts.transparent=false] - Whether window has transparent background
 * @param {string|Object} [opts.otherContents='index.html'] - HTML file or query parameters
 * @param {string} [opts.htmlName] - HTML file name (used with otherContents object)
 * @param {string} [opts.fRole='generic'] - Fenestra Role for window type identification.
 *   Valid values: 'door', 'key', 'picture', 'content', 'lens', 'terminal', 'desktop', 'video', 'generic'.
 *   This property is automatically assigned by specialized creation functions (createDoor, createKey, etc.).
 *   Invalid values will be sanitized to 'generic' with a warning.
 * @returns {BrowserWindow} Created window
 */
export function createWindow(id, opts = {}) {
  console.debug(`[WINDOW] Starting to create window ID: ${id}`);
  
  // Register memory cleanup for this window
  memoryManager.registerCleanupHandler(`window_${id}`, () => {
    console.log(`[WINDOW] Cleaning up window: ${id}`);
    const win = windows.get(id);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });
  
  // Get window position (supports automatic offset)
  const position = getNextWindowPosition(opts.x, opts.y);
  
  console.debug(`[WINDOW] Window configuration:`, { 
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
  
  console.debug(`[WINDOW] BrowserWindow created, ID: ${id}, webContentsId: ${win.webContents.id}`);
  
  // Assign and validate fRole using helper function
  const fRole = opts.fRole || 'generic';
  win.fRole = sanitizeFRole(fRole, `for window ${id}`);
  console.debug(`[WINDOW_MANAGER] Assigned fRole '${win.fRole}' to window ${id}`);
  
  // Parse filename and query parameters from otherContents
  const otherContents = opts.otherContents;
  const htmlName = opts.htmlName;
  let htmlFileName;
  let queryObj = { id };
  
  // Determine the type of otherContents
  if (typeof otherContents === 'string') {
    // String format: could be "file.html" or "file.html?param=value"
    if (otherContents.includes('?')) {
      const parts = otherContents.split('?');
      htmlFileName = parts[0];
      const additionalQuery = parts[1];
      
      // Merge query parameters
      const additionalParams = new url.URLSearchParams(additionalQuery);
      for (const [key, value] of additionalParams) {
        queryObj[key] = value;
      }
    } else {
      htmlFileName = otherContents;
    }
  } else if (typeof otherContents === 'object' && otherContents !== null) {
    // Object format: directly use as query parameters
    // Prioritize htmlName, otherwise default to 'index.html'
    htmlFileName = htmlName || 'index.html';
    // Ensure window's id is not overwritten by id in otherContents
    queryObj = { ...otherContents, id };
  } else {
    // otherContents not provided or is other type
    // Prioritize htmlName, otherwise default to 'index.html'
    htmlFileName = htmlName || 'index.html';
  }
  
  // Build HTML file path
  const rendererDir = path.join(process.cwd(), 'renderer');
  const htmlPath = path.join(rendererDir, htmlFileName);
  
  // Validate that the HTML file exists and is within the renderer directory
  // Note: We don't use the path security validator here because renderer files
  // are part of the application itself, not user data
  const resolvedHtmlPath = path.resolve(htmlPath);
  const resolvedRendererDir = path.resolve(rendererDir);
  
  if (!resolvedHtmlPath.startsWith(resolvedRendererDir)) {
    console.error(`[WINDOW] Invalid HTML file path: Path outside renderer directory`);
    
    // Log security event
    securityAuditSystem.logSecurityEvent('path_violation', 'high', {
      component: 'WindowManager',
      function: 'createWindow',
      violationType: 'invalid_html_path',
      mitigationAction: 'window_creation_blocked',
      inputData: htmlFileName
    }, {
      windowId: id,
      requestedPath: htmlPath
    });
    
    win.destroy();
    throw new Error(`Invalid HTML file path: Path outside renderer directory`);
  }
  
  console.debug(`[WINDOW] Loading HTML file: ${resolvedHtmlPath}`);
  console.debug(`[WINDOW] Query parameter object:`, queryObj);
  win.loadFile(resolvedHtmlPath, { query: queryObj });
  
  // Set window event listeners
  setupWindowEvents(win, id);
  
  // Trigger window-created callback before adding to windows map
  const bounds = win.getBounds();
  const createdResult = triggerWindowCreated(id, {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: win.getTitle(),
    options: opts
  });
  
  // Check if default behavior was prevented
  if (createdResult.prevented) {
    console.log(`[WINDOW] Window creation prevented by callback, ID: ${id}`);
    
    // Log security event
    securityAuditSystem.logSecurityEvent('window_operation', 'medium', {
      component: 'WindowManager',
      function: 'createWindow',
      violationType: 'creation_prevented_by_callback',
      mitigationAction: 'window_destroyed',
      inputData: JSON.stringify(opts).substring(0, 200)
    }, {
      windowId: id
    });
    
    win.destroy();
    return null;
  }
  
  windows.set(id, win);
  console.debug(`[WINDOW] Window added to mapping, ID: ${id}, total windows: ${windows.size}`);
  
  // Log successful window creation
  securityAuditSystem.logSecurityEvent('window_operation', 'low', {
    component: 'WindowManager',
    function: 'createWindow',
    violationType: 'authorized_window_creation',
    mitigationAction: 'window_created',
    inputData: JSON.stringify({ id, title: opts.title }).substring(0, 200)
  }, {
    windowId: id,
    windowCount: windows.size
  });
  
  return win;
}

/**
 * Set up window event listeners
 * @param {BrowserWindow} win - Window object
 * @param {string} id - Window ID
 */
function setupWindowEvents(win, id) {
  win.on('closed', () => {
    console.debug(`[WINDOW] Window closed event triggered, ID: ${id}`);
    
    // Trigger window-closed callback before cleanup
    triggerWindowClosed(id);
    
    // If it's a lens window, unregister lens system first (before deleting window)
    if (lensSystemExists(id)) {
      console.debug(`[WINDOW] Detected lens window closure, unregistering lens system first: ${id}`);
      unregisterLensSystem(id);
    }
    
    // Clean up memory manager registration
    memoryManager.unregisterCleanupHandler(`window_${id}`);
    
    windows.delete(id);
    console.log(`[WINDOW] Removed from window mapping ID: ${id}, remaining windows: ${windows.size}`);
    
    // Log window closure for audit
    securityAuditSystem.logSecurityEvent('window_operation', 'low', {
      component: 'WindowManager',
      function: 'windowClosed',
      violationType: 'authorized_window_closure',
      mitigationAction: 'window_cleaned_up',
      inputData: id
    }, {
      windowId: id,
      remainingWindows: windows.size
    });
    
    // Trigger window closed callback (legacy support)
    if (windowCloseCallback) {
      windowCloseCallback(id);
    }
  });
  
  win.on('ready-to-show', () => {
    console.debug(`[WINDOW] 窗口准备显示, ID: ${id}`);
    
    // Trigger window-ready callback
    triggerWindowReady(id);
  });
  
  win.on('moved', () => {
    const bounds = win.getBounds();
    console.debug(`[WINDOW] 窗口移动, ID: ${id}, 新位置: (${bounds.x}, ${bounds.y})`);
    
    // Trigger window-moved callback
    triggerWindowMoved(id, { x: bounds.x, y: bounds.y });
  });
  
  win.on('resized', () => {
    const bounds = win.getBounds();
    console.debug(`[WINDOW] 窗口调整大小, ID: ${id}, 新尺寸: ${bounds.width}x${bounds.height}`);
    
    // Trigger window-resized callback
    triggerWindowResized(id, { width: bounds.width, height: bounds.height });
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
  const win = createWindow('desktop', { width: 1200, height: 800, title: 'Desktop', fRole: 'desktop' });
  console.debug('[WINDOW] 桌面窗口创建完成');
  return win;
}

/**
 * 创建视频窗口
 * @returns {BrowserWindow} 视频窗口
 */
export function createVideo() {
  console.debug('[WINDOW] 创建视频窗口');
  const win = createWindow('video', { width: 640, height: 360, x: 100, y: 120, title: 'Training Video', fRole: 'video' });
  console.debug('[WINDOW] 视频窗口创建完成');
  return win;
}

/**
 * 创建门窗口
 * @param {string} doorId - 门ID
 * @param {string} title - 门标题
 * @param {boolean} encrypt - 是否加密
 * @param {Object|string} optionsOrOtherContents - 选项对象或自定义HTML内容（向后兼容）
 * @param {string} optionsOrOtherContents.closedImagePath - 自定义关闭状态图片路径
 * @param {string} optionsOrOtherContents.openedImagePath - 自定义打开状态图片路径
 * @param {string} optionsOrOtherContents.initialState - 初始状态 ('open' 或 'closed')
 * @param {boolean} optionsOrOtherContents.isLocked - 是否锁定
 * @returns {BrowserWindow} 门窗口
 * @note This function automatically assigns fRole='door' to the created window for type identification
 */
export function createDoor(doorId = 'door', title = null, encrypt = false, optionsOrOtherContents = null) {
  console.log(`[WINDOW] 创建门窗口（${encrypt ? '加密' : '普通'}状态）, ID: ${doorId}`);
  
  // Parse options - support both old string format and new object format
  let options = {};
  let otherContents = null;
  
  if (typeof optionsOrOtherContents === 'string') {
    // Backward compatibility: old string format
    otherContents = optionsOrOtherContents;
    console.log('[WINDOW] Using legacy string format for door creation');
  } else if (optionsOrOtherContents && typeof optionsOrOtherContents === 'object') {
    // New object format
    options = optionsOrOtherContents;
    console.log('[WINDOW] Using new options format for door creation:', options);
  }
  
  // Extract options
  const {
    closedImagePath = null,
    openedImagePath = null,
    initialState = 'closed',
    isLocked = !encrypt ? false : true
  } = options;
  
  // Validate custom image paths if provided
  if (closedImagePath) {
    const resolvedClosed = resolveAssetPath(closedImagePath);
    if (!fs.existsSync(resolvedClosed)) {
      console.warn(`[WINDOW] Custom closed image path does not exist: ${closedImagePath}`);
    }
  }
  
  if (openedImagePath) {
    const resolvedOpened = resolveAssetPath(openedImagePath);
    if (!fs.existsSync(resolvedOpened)) {
      console.warn(`[WINDOW] Custom opened image path does not exist: ${openedImagePath}`);
    }
  }
  
  // Determine door title
  const doorTitle = title || (encrypt ? `Door (encrypted)` : `Door (unlocked)`);
  
  // Initialize door state in doorKeySystem
  initializeDoorState(doorId, {
    state: initialState,
    isLocked,
    isEncrypted: encrypt,
    closedImagePath,
    openedImagePath
  });
  console.log(`[WINDOW] Initialized door state for ${doorId}:`, { initialState, isLocked, encrypt });
  
  // Build door.html URL with parameters
  let finalContent;
  
  if (otherContents) {
    // Backward compatibility: use custom HTML content
    if (otherContents.includes('?')) {
      finalContent = `${otherContents}&doorId=${encodeURIComponent(doorId)}`;
    } else {
      finalContent = `${otherContents}?doorId=${encodeURIComponent(doorId)}`;
    }
    console.log('[WINDOW] Using custom HTML content (backward compatibility)');
  } else {
    // Use new door.html with state parameters
    const params = new URLSearchParams({
      doorId,
      state: initialState,
      isLocked: isLocked.toString(),
      isEncrypted: encrypt.toString()
    });
    
    // Add custom image paths if provided
    if (closedImagePath) {
      params.set('closedImagePath', closedImagePath);
    }
    if (openedImagePath) {
      params.set('openedImagePath', openedImagePath);
    }
    
    finalContent = `door.html?${params.toString()}`;
    console.log('[WINDOW] Using door.html with parameters:', params.toString());
  }
  
  // Get configured door dimensions
  const windowDims = getWindowDimensionsConfig();
  const doorDims = windowDims.doorWindow;
  
  // Create window
  const win = createWindow(doorId, { 
    width: doorDims.width, 
    height: doorDims.height, 
    title: doorTitle,
    resizable: true,
    otherContents: finalContent,
    fRole: 'door',
  });
  
  console.log('[WINDOW] 门窗口创建完成, ID:', doorId);
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
export function createPicture(pictureId = 'picture', imagePath = 'renderer/assets/doors/DoorClosed.png', fitMode = 'fill', title = null, width = 400, height = 300, opacity = 1.0) {
  // Resolve image path with backward compatibility
  const resolvedPath = resolveAssetPath(imagePath);
  
  const pictureTitle = title || `Picture: ${path.basename(resolvedPath)}`;
  console.log(`[WINDOW] 创建图片窗口, ID: ${pictureId}, 路径: ${resolvedPath}, 缩放模式: ${fitMode}`);
  
  // 验证 fitMode
  const validFitModes = ['fill', 'contain', 'cover', 'scale-down', 'none'];
  const actualFitMode = validFitModes.includes(fitMode) ? fitMode : 'fill';
  
  if (fitMode !== actualFitMode) {
    console.warn(`[WINDOW] 无效的缩放模式 ${fitMode}，使用默认值: fill`);
  }
  
  // 编码路径参数
  const encodedPath = encodeURIComponent(resolvedPath);
  const queryString = `imagePath=${encodedPath}&fitMode=${actualFitMode}`;
  
  const win = createWindow(pictureId, { 
    width, 
    height, 
    title: pictureTitle,
    resizable: true,
    otherContents: `pictureViewer.html?${queryString}`,
    fRole: 'picture',
  });
  
  if (win && !win.isDestroyed()) {
    // Apply opacity if specified
    if (opacity !== 1.0) {
      setWindowOpacity(pictureId, opacity);
    }
  }
  
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
 * Create a key window with optional custom image
 * 
 * Creates a key window that displays a key image. By default, uses the new Key.png image,
 * but can be customized with a different image path. The key window is automatically
 * positioned to avoid excessive overlap with door windows.
 * 
 * @param {string} [keyId='key'] - Unique identifier for the key window
 * @param {string|null} [title=null] - Window title. If null, generates title based on encrypt parameter
 * @param {boolean} [encrypt=false] - Whether this is an encrypted key (affects default title)
 * @param {Array<string>} [relatedDoors=[]] - Array of door IDs that this key can unlock (for future use)
 * @param {string|null} [otherContents=null] - Custom HTML content path. If provided, overrides default picture viewer.
 *   For backward compatibility with existing code.
 * @param {string|null} [imagePath=null] - Custom key image path (optional). 
 *   - If null/undefined: Uses default Key.png (or fallback to Keychain.jpeg if Key.png missing)
 *   - If relative path: Resolved from project root (e.g., 'renderer/assets/Keys/GoldKey.png')
 *   - If absolute path: Used directly (e.g., '/Users/dev/custom-key.png')
 *   - Invalid paths automatically fallback to default Key.png
 * @returns {BrowserWindow} The created key window instance
 * 
 * @since 1.0.0 - Initial implementation
 * @since 1.2.0 - Added imagePath parameter for custom key images
 * @since 1.3.0 - Enhanced positioning to avoid door overlap
 * 
 * @example
 * // Create key with default image (Key.png)
 * const masterKey = createKey('key-1', 'Master Key', false);
 * 
 * @example
 * // Create encrypted key with default image
 * const encryptedKey = createKey('key-2', null, true);
 * // Title will be "Key (encrypted)"
 * 
 * @example
 * // Create key with custom relative path image
 * const goldKey = createKey('key-3', 'Gold Key', false, [], null, 'renderer/assets/Keys/GoldKey.png');
 * 
 * @example
 * // Create key with custom absolute path image
 * const specialKey = createKey('key-4', 'Special Key', false, [], null, '/path/to/custom-key.png');
 * 
 * @example
 * // Create key with custom HTML content (backward compatibility)
 * const customKey = createKey('key-5', 'Custom Key', false, [], 'customKeyViewer.html?special=true');
 */
export function createKey(keyId = 'key', title = null, encrypt = false, relatedDoors = [], otherContents = null, imagePath = null) {
  // Generate window title based on parameters
  const keyTitle = title || (encrypt ? `Key (encrypted)` : `Key (master)`);
  console.log(`[WINDOW] 创建钥匙窗口（${encrypt ? '加密' : '普通'}）`);
  
  // Calculate key window dimensions
  const keyWidth = 200;
  const keyHeight = 200;

  // Find suitable position that avoids excessive overlap with door windows
  // This ensures keys are visible and not hidden behind doors
  const suitablePosition = findSuitablePositionForKey(keyId, keyWidth, keyHeight, keyDoorMaxOverlap);
  
  // Resolve key image path with fallback chain:
  // 1. If imagePath provided and valid -> use custom image
  // 2. If imagePath null/undefined -> use default Key.png
  // 3. If Key.png missing -> fallback to Keychain.jpeg (legacy)
  // 4. If both missing -> return Key.png path anyway (renderer shows broken image)
  const resolvedKeyImage = resolveKeyImagePath(imagePath);
  
  // Build HTML content for the key window
  // Supports both custom HTML (for backward compatibility) and default picture viewer
  const htmlContent = otherContents || `pictureViewer.html?imagePath=${encodeURIComponent(resolvedKeyImage)}&fitMode=cover`;
  
  // Prepare final content with keyId parameter
  let finalContent;
  if (otherContents) {
    // Custom HTML content provided - append keyId to query string
    if (otherContents.includes('?')) {
      finalContent = `${otherContents}&keyId=${encodeURIComponent(keyId)}`;
    } else {
      finalContent = `${otherContents}?keyId=${encodeURIComponent(keyId)}`;
    }
  } else {
    // Use default picture viewer with resolved key image
    finalContent = htmlContent;
  }
  
  const win = createWindow(keyId, { 
    width: keyWidth, 
    height: keyHeight, 
    x: suitablePosition.x,
    y: suitablePosition.y,
    title: keyTitle,
    otherContents: finalContent,
    fRole: 'key',
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
 * Get all windows with the specified fRole
 * @param {string} role - The fRole to filter by
 * @returns {string[]} Array of window IDs with the specified role
 */
export function getWindowsByRole(role) {
  const matchingWindows = [];
  for (const [windowId, win] of windows) {
    if (win && win.fRole === role) {
      matchingWindows.push(windowId);
    }
  }
  return matchingWindows;
}

/**
 * Get the fRole of a specific window
 * @param {string} windowId - The window ID to query
 * @returns {string|null} The window's fRole, 'generic' if no fRole set, or null if window doesn't exist
 */
export function getWindowRole(windowId) {
  const win = windows.get(windowId);
  if (!win) {
    return null;
  }
  return win.fRole || 'generic';
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
    fRole: 'terminal',
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
 * 解析内容输入
 * 支持格式：
 * 1. "表面内容|||隐藏内容" - 使用|||分隔符（文字/图片路径）
 * 2. "文件路径.txt" - 读取文本文件内容
 * 3. "图片路径.png" - 图片路径（清晰化模式）
 * 4. "普通文本" - 直接使用文本
 * 
 * @param {string} input - 输入字符串
 * @param {string} contentType - 内容类型（'text' 或 'image'）
 * @returns {Object} { surface: string, hidden: string }
 */
function parseContentInput(input, contentType = 'text') {
  if (!input || typeof input !== 'string') {
    console.warn('[CONTENT_PARSE] 输入为空或不是字符串');
    return { surface: '', hidden: '' };
  }

  // 检测特殊分隔符 |||（适用于文字和图片路径）
  if (input.includes('|||')) {
    const parts = input.split('|||');
    const surface = parts[0] || '';
    const hidden = parts[1] || parts[0]; // 如果没有隐藏内容，使用表面内容
    
    if (contentType === 'image') {
      console.log(`[CONTENT_PARSE] 图片双路径模式 - 表面: "${surface}", 隐藏: "${hidden}"`);
    } else {
      console.log(`[CONTENT_PARSE] 文字分隔符模式 - 表面: "${surface.substring(0, 50)}...", 隐藏: "${hidden.substring(0, 50)}..."`);
    }
    return { surface, hidden };
  }

  // 图片路径检测（以图片扩展名结尾）
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const isImagePath = imageExtensions.some(ext => input.toLowerCase().endsWith(ext));
  
  if (contentType === 'image' && isImagePath) {
    // 图片清晰化模式：镜头显示相同图片但清晰
    console.log(`[CONTENT_PARSE] 图片清晰化模式 - 路径: "${input}"`);
    return { surface: input, hidden: input };
  }

  // 文本文件路径检测（以 .txt 结尾）
  if (input.endsWith('.txt')) {
    try {
      const fullPath = path.isAbsolute(input) 
        ? input 
        : path.join(process.cwd(), input);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // 文件内容也可能包含 ||| 分隔符
        if (content.includes('|||')) {
          const parts = content.split('|||');
          const surface = parts[0] || '';
          const hidden = parts[1] || parts[0];
          console.log(`[CONTENT_PARSE] 从文件读取双内容 - 文件: ${input}`);
          return { surface, hidden };
        } else {
          // 文件只有一种内容，镜头显示相同内容（清晰化模式）
          console.log(`[CONTENT_PARSE] 从文件读取单内容 - 文件: ${input}`);
          return { surface: content, hidden: content };
        }
      } else {
        console.warn(`[CONTENT_PARSE] 文件不存在: ${fullPath}`);
        return { surface: `[错误] 文件不存在: ${input}`, hidden: `[错误] 文件不存在: ${input}` };
      }
    } catch (error) {
      console.error(`[CONTENT_PARSE] 读取文件失败:`, error);
      return { surface: `[错误] 读取文件失败: ${error.message}`, hidden: `[错误] 读取文件失败: ${error.message}` };
    }
  }

  // 普通文本，镜头显示相同内容（清晰化模式）
  console.log(`[CONTENT_PARSE] 使用普通文本模式 - "${input.substring(0, 50)}..."`);
  return { surface: input, hidden: input };
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
    title = '内容窗口',
    opacity = 1.0                // 窗口透明度 (0.0-1.0)
  } = options;

  // 解析内容（支持文字和图片）
  let surfaceContent = contentPath;
  let hiddenContent = contentPath;
  
  if (contentPath) {
    const parsed = parseContentInput(contentPath, contentType);
    surfaceContent = parsed.surface;
    hiddenContent = parsed.hidden;
    
    if (contentType === 'image') {
      console.log(`[WINDOW] 图片内容已解析 - 表面: "${surfaceContent}", 隐藏: "${hiddenContent}"`);
    } else {
      console.log(`[WINDOW] 文字内容已解析 - 表面长度: ${surfaceContent.length}, 隐藏长度: ${hiddenContent.length}`);
    }
  }

  // 构建URL参数
  const queryObj = {
    id,
    type: contentType,
    path: contentPath,
    surfaceContent,      // 表面内容（模糊显示）
    hiddenContent,       // 隐藏内容（镜头显示）
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
    fRole: 'content',
  };

  const win = createWindow(id, windowOptions);
  
  if (win && !win.isDestroyed()) {
    // Apply opacity if specified
    if (opacity !== 1.0) {
      setWindowOpacity(id, opacity);
    }
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
    y,
    opacity = 1.0                // 窗口透明度 (0.0-1.0)
  } = options;

  // 从目标窗口获取实际的内容信息
  let actualContentType = contentType;
  let actualContentPath = contentPath;
  let hiddenContent = '';

  try {
    const targetUrl = targetWindow.webContents.getURL();
    console.log(`[WINDOW] 目标窗口URL: ${targetUrl}`);
    
    // 如果没有明确指定内容路径，尝试从目标窗口URL获取
    if (!contentPath && targetUrl) {
      try {
        const urlObj = new URL(targetUrl);
        const urlParams = urlObj.searchParams;
        
        actualContentType = urlParams.get('type') || contentType;
        actualContentPath = urlParams.get('path') || '';
        hiddenContent = urlParams.get('hiddenContent') || '';
        
        console.log(`[WINDOW] 从目标窗口提取内容 - 类型: ${actualContentType}, 路径: ${actualContentPath}`);
        console.log(`[WINDOW] 隐藏内容长度: ${hiddenContent.length}`);
      } catch (urlError) {
        console.warn(`[WINDOW] URL解析失败 (${targetUrl}):`, urlError.message);
        
        // 尝试手动解析file://协议的URL
        if (targetUrl.includes('?')) {
          try {
            const queryString = targetUrl.split('?')[1];
            const urlParams = new URLSearchParams(queryString);
            
            actualContentType = urlParams.get('type') || contentType;
            actualContentPath = urlParams.get('path') || '';
            hiddenContent = urlParams.get('hiddenContent') || '';
            
            console.log(`[WINDOW] 手动解析成功 - 类型: ${actualContentType}, 路径: ${actualContentPath}`);
          } catch (parseError) {
            console.warn(`[WINDOW] 手动解析也失败:`, parseError.message);
            // 使用默认值，已在上面初始化
          }
        }
      }
    }
    
    console.log(`[WINDOW] 镜头将使用 - 类型: ${actualContentType}, 路径: ${actualContentPath || '(无)'}, 隐藏内容: ${hiddenContent ? '是' : '否'}`);
  } catch (error) {
    console.error(`[WINDOW] 从目标窗口获取内容信息时发生错误:`, error);
    // 确保使用初始默认值
    actualContentType = contentType;
    actualContentPath = contentPath;
    hiddenContent = '';
  }

  // 构建URL参数
  const queryObj = {
    lensId,
    targetId: targetWindowId,
    type: actualContentType,
    path: actualContentPath,
    hiddenContent  // 镜头显示隐藏内容
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
    fRole: 'lens',
  };

  const lensWindow = createWindow(lensId, windowOptions);

  if (lensWindow && !lensWindow.isDestroyed()) {
    // Register lens system
    registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow);

    // Apply opacity if specified
    if (opacity !== 1.0) {
      setWindowOpacity(lensId, opacity);
    }

    // Note: Cleanup when lens window closes is handled uniformly in setupWindowEvents
    // No need to add additional 'closed' listener here

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

/**
 * Get window serialization data (integration with storage system)
 * @param {string} windowId - Window ID
 * @returns {Object|null} Window serialization data
 */
export function getWindowSerializationData(windowId) {
  // This function will be called from windowStorage.js to avoid circular imports
  // The actual implementation is in windowStorage.js
  console.debug(`[WINDOW] Getting serialization data for ${windowId} - delegating to storage module`);
  return null; // This will be overridden by the storage module
}

/**
 * Create window from deserialized data
 * @param {Object} windowData - Deserialized window data
 * @param {Object} options - Creation options
 * @returns {Object} Creation result
 */
export function createWindowFromData(windowData, options = {}) {
  // This function will be called from windowStorage.js to avoid circular imports
  // The actual implementation is in windowStorage.js
  console.debug(`[WINDOW] Creating window from data - delegating to storage module`);
  return { success: false, message: 'Function not implemented - use storage module directly' };
}

/**
 * Update existing window from data
 * @param {string} windowId - Window ID
 * @param {Object} windowData - Window data
 * @returns {Object} Update result
 */
export function updateWindowFromData(windowId, windowData) {
  console.debug(`[WINDOW] Updating window ${windowId} from data`);
  
  const win = windows.get(windowId);
  if (!win || win.isDestroyed()) {
    return { success: false, message: `Window ${windowId} not found` };
  }
  
  try {
    const { windowConfig } = windowData;
    
    // Update basic properties
    if (windowConfig.title) {
      win.setTitle(windowConfig.title);
    }
    
    if (windowConfig.bounds) {
      win.setBounds(windowConfig.bounds);
    }
    
    if (windowConfig.properties) {
      const props = windowConfig.properties;
      
      if (typeof props.resizable === 'boolean') {
        win.setResizable(props.resizable);
      }
      
      if (typeof props.alwaysOnTop === 'boolean') {
        win.setAlwaysOnTop(props.alwaysOnTop);
      }
      
      if (typeof props.opacity === 'number' && win.setOpacity) {
        win.setOpacity(props.opacity);
      }
    }
    
    console.log(`[WINDOW] Successfully updated window ${windowId} from data`);
    return { success: true, message: `Window ${windowId} updated successfully` };
    
  } catch (error) {
    console.error(`[WINDOW] Error updating window from data:`, error);
    return { success: false, message: `Update failed: ${error.message}` };
  }
}