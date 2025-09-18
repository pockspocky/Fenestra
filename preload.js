const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 窗口控制API
  minimize: () => ipcRenderer.invoke('win/minimize'),
  maximizeToggle: () => ipcRenderer.invoke('win/maximizeToggle'),
  close: () => ipcRenderer.invoke('win/close'),
  getTitle: () => ipcRenderer.invoke('win/getTitle'),
  
  // 游戏相关API
  invoke: (channel, payload) => {
    const whitelist = [
      'game/window/create',
      'game/window/set-bounds',
      'game/window/get-bounds'
    ];
    if (!whitelist.includes(channel)) throw new Error('Blocked channel: ' + channel);
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, cb) => {
    ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  }
});
