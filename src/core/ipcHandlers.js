import { ipcMain } from 'electron';
import { createWindow, setBounds, getBounds } from './windowManager.js';

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

  console.debug('[IPC] 所有IPC处理程序已设置完成');
}

/**
 * 清理 IPC 处理程序
 */
export function cleanupIpcHandlers() {
  // 移除所有 IPC 处理程序
  ipcMain.removeAllListeners('game/window/create');
  ipcMain.removeAllListeners('game/window/set-bounds');
  ipcMain.removeAllListeners('game/window/get-bounds');
  
  console.debug('[IPC] IPC处理程序已清理');
}

