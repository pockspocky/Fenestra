
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { Worker } from 'worker_threads';
import path from 'node:path';
import url from 'node:url';


console.log('[MAIN] 初始化应用程序...');
const isMac = process.platform === 'darwin';
console.log(`[MAIN] 运行平台: ${process.platform}, isMac: ${isMac}`);
const windows = new Map(); // id -> BrowserWindow
console.log('[MAIN] 窗口映射已初始化');
let overlapTimer = null;
let level1Completed = false;
console.log('[MAIN] 游戏状态已初始化: level1Completed =', level1Completed);

const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));

function generateRandomAlphanumericString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function createWindow(id, opts = {}) {

  console.log(`[WINDOW] 开始创建窗口 ID: ${id}`);
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
    frame: false,
    transparent: false,
    resizable: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }

  });
  
  console.log(`[WINDOW] BrowserWindow已创建，ID: ${id}, webContentsId: ${win.webContents.id}`);
  
  const q = new url.URLSearchParams({ id });
  const htmlPath = path.join(process.cwd(), 'renderer', 'index.html');
  console.log(`[WINDOW] 加载HTML文件: ${htmlPath}?${q.toString()}`);
  win.loadFile(htmlPath, { query: q.toString() });
  
  win.on('closed', () => {
    console.log(`[WINDOW] 窗口关闭事件触发, ID: ${id}`);
    windows.delete(id);
    console.log(`[WINDOW] 从窗口映射中移除 ID: ${id}, 剩余窗口数量: ${windows.size}`);
    
    // 关卡 1：video 关闭后触发生成 door/key
    if (id === 'video' && !level1Completed) {
      console.log('[GAME] 视频窗口关闭，触发关卡1逻辑');
      if (!windows.has('door')) {
        console.log('[GAME] 创建门窗口');
        createDoor();
      } else {
        console.log('[GAME] 门窗口已存在，跳过创建');
      }
      if (!windows.has('key')) {
        console.log('[GAME] 创建钥匙窗口');
        createKey();
      } else {
        console.log('[GAME] 钥匙窗口已存在，跳过创建');
      }
    }
  });
  
  win.on('ready-to-show', () => {
    console.log(`[WINDOW] 窗口准备显示, ID: ${id}`);
  });
  
  win.on('moved', () => {
    const bounds = win.getBounds();
    console.log(`[WINDOW] 窗口移动, ID: ${id}, 新位置: (${bounds.x}, ${bounds.y})`);
  });
  
  win.on('resized', () => {
    const bounds = win.getBounds();
    console.log(`[WINDOW] 窗口调整大小, ID: ${id}, 新尺寸: ${bounds.width}x${bounds.height}`);
  });
  
  windows.set(id, win);
  console.log(`[WINDOW] 窗口已添加到映射, ID: ${id}, 总窗口数: ${windows.size}`);
  
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
function createKey() {
  console.log('[WINDOW] 创建钥匙窗口');
  const win = createWindow('key', { width: 200, height: 200, x: 600, y: 280, title: 'Key' });
  console.log('[WINDOW] 钥匙窗口创建完成');
  return win;
}

function getBounds(id) {
  // console.log('[OVERLAP] 获取窗口边界, ID: ${id}`);
  const w = windows.get(id);
  if (w) {
    const bounds = w.getBounds();
    // console.log('[OVERLAP] 获取成功, ID: ${id}, 边界:`, bounds);
    return bounds;
  } else {
    // console.log('[OVERLAP] 获取失败, 窗口不存在, ID: ${id}`);
    return null;
  }
}
function setBounds(id, b) {
  // console.log('[OVERLAP] 设置窗口边界, ID: ${id}, 新边界:`, b);
  const w = windows.get(id);
  if (w) {
    w.setBounds(b);
    // console.log('[OVERLAP] 设置成功, ID: ${id}`);
  } else {
    // console.log('[OVERLAP] 设置失败, 窗口不存在, ID: ${id}`);
  }
}

function rectOverlapRatio(a, b) {
  // a,b: {x,y,width,height}
  console.log(`[OVERLAP] 计算重叠比例`);
  console.log(`[OVERLAP] 矩形A:`, a);
  console.log(`[OVERLAP] 矩形B:`, b);
  
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  
  console.log(`[OVERLAP] 交集区域: ${interW} x ${interH} = ${interArea}`);
  
  if (interArea <= 0) {
    console.log(`[OVERLAP] 无重叠, 比例: 0`);
    return 0;
  }
  
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  const ratio = interArea / Math.max(1, minArea);
  
  console.log(`[OVERLAP] 最小面积: ${minArea}, 重叠比例: ${ratio.toFixed(4)}`);
  return ratio;
}

function startOverlapLoop() {
  // console.log('[OVERLAP] 启动重叠检测循环');

  function Level1Completion() {
    if (level1Completed == true) {
      console.log('[GAME] 关卡1状态更新: level1Completed = true');

      const doorWin = windows.get('door');
      if (doorWin) {
        doorWin.setTitle('Door (opened)');
        console.log('[LEVEL1] 门窗口标题已更新为 "Door (opened)"');
      }

      console.log('[LEVEL1] door.open (overlap >= 0.6)');


      const anyWin = windows.values().next().value;
      console.log('[LEVEL1] 显示成功对话框');
      dialog.showMessageBox(anyWin ?? null, {
        type: 'info',
        message: 'LEVEL 1 PASSED: Door opened!'
      }).then(() => {
        console.log('[LEVEL1] 成功对话框已关闭');
      });
      clearInterval(overlapTimer);
      overlapTimer = null;
    }

  }
  
  if (overlapTimer) {
    // console.log('[OVERLAP] 重叠检测循环已在运行，跳过启动');
    return;
  }


  // console.log('[OVERLAP] 设置定时器，每100ms检测一次');
  overlapTimer = setInterval(() => {

    
    // worker.postMessage('Ping: Hello from main thread!');

    // if (level1Completed) {
    //   // console.log('[OVERLAP] 关卡1已完成，跳过检测');
    //   return;
    // }
    
    // console.log('[OVERLAP] 开始检测门和钥匙的重叠');
    const door = getBounds('door');
    const key = getBounds('key');
    
    if (!door || !key) {
      // console.log('[OVERLAP] 门或钥匙窗口不存在，跳过检测');
      return;
    }
    worker.postMessage({ win1: door, win2: key, ratio: 0.6 });

    Level1Completion();
  }, 200); // 200ms
  



  // console.log('[OVERLAP] 重叠检测循环已启动');
}

app.whenReady().then(() => {
  console.log('[APP] Electron应用程序准备就绪');
  console.log('[APP] 开始创建初始窗口...');

  worker.on('message', (msg) => {
    if (msg == true) {
      console.log('[LEVEL1] 重叠比例达到要求！开始解锁门...');
      level1Completed = true;
      worker.terminate();
    }
    else console.log(`[OVERLAP] 重叠比例: ${msg}, 需要: 0.6`);
  });
  
  createDesktop();
  createVideo();
  startOverlapLoop();
  
  console.log('[APP] 初始窗口创建完成，重叠检测已启动');

  app.on('activate', () => {
    console.log('[APP] 应用程序激活事件触发');
    const allWindows = BrowserWindow.getAllWindows();
    console.log(`[APP] 当前窗口数量: ${allWindows.length}`);
    
    if (allWindows.length === 0) {
      console.log('[APP] 没有窗口存在，重新创建初始窗口');
      createDesktop();
      createVideo();
    } else {
      console.log('[APP] 窗口已存在，不需要重新创建');
    }
  });
  
  console.log('[APP] 激活事件监听器已设置');
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
