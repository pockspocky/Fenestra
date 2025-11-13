const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] 预加载脚本开始执行');
console.log('[PRELOAD] 导入Electron模块完成');

const whitelist = [
  'game/window/create',
  'game/window/set-bounds',
  'game/window/get-bounds',
  'terminal/execute-command',
  'picture/load',
  'lens/get-position',
  'window/get-info',
  'terminal/get-file-completions',
  'terminal/get-current-directory',
  'terminal/change-directory',
  'terminal/list-directory',
  'terminal/get-working-directory',
  'storage/validate-fenestra-file',
  'email/get-list',
  'email/get-by-id',
  'email/mark-read',
  'email/get-inbox-path'
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

// 为终端窗口和图片窗口单独暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  executeTerminalCommand: (command, args) => {
    console.log(`[PRELOAD] 执行终端命令: ${command}, 参数:`, args);
    return ipcRenderer.invoke('terminal/execute-command', { command, args });
  },
  loadPicture: (imagePath) => {
    console.log(`[PRELOAD] 加载图片: ${imagePath}`);
    return ipcRenderer.invoke('picture/load', imagePath);
  },
  onPictureChange: (callback) => {
    ipcRenderer.on('picture-change', (_e, imagePath, fitMode) => {
      console.log(`[PRELOAD] 收到图片更改事件: ${imagePath}, ${fitMode}`);
      callback(imagePath, fitMode);
    });
  },
  onFitModeChange: (callback) => {
    ipcRenderer.on('fit-mode-change', (_e, fitMode) => {
      console.log(`[PRELOAD] 收到缩放模式更改事件: ${fitMode}`);
      callback(fitMode);
    });
  },
  // 镜头系统 API
  onUpdateBlur: (callback) => {
    ipcRenderer.on('update-blur', (_e, blurValue) => {
      console.log(`[PRELOAD] 收到模糊度更新事件: ${blurValue}`);
      callback(blurValue);
    });
  },
  onContentChange: (callback) => {
    ipcRenderer.on('content-change', (_e, data) => {
      console.log(`[PRELOAD] 收到内容更改事件:`, data);
      callback(data);
    });
  },
  onTargetWindowMove: (callback) => {
    ipcRenderer.on('target-window-move', (_e, data) => {
      console.log(`[PRELOAD] 收到目标窗口移动事件:`, data);
      callback(data);
    });
  },
  onLensPositionUpdate: (callback) => {
    ipcRenderer.on('lens-position-update', (_e, data) => {
      console.log(`[PRELOAD] 收到镜头位置更新事件:`, data);
      callback(data);
    });
  },
  // Window storage validation API
  validateFenestraFile: (filePath) => {
    console.log(`[PRELOAD] 验证.fenestra文件: ${filePath}`);
    return ipcRenderer.invoke('storage/validate-fenestra-file', filePath);
  },
  // File completion APIs
  getFileCompletions: (params) => {
    console.log(`[PRELOAD] 获取文件补全:`, params);
    return ipcRenderer.invoke('terminal/get-file-completions', params);
  },
  getCurrentDirectory: () => {
    console.log(`[PRELOAD] 获取当前工作目录`);
    return ipcRenderer.invoke('terminal/get-current-directory');
  },
  // Directory navigation APIs
  changeDirectory: (params) => {
    console.log(`[PRELOAD] 更改目录:`, params);
    return ipcRenderer.invoke('terminal/change-directory', params);
  },
  listDirectory: (params) => {
    console.log(`[PRELOAD] 列出目录内容:`, params);
    return ipcRenderer.invoke('terminal/list-directory', params);
  },
  getWorkingDirectory: () => {
    console.log(`[PRELOAD] 获取工作目录`);
    return ipcRenderer.invoke('terminal/get-working-directory');
  }
});

console.log('[PRELOAD] contextBridge API已暴露到渲染进程');
console.log('[PRELOAD] 预加载脚本执行完成');
