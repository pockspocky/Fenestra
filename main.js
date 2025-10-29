/**
 * Fenestra - Window Puzzle Game
 * Version: 0.2.0
 * 
 * Features:
 * - Dynamic window management with smart positioning
 * - Lens system for visual decryption puzzles
 * - Door-key permission system with overlap detection
 * - Complete window storage and restoration system
 * - Interactive terminal with drag-drop support
 * - Multi-threaded overlap detection
 * - Comprehensive logging system
 */

import { app, BrowserWindow, globalShortcut } from 'electron';
import './logger.js'; // 导入日志系统
import { setLogLevel, getLogLevel } from './src/core/loggerConfig.js'; // 导入日志配置

// 导入核心模块
import {
  setWindowCloseCallback,
  createDesktop,
  createVideo,
  createTerminal,
  setWindowOffset,
  getWindowOffset,
  setKeyDoorMaxOverlap,
  getKeyDoorMaxOverlap
} from './src/core/windowManager.js';

import {
  initializeGameLogic,
  handleVideoWindowClosed,
  createDemoDoorsAndKeys,
  getGameState
} from './src/core/gameLogic.js';

import {
  initializeWorker,
  startOverlapLoop,
  cleanupWorker
} from './src/core/workerManager.js';

import {
  initializeIpcHandlers,
  cleanupIpcHandlers
} from './src/core/ipcHandlers.js';

import {
  getRelationsDebugInfo
} from './src/core/doorKeySystem.js';

// 设置日志级别
setLogLevel("debug"); // 可以根据需要调整
console.log(`[MAIN] 当前日志级别: ${getLogLevel()}`);

// 全局变量
console.debug('[MAIN] 初始化应用程序...');
const isMac = process.platform === 'darwin';
console.debug(`[MAIN] 运行平台: ${process.platform}, isMac: ${isMac}`);

// 设置窗口关闭回调
setWindowCloseCallback(handleVideoWindowClosed);

// 初始化所有核心系统
function initializeApp() {
  console.debug('[MAIN] 初始化应用程序核心系统...');

  // 设置窗口偏移量（每个新窗口向右下偏移30像素）
  setWindowOffset(30, 30);
  console.log(`[MAIN] 窗口偏移量设置:`, getWindowOffset());

  // 设置钥匙与门重叠的最大允许比例（40%）
  setKeyDoorMaxOverlap(0.4);
  console.log(`[MAIN] 钥匙与门最大重叠比例设置: ${(getKeyDoorMaxOverlap() * 100).toFixed(1)}%`);

  // 初始化游戏逻辑
  initializeGameLogic();

  // 初始化 Worker
  initializeWorker();

  // 初始化 IPC 处理程序
  initializeIpcHandlers();

  console.debug('[MAIN] 应用程序核心系统初始化完成');
}

// 启动应用
app.whenReady().then(() => {
  console.debug('[APP] Electron应用程序准备就绪');
  console.log('[APP] 开始创建初始窗口...');

  // 初始化应用
  initializeApp();

  // 创建初始窗口（可选）
  // createDesktop();
  // createVideo();

  // 启动重叠检测
  startOverlapLoop();

  // 添加示例门和钥匙来演示系统
  setTimeout(() => {
    createDemoDoorsAndKeys();
    console.debug('[DEMO] 关系映射:', getRelationsDebugInfo());
  }, 2000);

  // 设置应用事件监听器
  setupAppEventListeners();

  // 注册全局快捷键
  registerGlobalShortcuts();

  console.debug('[APP] 应用程序启动完成');
});

// 设置应用事件监听器
function setupAppEventListeners() {
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

  app.on('window-all-closed', () => {
    console.debug('[APP] 所有窗口已关闭');
    if (!isMac) {
      console.debug('[APP] 非macOS平台，退出应用程序');
      app.quit();
    } else {
      console.debug('[APP] macOS平台，应用程序保持运行');
    }
  });

  app.on('before-quit', () => {
    console.debug('[APP] 应用程序即将退出，清理资源...');

    // 注销全局快捷键
    globalShortcut.unregisterAll();

    // 清理 Worker
    cleanupWorker();

    // 清理 IPC 处理程序
    cleanupIpcHandlers();

    console.debug('[APP] 资源清理完成');
  });

  console.debug('[APP] 应用事件监听器已设置');
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  console.debug('[APP] 注册全局快捷键...');

  // 注册 Ctrl+~ (Mac 上是 Cmd+~) 来打开/关闭终端
  const shortcut = isMac ? 'Command+`' : 'Control+`';

  const registered = globalShortcut.register(shortcut, () => {
    console.log(`[APP] 终端快捷键被触发: ${shortcut}`);
    createTerminal();
  });

  if (registered) {
    console.log(`[APP] 全局快捷键注册成功: ${shortcut} (打开终端)`);
  } else {
    console.error(`[APP] 全局快捷键注册失败: ${shortcut}`);
  }
}

// 导出主要功能供外部使用（如果需要）
export {
  getGameState,
  getRelationsDebugInfo
};
