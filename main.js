import { app, BrowserWindow, ipcMain, dialog} from 'electron';
import { Worker } from 'worker_threads';
import path from 'node:path';
import url from 'node:url';

// 全局变量
// console.log('[MAIN] 初始化应用程序...');
const isMac = process.platform === 'darwin';
// console.log(`[MAIN] 运行平台: ${process.platform}, isMac: ${isMac}`);
const windows = new Map(); // id -> BrowserWindow
// console.log('[MAIN] 窗口映射已初始化');
let overlapTimer = null;
let level1Completed = false;

const worker = new Worker(new URL('./nodeWorker.mjs', import.meta.url));

// Worker message handler
worker.on('message', (msg) => {
  console.log('Received message from worker thread:', msg);
  
  if (msg.type === 'overlapResult') {
    console.log(`[WORKER] 重叠比例: ${msg.ratio.toFixed(4)}`);
    
    if (msg.ratio >= msg.threshold && !level1Completed) {
      console.log('[LEVEL1] 重叠比例达到要求！开始解锁门...');
      level1Completed = true;
      
      const doorWin = windows.get('door');
      if (doorWin) {
        doorWin.setTitle('Door (opened)');
      }
      
      console.log('[LEVEL1] door.open (overlap >= 0.6)');
      
      const anyWin = windows.values().next().value;
      dialog.showMessageBox(anyWin ?? null, { 
        type: 'info', 
        message: 'LEVEL 1 PASSED: Door opened!' 
      }).then(() => {
        // 成功对话框已关闭
      });
    }
  }
});


function createWindow(id, opts = {}) {

  // console.log(`[WINDOW] 开始创建窗口 ID: ${id}`);
  console.log(`[WINDOW] 窗口配置:`, { 
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
  
  // console.log(`[WINDOW] BrowserWindow已创建，ID: ${id}, webContentsId: ${win.webContents.id}`);
  
  const q = new url.URLSearchParams({ id });
  const htmlPath = path.join(process.cwd(), 'renderer', 'index.html');
  // console.log(`[WINDOW] 加载HTML文件: ${htmlPath}?${q.toString()}`);
  win.loadFile(htmlPath, { query: q.toString() });
  
  win.on('closed', () => {
    // console.log(`[WINDOW] 窗口关闭事件触发, ID: ${id}`);
    windows.delete(id);
    console.log(`[WINDOW] 从窗口映射中移除 ID: ${id}, 剩余窗口数量: ${windows.size}`);
    
    // 关卡 1：video 关闭后触发生成 door/key
    if (id === 'video' && !level1Completed) {
      // console.log('[GAME] 视频窗口关闭，触发关卡1逻辑');
      if (!windows.has('door')) {
        // console.log('[GAME] 创建门窗口');
        createDoor();
      } else {
        // console.log('[GAME] 门窗口已存在，跳过创建');
      }
      if (!windows.has('key')) {
        // console.log('[GAME] 创建钥匙窗口');
        createKey();
      } else {
        // console.log('[GAME] 钥匙窗口已存在，跳过创建');
      }
    }
  });
  
  win.on('ready-to-show', () => {
    // console.log(`[WINDOW] 窗口准备显示, ID: ${id}`);
  });
  
  win.on('moved', () => {
    const bounds = win.getBounds();
    // console.log(`[WINDOW] 窗口移动, ID: ${id}, 新位置: (${bounds.x}, ${bounds.y})`);
  });
  
  win.on('resized', () => {
    const bounds = win.getBounds();
    // console.log(`[WINDOW] 窗口调整大小, ID: ${id}, 新尺寸: ${bounds.width}x${bounds.height}`);
  });
  
  windows.set(id, win);
  // console.log(`[WINDOW] 窗口已添加到映射, ID: ${id}, 总窗口数: ${windows.size}`);
  
  return win;
}

function createDesktop() {
  console.log('[WINDOW] 创建桌面窗口');
  const win = createWindow('desktop', { width: 1200, height: 800, title: 'Desktop' });
  console.log('[WINDOW] 桌面窗口创建完成');
  return win;
}

function createVideo() {
  console.log('[WINDOW] 创建视频窗口');
  const win = createWindow('video', { width: 640, height: 360, x: 100, y: 120, title: 'Training Video' });
  console.log('[WINDOW] 视频窗口创建完成');
  return win;
}

function createDoor() {
  console.log('[WINDOW] 创建门窗口（锁定状态）');
  const win = createWindow('door', { width: 320, height: 420, x: 900, y: 280, title: 'Door (locked)' });
  console.log('[WINDOW] 门窗口创建完成');
  return win;
}

function createKey(encrypt = false) {
  console.log('[WINDOW] 创建钥匙窗口');
  const win = createWindow('key', { width: 200, height: 200, x: 600, y: 280, title: 'Key' });
  console.log('[WINDOW] 钥匙窗口创建完成');
  return win;
}

function getBounds(id) {
  // console.log(`[BOUNDS] 获取窗口边界, ID: ${id}`);
  const w = windows.get(id);
  if (w) {
    const bounds = w.getBounds();
    console.log(`[BOUNDS] 获取成功, ID: ${id}, 边界:`, bounds);
    return bounds;
  } else {
    console.log(`[BOUNDS] 获取失败, 窗口不存在, ID: ${id}`);
    return null;
  }
}

function setBounds(id, b) {
  console.log(`[BOUNDS] 设置窗口边界, ID: ${id}, 新边界:`, b);
  const w = windows.get(id);
  if (w) {
    w.setBounds(b);
    console.log(`[BOUNDS] 设置成功, ID: ${id}`);
  } else {
    console.log(`[BOUNDS] 设置失败, 窗口不存在, ID: ${id}`);
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
    if (level1Completed) {
      return;
    }
    
    // 获取窗口边界数据
    const door = getBounds('door');
    const key = getBounds('key');
    
    if (!door || !key) {
      return;
    }
    
    // 发送数据到 Worker 进行重叠计算
    worker.postMessage({ 
      type: 'calculateOverlap',
      doorBounds: door,
      keyBounds: key,
      threshold: 0.6
    });
  }, 100);
  
  // console.log('[OVERLAP] 重叠检测循环已启动');
}

app.whenReady().then(() => {
  // console.log('[APP] Electron应用程序准备就绪');
  console.log('[APP] 开始创建初始窗口...');
  
  createDesktop();
  createVideo();
  startOverlapLoop();
  
  // console.log('[APP] 初始窗口创建完成，重叠检测已启动');

  app.on('activate', () => {
    console.log('[APP] 应用程序激活事件触发');
    const allWindows = BrowserWindow.getAllWindows();
    console.log(`[APP] 当前窗口数量: ${allWindows.length}`);
    
    if (allWindows.length === 0) {
      // console.log('[APP] 没有窗口存在，重新创建初始窗口');
      createDesktop();
      createVideo();
    } else {
      // console.log('[APP] 窗口已存在，不需要重新创建');
    }
  });
  
  // console.log('[APP] 激活事件监听器已设置');
});

app.on('window-all-closed', () => {
  console.log('[APP] 所有窗口已关闭');
  if (!isMac) {
    console.log('[APP] 非macOS平台，退出应用程序');
    app.quit();
  } else {
    console.log('[APP] macOS平台，应用程序保持运行');
  }
});


// IPC: 最小集合
console.log('[IPC] 设置IPC处理程序...');

ipcMain.handle('game/window/create', (_e, payload) => {
  console.log('[IPC] 收到创建窗口请求:', payload);
  const { id, bounds = {}, title } = payload ?? {};
  
  if (!id) {
    console.log('[IPC] 错误: 缺少窗口ID');
    return { error: 'id required' };
  }
  
  console.log(`[IPC] 开始创建窗口, ID: ${id}`);
  const win = createWindow(id, { ...bounds, title });
  const response = { ok: true, id, webContentsId: win.webContents.id };
  
  console.log('[IPC] 窗口创建响应:', response);
  return response;
});

ipcMain.handle('game/window/set-bounds', (_e, { id, bounds }) => {
  console.log(`[IPC] 收到设置边界请求, ID: ${id}, 边界:`, bounds);
  
  if (!id || !bounds) {
    console.log('[IPC] 错误: 缺少ID或边界参数');
    return { error: 'id & bounds required' };
  }
  
  setBounds(id, bounds);
  const response = { ok: true };
  
  console.log('[IPC] 设置边界响应:', response);
  return response;
});

ipcMain.handle('game/window/get-bounds', (_e, { id }) => {
  console.log(`[IPC] 收到获取边界请求, ID: ${id}`);
  
  const b = getBounds(id);
  const response = b ? { ok: true, bounds: b } : { error: 'not found' };
  
  console.log('[IPC] 获取边界响应:', response);
  return response;
});

console.log('[IPC] 所有IPC处理程序已设置完成');
