const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] 预加载脚本开始执行');
console.log('[PRELOAD] 导入Electron模块完成');

const whitelist = [
  'game/window/create',
  'game/window/set-bounds',
  'game/window/get-bounds'
];

console.log('[PRELOAD] IPC白名单:', whitelist);

contextBridge.exposeInMainWorld('api', {
  // 窗口控制API
  minimize: () => ipcRenderer.invoke('win/minimize'),
  maximizeToggle: () => ipcRenderer.invoke('win/maximizeToggle'),
  close: () => ipcRenderer.invoke('win/close'),
  getTitle: () => ipcRenderer.invoke('win/getTitle'),
  
  // 游戏相关API
  invoke: (channel, payload) => {
    console.log(`[PRELOAD] IPC调用请求 - 频道: ${channel}`);
    console.log(`[PRELOAD] IPC调用载荷:`, payload);
    
    if (!whitelist.includes(channel)) {
      console.error(`[PRELOAD] 频道被阻止: ${channel}`);
      throw new Error('Blocked channel: ' + channel);
    }
    
    console.log(`[PRELOAD] 频道验证通过，转发到主进程: ${channel}`);
    
    const startTime = Date.now();
    return ipcRenderer.invoke(channel, payload).then(result => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[PRELOAD] IPC调用完成 - 频道: ${channel}, 耗时: ${duration}ms`);
      console.log(`[PRELOAD] IPC调用结果:`, result);
      return result;
    }).catch(error => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(`[PRELOAD] IPC调用失败 - 频道: ${channel}, 耗时: ${duration}ms`);
      console.error(`[PRELOAD] IPC错误:`, error);
      throw error;
    });
  },
  on: (channel, cb) => {
    console.log(`[PRELOAD] 设置IPC事件监听器 - 频道: ${channel}`);
    ipcRenderer.on(channel, (_e, ...args) => {
      console.log(`[PRELOAD] 接收到IPC事件 - 频道: ${channel}, 参数:`, args);
      cb(...args);
    });
    console.log(`[PRELOAD] IPC事件监听器已设置 - 频道: ${channel}`);
  }
});

console.log('[PRELOAD] contextBridge API已暴露到渲染进程');
console.log('[PRELOAD] 预加载脚本执行完成');
