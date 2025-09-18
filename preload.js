import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
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
