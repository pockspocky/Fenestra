import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import url from 'node:url';

const isMac = process.platform === 'darwin';
const windows = new Map(); // id -> BrowserWindow
let overlapTimer = null;
let level1Completed = false;

function createWindow(id, opts = {}) {
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
  const q = new url.URLSearchParams({ id });
  win.loadFile(path.join(process.cwd(), 'renderer', 'index.html'), { query: q.toString() });
  win.on('closed', () => {
    windows.delete(id);
    // 关卡 1：video 关闭后触发生成 door/key
    if (id === 'video' && !level1Completed) {
      if (!windows.has('door')) createDoor();
      if (!windows.has('key')) createKey();
    }
  });
  windows.set(id, win);
  return win;
}

function createDesktop() {
  const win = createWindow('desktop', { width: 1200, height: 800, title: 'Desktop' });
  return win;
}
function createVideo() {
  return createWindow('video', { width: 640, height: 360, x: 100, y: 120, title: 'Training Video' });
}
function createDoor() {
  return createWindow('door', { width: 320, height: 420, x: 900, y: 280, title: 'Door (locked)' });
}
function createKey() {
  return createWindow('key', { width: 200, height: 200, x: 600, y: 280, title: 'Key' });
}

function getBounds(id) {
  const w = windows.get(id);
  return w ? w.getBounds() : null;
}
function setBounds(id, b) {
  const w = windows.get(id);
  if (w) w.setBounds(b);
}

function rectOverlapRatio(a, b) {
  // a,b: {x,y,width,height}
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return interArea / Math.max(1, minArea);
}

function startOverlapLoop() {
  if (overlapTimer) return;
  overlapTimer = setInterval(() => {
    if (level1Completed) return;
    const door = getBounds('door');
    const key = getBounds('key');
    if (!door || !key) return;
    const ratio = rectOverlapRatio(door, key);
    if (ratio >= 0.6) {
      level1Completed = true;
      const doorWin = windows.get('door');
      if (doorWin) doorWin.setTitle('Door (opened)');
      console.log('[LEVEL1] door.open (overlap >= 0.6)');
      const anyWin = windows.values().next().value;
      dialog.showMessageBox(anyWin ?? null, { type: 'info', message: 'LEVEL 1 PASSED: Door opened!' });
    }
  }, 100);
}

app.whenReady().then(() => {
  createDesktop();
  createVideo();
  startOverlapLoop();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDesktop();
      createVideo();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

// IPC: 最小集合
ipcMain.handle('game/window/create', (_e, payload) => {
  const { id, bounds = {}, title } = payload ?? {};
  if (!id) return { error: 'id required' };
  const win = createWindow(id, { ...bounds, title });
  return { ok: true, id, webContentsId: win.webContents.id };
});
ipcMain.handle('game/window/set-bounds', (_e, { id, bounds }) => {
  if (!id || !bounds) return { error: 'id & bounds required' };
  setBounds(id, bounds);
  return { ok: true };
});
ipcMain.handle('game/window/get-bounds', (_e, { id }) => {
  const b = getBounds(id);
  return b ? { ok: true, bounds: b } : { error: 'not found' };
});
