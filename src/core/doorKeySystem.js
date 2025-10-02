import { dialog } from 'electron';
import { getWindow } from './windowManager.js';

// 门钥匙关系管理系统
const doorKeyRelations = new Map(); // doorId -> Set of keyIds
const keyDoorRelations = new Map(); // keyId -> Set of doorIds
const encryptedItems = new Set(); // 存储加密的物品ID
const doorStates = new Map(); // doorId -> { isOpen: boolean, lastKeyUsed: string }

/**
 * 建立双向关系
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 */
export function establishRelation(doorId, keyId) {
  // door -> key 关系
  if (!doorKeyRelations.has(doorId)) {
    doorKeyRelations.set(doorId, new Set());
  }
  doorKeyRelations.get(doorId).add(keyId);
  
  // key -> door 关系
  if (!keyDoorRelations.has(keyId)) {
    keyDoorRelations.set(keyId, new Set());
  }
  keyDoorRelations.get(keyId).add(doorId);
}

/**
 * 检查开门权限
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 * @returns {boolean} 是否有权限开门
 */
export function canOpenDoor(doorId, keyId) {
  const isDoorEncrypted = encryptedItems.has(doorId);
  const isKeyEncrypted = encryptedItems.has(keyId);
  
  // 如果门没有加密，任何钥匙都可以打开
  if (!isDoorEncrypted) {
    return true;
  }
  
  // 如果门加密了，检查钥匙是否有权限
  if (isDoorEncrypted && isKeyEncrypted) {
    const authorizedKeys = doorKeyRelations.get(doorId);
    return authorizedKeys && authorizedKeys.has(keyId);
  }
  
  return false;
}

/**
 * 处理开门失败
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 */
export function handleFailedOpen(doorId, keyId) {
  // 弹出错误窗口
  const doorWin = getWindow(doorId);
  const keyWin = getWindow(keyId);
  
  if (doorWin) {
    dialog.showMessageBox(doorWin, {
      type: 'error',
      title: '开门失败',
      message: '这把钥匙无法打开这扇门！',
      detail: '钥匙和门不匹配，或者权限不足。'
    });
  }
  
  // 分离钥匙和门（将钥匙移动到远离门的位置）
  if (doorWin && keyWin) {
    bounceKeyAway(keyWin, doorWin, keyId, doorId);
    console.log(`[SEPARATE] 钥匙 ${keyId} 已从门 ${doorId} 分离`);
  }
}

/**
 * 钥匙弹开函数
 * @param {BrowserWindow} keyWin - 钥匙窗口
 * @param {BrowserWindow} doorWin - 门窗口
 * @param {string} keyId - 钥匙ID
 * @param {string} doorId - 门ID
 */
function bounceKeyAway(keyWin, doorWin, keyId, doorId) {
  const doorBounds = doorWin.getBounds();
  const keyBounds = keyWin.getBounds();
  
  // 计算弹开方向（钥匙相对于门的位置）
  const keyCenterX = keyBounds.x + keyBounds.width / 2;
  const doorCenterX = doorBounds.x + doorBounds.width / 2;
  
  let newKeyX, newKeyY;
  
  if (keyCenterX < doorCenterX) {
    // 钥匙在门左侧，弹到更左边
    newKeyX = doorBounds.x - 300 + Math.random() * 100;
  } else {
    // 钥匙在门右侧，弹到更右边
    newKeyX = doorBounds.x + doorBounds.width + 50;
  }
  
  newKeyY = doorBounds.y + Math.random() * 100; // 随机垂直位置
  
  // 平滑移动动画
  animateKeyMovement(keyWin, newKeyX, newKeyY);
  
  console.log(`[BOUNCE] 钥匙 ${keyId} 从门 ${doorId} 弹开到 (${newKeyX}, ${newKeyY})`);
}

/**
 * 钥匙移动动画
 * @param {BrowserWindow} keyWin - 钥匙窗口
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 */
function animateKeyMovement(keyWin, targetX, targetY) {
  const startBounds = keyWin.getBounds();
  const startX = startBounds.x;
  const startY = startBounds.y;
  
  const distance = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
  const duration = Math.min(distance / 5, 300); // 最大300ms
  const steps = Math.ceil(duration / 16); // 60fps
  
  let currentStep = 0;
  
  const animate = () => {
    currentStep++;
    const progress = currentStep / steps;
    
    // 使用缓动函数
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    const currentX = startX + (targetX - startX) * easeProgress;
    const currentY = startY + (targetY - startY) * easeProgress;
    
    keyWin.setBounds({
      x: currentX,
      y: currentY,
      width: 200,
      height: 200
    });
    
    if (currentStep < steps) {
      setTimeout(animate, 16);
    }
  };
  
  animate();
}

/**
 * 处理门的开关切换
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 */
export function handleDoorToggle(doorId, keyId) {
  const doorWin = getWindow(doorId);
  const keyWin = getWindow(keyId);
  
  if (!doorWin) return;
  
  const currentTitle = doorWin.getTitle();
  const isCurrentlyOpen = currentTitle.includes('(opened)');

  // 钥匙弹开
  if (keyWin) {
    bounceKeyAway(keyWin, doorWin, keyId, doorId);
  }
  
  if (!isCurrentlyOpen) {
    // 开门
    doorWin.setTitle(currentTitle.replace('(locked)', '(opened)').replace('(encrypted)', '(opened)'));
    
    // 更新状态
    doorStates.set(doorId, { isOpen: true, lastKeyUsed: keyId });
    
    dialog.showMessageBox(doorWin, { 
      type: 'info', 
      message: 'Door opened!' 
    }).then(() => {
      // 成功对话框已关闭
    });

    console.log(`[DOOR] ${doorId} 已打开`);
  } else {
    // 关门
    doorWin.setTitle(currentTitle.replace('(opened)', '(locked)').replace('(opened)', '(encrypted)'));
    doorStates.set(doorId, { isOpen: false, lastKeyUsed: keyId });
    dialog.showMessageBox(doorWin, {
      type: 'info',
      message: 'Door closed!'
    });
    console.log(`[DOOR] ${doorId} 已关闭`);
  }
}

/**
 * 添加加密物品
 * @param {string} itemId - 物品ID
 */
export function addEncryptedItem(itemId) {
  encryptedItems.add(itemId);
}

/**
 * 初始化门的关系映射
 * @param {string} doorId - 门ID
 */
export function initializeDoorRelation(doorId) {
  if (!doorKeyRelations.has(doorId)) {
    doorKeyRelations.set(doorId, new Set());
  }
}

/**
 * 初始化钥匙的关系映射
 * @param {string} keyId - 钥匙ID
 * @param {Array} relatedDoors - 关联的门ID数组
 */
export function initializeKeyRelation(keyId, relatedDoors = []) {
  if (!keyDoorRelations.has(keyId)) {
    keyDoorRelations.set(keyId, new Set());
  }
  
  // 建立双向关系
  relatedDoors.forEach(doorId => {
    establishRelation(doorId, keyId);
  });
}

/**
 * 获取门状态
 * @param {string} doorId - 门ID
 * @returns {Object|null} 门状态或null
 */
export function getDoorState(doorId) {
  return doorStates.get(doorId);
}

/**
 * 获取所有关系映射（用于调试）
 * @returns {Object} 关系映射对象
 */
export function getRelationsDebugInfo() {
  return {
    doorKeyRelations: Object.fromEntries(doorKeyRelations),
    keyDoorRelations: Object.fromEntries(keyDoorRelations),
    encryptedItems: Array.from(encryptedItems),
    doorStates: Object.fromEntries(doorStates)
  };
}

