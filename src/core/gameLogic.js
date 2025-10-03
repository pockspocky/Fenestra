import { createDoor, createKey, getAllWindows } from './windowManager.js';
import { initializeDoorRelation, initializeKeyRelation, addEncryptedItem } from './doorKeySystem.js';
import '../../logger.js'; // 导入日志系统

// 游戏状态
let level1Completed = false;

/**
 * 初始化游戏逻辑
 */
export function initializeGameLogic() {
  console.log('[GAME] 游戏逻辑已初始化');
}

/**
 * 处理视频窗口关闭事件
 * @param {string} windowId - 窗口ID
 */
export function handleVideoWindowClosed(windowId) {
  if (windowId === 'video' && !level1Completed) {
    console.log('[GAME] 视频窗口关闭，触发关卡1逻辑');
    
    const windows = getAllWindows();
    
    if (!windows.has('door1')) {
      console.debug('[GAME] 创建门窗口');
      createDoor('door1', 'Main Door', false);
      initializeDoorRelation('door1');
    } else {
      console.debug('[GAME] 门窗口已存在，跳过创建');
    }
    
    if (!windows.has('key1')) {
      console.debug('[GAME] 创建钥匙窗口');
      createKey('key1', 'Master Key', false);
      initializeKeyRelation('key1');
    } else {
      console.debug('[GAME] 钥匙窗口已存在，跳过创建');
    }
  }
}

/**
 * 创建演示门和钥匙
 */
export function createDemoDoorsAndKeys() {
  console.log('[DEMO] 创建演示门和钥匙...');
  
  // 创建加密门和对应的钥匙
  createDoor('door1', 'Main Door (locked)', false);
  createDoor('door2', 'Secret Room (locked)', true);
  createDoor('door3', 'Back Door (locked)', true);

  // 初始化门关系
  initializeDoorRelation('door1');
  initializeDoorRelation('door2');
  initializeDoorRelation('door3');
  
  // 添加加密物品
  addEncryptedItem('door2');
  addEncryptedItem('door3');

  // 创建钥匙
  createKey('key2', 'Secret Key', true, ['door2']);
  createKey('key3', 'Multi Key', true, ['door2', 'door3']);
  
  // 初始化钥匙关系
  initializeKeyRelation('key2', ['door2']);
  initializeKeyRelation('key3', ['door2', 'door3']);
  addEncryptedItem('key2');
  addEncryptedItem('key3');
  
  console.log('[DEMO] 演示门和钥匙创建完成');
}

/**
 * 获取关卡1完成状态
 * @returns {boolean} 是否完成
 */
export function isLevel1Completed() {
  return level1Completed;
}

/**
 * 设置关卡1完成状态
 * @param {boolean} completed - 是否完成
 */
export function setLevel1Completed(completed) {
  level1Completed = completed;
}

/**
 * 重置游戏状态
 */
export function resetGameState() {
  level1Completed = false;
  console.log('[GAME] 游戏状态已重置');
}

/**
 * 获取游戏状态信息
 * @returns {Object} 游戏状态
 */
export function getGameState() {
  return {
    level1Completed,
    windowsCount: getAllWindows().size
  };
}

