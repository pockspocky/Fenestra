import { app, BrowserWindow, ipcMain, dialog} from 'electron';
import { Worker } from 'worker_threads';
import path from 'node:path';
import url from 'node:url';
import './logger.js'; // 导入日志系统

// 设置日志级别
// global.logLevel = "info"; // 可以改为 "log", "warn", "error", "none"

// 全局变量
console.debug('[MAIN] 初始化应用程序...');
const isMac = process.platform === 'darwin';
console.debug(`[MAIN] 运行平台: ${process.platform}, isMac: ${isMac}`);
const windows = new Map(); // id -> BrowserWindow
console.debug('[MAIN] 窗口映射已初始化');
let overlapTimer = null;
let level1Completed = false;

const worker = new Worker(new URL('./nodeWorker.mjs', import.meta.url));

// 门钥匙关系管理系统
const doorKeyRelations = new Map(); // doorId -> Set of keyIds
const keyDoorRelations = new Map(); // keyId -> Set of doorIds
const encryptedItems = new Set(); // 存储加密的物品ID
const doorStates = new Map(); // doorId -> { isOpen: boolean, lastKeyUsed: string }

// 建立双向关系的辅助函数
function establishRelation(doorId, keyId) {
  // door -> key 关系
  if (!doorKeyRelations.has(doorId)) {
    doorKeyRelations.set(doorId, new Set());
  }
  doorKeyRelations.get(doorId).add(keyId);
  
  // key -> door 关系
  if (!keyDoorRelations.has(keyId)) {
    keyDoorRelations.set(keyId, new Set());
  }
  keyDoorRelations.get(keyId).add(doorId);
}

// 检查开门权限的函数
function canOpenDoor(doorId, keyId) {
  const isDoorEncrypted = encryptedItems.has(doorId);
  const isKeyEncrypted = encryptedItems.has(keyId);
  
  // 如果门没有加密，任何钥匙都可以打开
  if (!isDoorEncrypted) {
    return true;
  }
  
  // 如果门加密了，检查钥匙是否有权限
  if (isDoorEncrypted && isKeyEncrypted) {
    const authorizedKeys = doorKeyRelations.get(doorId);
    return authorizedKeys && authorizedKeys.has(keyId);
  }
  
  return false;
}

// 处理开门失败
function handleFailedOpen(doorId, keyId) {
  // 弹出错误窗口
  const doorWin = windows.get(doorId);
  const keyWin = windows.get(keyId);
  
  if (doorWin) {
    dialog.showMessageBox(doorWin, {
      type: 'error',
      title: '开门失败',
      message: '这把钥匙无法打开这扇门！',
      detail: '钥匙和门不匹配，或者权限不足。'
    });
  }
  
  // 分离钥匙和门（将钥匙移动到远离门的位置）
  if (doorWin && keyWin) {
    bounceKeyAway(keyWin, doorWin, keyId, doorId);

    console.log(`[SEPARATE] 钥匙 ${keyId} 已从门 ${doorId} 分离`);
  }
}

// 钥匙弹开函数
function bounceKeyAway(keyWin, doorWin, keyId, doorId) {
  const doorBounds = doorWin.getBounds();
  const keyBounds = keyWin.getBounds();
  
  // 计算弹开方向（钥匙相对于门的位置）
  const keyCenterX = keyBounds.x + keyBounds.width / 2;
  const doorCenterX = doorBounds.x + doorBounds.width / 2;
  
  let newKeyX, newKeyY;
  
  if (keyCenterX < doorCenterX) {
    // 钥匙在门左侧，弹到更左边
    newKeyX = doorBounds.x - 300 + Math.random() * 100;
  } else {
    // 钥匙在门右侧，弹到更右边
    newKeyX = doorBounds.x + doorBounds.width + 50;
  }
  
  newKeyY = doorBounds.y + Math.random() * 100; // 随机垂直位置
  
  // 平滑移动动画
  animateKeyMovement(keyWin, newKeyX, newKeyY);
  
  console.log(`[BOUNCE] 钥匙 ${keyId} 从门 ${doorId} 弹开到 (${newKeyX}, ${newKeyY})`);
}

// 钥匙移动动画
function animateKeyMovement(keyWin, targetX, targetY) {
  const startBounds = keyWin.getBounds();
  const startX = startBounds.x;
  const startY = startBounds.y;
  
  const distance = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
  const duration = Math.min(distance / 5, 300); // 最大300ms
  const steps = Math.ceil(duration / 16); // 60fps
  
  let currentStep = 0;
  
  const animate = () => {
    currentStep++;
    const progress = currentStep / steps;
    
    // 使用缓动函数
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    const currentX = startX + (targetX - startX) * easeProgress;
    const currentY = startY + (targetY - startY) * easeProgress;
    
    keyWin.setBounds({
      x: currentX,
      y: currentY,
      width: 200,
      height: 200
    });
    
    if (currentStep < steps) {
      setTimeout(animate, 16);
    }
  };
  
  animate();
}

// 处理门的开关切换
function handleDoorToggle(doorId, keyId) {
  const doorWin = windows.get(doorId);
  const keyWin = windows.get(keyId);
  
  if (!doorWin) return;
  
  const currentTitle = doorWin.getTitle();
  const isCurrentlyOpen = currentTitle.includes('(opened)');

  // 钥匙弹开
  if (keyWin) {
    bounceKeyAway(keyWin, doorWin, keyId, doorId);
  }
  
  if (!isCurrentlyOpen) {
    // 开门
    doorWin.setTitle(currentTitle.replace('(locked)', '(opened)').replace('(encrypted)', '(opened)'));
    
    // 更新状态
    doorStates.set(doorId, { isOpen: true, lastKeyUsed: keyId });
    
    // 只在第一次开门时显示成功对话框

    dialog.showMessageBox(doorWin, { 
      type: 'info', 
      message: 'Door opened!' 
    }).then(() => {
      // 成功对话框已关闭
    });

    console.log(`[DOOR] ${doorId} 已打开`);
  } else {
    // 关门
    doorWin.setTitle(currentTitle.replace('(opened)', '(locked)').replace('(opened)', '(encrypted)'));
    doorStates.set(doorId, { isOpen: false, lastKeyUsed: keyId });
    dialog.showMessageBox(doorWin, {
      type: 'info',
      message: 'Door closed!'
    });
    console.log(`[DOOR] ${doorId} 已关闭`);
  }

}

// Worker message handler
worker.on('message', (msg) => {
  console.debug('Received message from worker thread:', msg);
  
  if (msg.type === 'overlapResult') {
    const { ratio, doorId, keyId, threshold } = msg;
    console.debug(`[WORKER] 重叠比例: ${ratio.toFixed(4)}`);
    
    if (ratio >= threshold) {
      // 检查开门权限
      if (canOpenDoor(doorId, keyId)) {
        console.log(`[LEVEL1] ${keyId} 与 ${doorId} 重叠，尝试开关门...`);
        handleDoorToggle(doorId, keyId);
      } else {
        console.warn(`[LEVEL1] ${keyId} 无法打开 ${doorId}（权限不足）`);
        handleFailedOpen(doorId, keyId);
      }
    }
  }
});


function createWindow(id, opts = {}) {

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
  
  win.on('closed', () => {
    console.debug(`[WINDOW] 窗口关闭事件触发, ID: ${id}`);
    windows.delete(id);
    console.log(`[WINDOW] 从窗口映射中移除 ID: ${id}, 剩余窗口数量: ${windows.size}`);
    
      // 关卡 1：video 关闭后触发生成 door/key
      if (id === 'video' && !level1Completed) {
        console.log('[GAME] 视频窗口关闭，触发关卡1逻辑');
        if (!windows.has('door1')) {
          console.debug('[GAME] 创建门窗口');
          createDoor('door1', 'Main Door', false);
        } else {
          console.debug('[GAME] 门窗口已存在，跳过创建');
        }
        if (!windows.has('key1')) {
          console.debug('[GAME] 创建钥匙窗口');
          createKey('key1', 'Master Key', false);
        } else {
          console.debug('[GAME] 钥匙窗口已存在，跳过创建');
        }
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
  
  windows.set(id, win);
  console.debug(`[WINDOW] 窗口已添加到映射, ID: ${id}, 总窗口数: ${windows.size}`);
  
  return win;
}

function createDesktop() {
  console.debug('[WINDOW] 创建桌面窗口');
  const win = createWindow('desktop', { width: 1200, height: 800, title: 'Desktop' });
  console.debug('[WINDOW] 桌面窗口创建完成');
  return win;
}

function createVideo() {
  console.debug('[WINDOW] 创建视频窗口');
  const win = createWindow('video', { width: 640, height: 360, x: 100, y: 120, title: 'Training Video' });
  console.debug('[WINDOW] 视频窗口创建完成');
  return win;
}

function createDoor(doorId = 'door', title = null, encrypt = false) {
  const doorTitle = title || (encrypt ? `Door (encrypted)` : `Door (unlocked)`);
  console.log(`[WINDOW] 创建门窗口（${encrypt ? '加密' : '普通'}状态）`);
  
  const win = createWindow(doorId, { 
    width: 320, 
    height: 420, 
    x: 900, 
    y: 280, 
    title: doorTitle 
  });
  
  if (encrypt) {
    encryptedItems.add(doorId);
  }
  
  // 初始化关系映射
  if (!doorKeyRelations.has(doorId)) {
    doorKeyRelations.set(doorId, new Set());
  }
  
  console.debug('[WINDOW] 门窗口创建完成');
  return win;
}

function createKey(keyId = 'key', title = null, encrypt = false, relatedDoors = []) {
  const keyTitle = title || (encrypt ? `Key (encrypted)` : `Key (master)`);
  console.log(`[WINDOW] 创建钥匙窗口（${encrypt ? '加密' : '普通'}）`);
  
  const win = createWindow(keyId, { 
    width: 200, 
    height: 200, 
    x: 600, 
    y: 280, 
    title: keyTitle 
  });
  
  if (encrypt) {
    encryptedItems.add(keyId);
  }
  
  // 初始化关系映射
  if (!keyDoorRelations.has(keyId)) {
    keyDoorRelations.set(keyId, new Set());
  }
  
  // 建立双向关系
  relatedDoors.forEach(doorId => {
    establishRelation(doorId, keyId);
  });
  
  console.debug('[WINDOW] 钥匙窗口创建完成');
  return win;
}

function getBounds(id) {
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

function setBounds(id, b) {
  console.debug(`[BOUNDS] 设置窗口边界, ID: ${id}, 新边界:`, b);
  const w = windows.get(id);
  if (w) {
    w.setBounds(b);
    console.debug(`[BOUNDS] 设置成功, ID: ${id}`);
  } else {
    console.debug(`[BOUNDS] 设置失败, 窗口不存在, ID: ${id}`);
  }
}

// 重叠计算已移至 Worker 线程

function startOverlapLoop() {
  // console.log('[OVERLAP] 启动重叠检测循环');
  if (overlapTimer) {
    // console.log('[OVERLAP] 重叠检测循环已在运行，跳过启动');
    return;
  }
  
  // console.log('[OVERLAP] 设置定时器，每100ms检测一次');
  overlapTimer = setInterval(() => {
    // 移除 level1Completed 限制，允许重复开关门
    
    // 检查所有门和钥匙的重叠
    for (const [doorId, doorWin] of windows) {
      if (!doorId.startsWith('door')) continue;
      
      for (const [keyId, keyWin] of windows) {
        if (!keyId.startsWith('key')) continue;
        
        const doorBounds = doorWin.getBounds();
        const keyBounds = keyWin.getBounds();
        
        // 发送到 Worker 计算重叠
        worker.postMessage({ 
          type: 'calculateOverlap',
          doorBounds: doorBounds,
          keyBounds: keyBounds,
          doorId: doorId,
          keyId: keyId,
          threshold: 0.6
        });
      }
    }
  }, 1000);
  
  // console.log('[OVERLAP] 重叠检测循环已启动');
}

app.whenReady().then(() => {
  console.debug('[APP] Electron应用程序准备就绪');
  console.log('[APP] 开始创建初始窗口...');
  
  // createDesktop();
  // createVideo();
  startOverlapLoop();
  
  // 添加示例门和钥匙来演示系统
  setTimeout(() => {
    console.log('[DEMO] 创建演示门和钥匙...');
    
    // 创建加密门和对应的钥匙
    createDoor('door1', 'Main Door (locked)', false);
    createDoor('door2', 'Secret Room (locked)', true);
    createDoor('door3', 'Back Door (locked)', true);

    createKey('key2', 'Secret Key', true, ['door2']);
    
    // 创建另一把可以开多扇门的钥匙
    createKey('key3', 'Multi Key', true, ['door2', 'door3']); // 这把钥匙可以开 door2

    // establishRelation('door1', 'key3'); // 也可以开 door1
    
    console.log('[DEMO] 演示门和钥匙创建完成');
    console.debug('[DEMO] 关系映射:', {
      doorKeyRelations: Object.fromEntries(doorKeyRelations),
      keyDoorRelations: Object.fromEntries(keyDoorRelations),
      encryptedItems: Array.from(encryptedItems)
    });
  }, 2000);
  
  // console.log('[APP] 初始窗口创建完成，重叠检测已启动');

  app.on('activate', () => {
    console.debug('[APP] 应用程序激活事件触发');
    const allWindows = BrowserWindow.getAllWindows();
    console.debug(`[APP] 当前窗口数量: ${allWindows.length}`);
    
    if (allWindows.length === 0) {
      console.debug('[APP] 没有窗口存在，重新创建初始窗口');
      createDesktop();
      createVideo();
    } else {
      console.debug('[APP] 窗口已存在，不需要重新创建');
    }
  });
  
  console.debug('[APP] 激活事件监听器已设置');
});

app.on('window-all-closed', () => {
  console.debug('[APP] 所有窗口已关闭');
  if (!isMac) {
    console.debug('[APP] 非macOS平台，退出应用程序');
    app.quit();
  } else {
    console.debug('[APP] macOS平台，应用程序保持运行');
  }
});


// IPC: 最小集合
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

console.debug('[IPC] 所有IPC处理程序已设置完成');
