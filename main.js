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

import {
  initializeEmailSystem,
  toggleEmailWindow,
  cleanupEmailSystem
} from './src/core/emailSystem.js';

import {
  createStartMenu,
  setGameStartedCallback
} from './src/core/startMenuManager.js';

import {
  saveGameState
} from './src/core/gameStateManager.js';

import {
  registerGameHotkeys,
  unregisterGameHotkeys
} from './src/core/hotkeyManager.js';

// 设置日志级别
setLogLevel("log"); // 可以根据需要调整
console.log(`[MAIN] 当前日志级别: ${getLogLevel()}`);

// 全局变量
console.debug('[MAIN] 初始化应用程序...');
const isMac = process.platform === 'darwin';
console.debug(`[MAIN] 运行平台: ${process.platform}, isMac: ${isMac}`);

// Track whether a game has been started (not just on start menu)
let gameStarted = false;

export function isGameStarted() {
  return gameStarted;
}

// 设置窗口关闭回调
setWindowCloseCallback(handleVideoWindowClosed);

// 初始化所有核心系统
async function initializeApp() {
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

  // 初始化邮件系统
  const emailResult = await initializeEmailSystem();
  if (emailResult.success) {
    console.log('[MAIN] 邮件系统初始化成功', {
      inboxPath: emailResult.inboxPath,
      emailCount: emailResult.emailCount,
      hotkeyRegistered: emailResult.hotkeyRegistered
    });
  } else {
    console.error('[MAIN] 邮件系统初始化失败', { error: emailResult.error });
  }

  console.debug('[MAIN] 应用程序核心系统初始化完成');
}

// 启动应用
app.whenReady().then(async () => {
  console.debug('[APP] Electron应用程序准备就绪');
  console.log('[APP] 开始初始化应用...');

  // 初始化应用
  await initializeApp();

  // 启动重叠检测
  startOverlapLoop();

  // Set up callback to track when game starts
  setGameStartedCallback(() => {
    console.log('[APP] Game started, enabling auto-save on quit');
    gameStarted = true;
  });

  // 显示开始菜单而不是直接创建演示内容 (Requirement 2.1)
  console.log('[APP] 显示开始菜单...');
  await createStartMenu();

  // 设置应用事件监听器
  setupAppEventListeners();

  // 注册全局快捷键（终端和邮件）
  registerGlobalShortcuts();

  // 注册游戏热键（保存和退出） (Requirement 7.5, 8.3)
  console.log('[APP] 注册游戏热键...');
  const hotkeyResult = registerGameHotkeys();
  if (hotkeyResult.success) {
    console.log('[APP] 游戏热键注册成功:', hotkeyResult.registered);
    if (hotkeyResult.warnings.length > 0) {
      hotkeyResult.warnings.forEach(warning => console.warn(`[APP] ${warning}`));
    }
  } else {
    console.error('[APP] 游戏热键注册失败');
  }

  console.debug('[APP] 应用程序启动完成');
});

// 设置应用事件监听器
function setupAppEventListeners() {
  app.on('activate', () => {
    console.debug('[APP] 应用程序激活事件触发');
    const allWindows = BrowserWindow.getAllWindows();
    console.debug(`[APP] 当前窗口数量: ${allWindows.length}`);

    if (allWindows.length === 0) {
      console.debug('[APP] 没有窗口存在');
      // createDesktop();
      // createVideo();
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

  app.on('before-quit', async (event) => {
    console.debug('[APP] 应用程序即将退出，清理资源...');

    // 阻止默认退出行为，以便我们可以先保存游戏状态 (Requirement 8.2)
    event.preventDefault();

    try {
      // Only auto-save if game has been started (don't save empty state from start menu)
      if (gameStarted) {
        // 自动保存游戏状态 (Requirement 1.1, 8.2, 8.4)
        console.log('[APP] 自动保存游戏状态...');
        const saveResult = await saveGameState(null, { showNotification: false });
        
        if (saveResult.success) {
          console.log('[APP] 游戏状态保存成功', {
            windowCount: saveResult.windowCount,
            relationshipCount: saveResult.relationshipCount
          });
        } else {
          console.warn('[APP] 游戏状态保存失败:', saveResult.message);
        }
      } else {
        console.log('[APP] 游戏未开始，跳过保存');
      }
    } catch (error) {
      console.error('[APP] 保存游戏状态时发生错误:', error);
    }

    // 清理邮件系统
    await cleanupEmailSystem();

    // 注销游戏热键
    console.log('[APP] 注销游戏热键...');
    unregisterGameHotkeys();

    // 注销全局快捷键
    globalShortcut.unregisterAll();

    // 清理 Worker
    cleanupWorker();

    // 清理 IPC 处理程序
    cleanupIpcHandlers();

    console.debug('[APP] 资源清理完成');

    // 现在可以安全退出了
    app.exit(0);
  });

  console.debug('[APP] 应用事件监听器已设置');
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  console.debug('[APP] 注册全局快捷键...');

  // 注册 Ctrl+~ (Mac 上是 Cmd+~) 来打开/关闭终端
  const terminalShortcut = isMac ? 'Command+`' : 'Control+`';

  const terminalRegistered = globalShortcut.register(terminalShortcut, () => {
    console.log(`[APP] 终端快捷键被触发: ${terminalShortcut}`);
    createTerminal();
  });

  if (terminalRegistered) {
    console.log(`[APP] 全局快捷键注册成功: ${terminalShortcut} (打开终端)`);
  } else {
    console.error(`[APP] 全局快捷键注册失败: ${terminalShortcut}`);
  }

  // 注意: 邮件窗口快捷键 (Ctrl+E / Cmd+E) 在 initializeEmailSystem() 中注册
  const emailShortcut = isMac ? 'Command+E' : 'Control+E';
  console.log(`[APP] 邮件快捷键已在邮件系统初始化时注册: ${emailShortcut} (打开/关闭邮件)`);
}

// 导出主要功能供外部使用（如果需要）
export {
  getGameState,
  getRelationsDebugInfo
};
