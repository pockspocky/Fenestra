import { dialog } from 'electron';
import { getWindow } from './windowManager.js';
import '../../logger.js'; // 导入日志系统

// 门钥匙关系管理系统
const doorKeyRelations = new Map(); // doorId -> Set of keyIds
const keyDoorRelations = new Map(); // keyId -> Set of doorIds
const encryptedItems = new Set(); // 存储加密的物品ID
const doorStates = new Map(); // doorId -> { isOpen: boolean, lastKeyUsed: string }

// 消息配置系统
const globalMessages = new Map(); // messageType -> template
const doorMessages = new Map(); // doorId -> Map(messageType -> template)
const keyMessages = new Map(); // keyId -> Map(messageType -> template)

// 一次性钥匙系统
const oneTimeKeys = new Set(); // keyId - 配置为一次性使用的钥匙
const usedKeys = new Set(); // keyId - 已经使用过的钥匙
const closeAfterUse = new Set(); // keyId - 使用后应该关闭的钥匙

// 多钥匙门系统
const multiKeyDoors = new Map(); // doorId -> { requiredKeys: Array, timeoutDuration: number }

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
  // 首先检查钥匙是否可用（一次性钥匙使用状态检查）
  if (!isKeyUsable(keyId)) {
    console.log(`[DOOR_ACCESS] Key '${keyId}' is not usable (already used)`);
    return false;
  }
  
  // 检查是否为多钥匙门
  if (isMultiKeyDoor(doorId)) {
    const progress = getMultiKeyProgress(doorId);
    if (!progress) {
      console.log(`[MULTI_KEY] Could not get progress for multi-key door '${doorId}'`);
      return false;
    }
    
    // 检查是否已经完全解锁
    if (progress.isComplete) {
      console.log(`[MULTI_KEY] Door '${doorId}' is already fully unlocked`);
      return true;
    }
    
    // 检查是否是下一个需要的钥匙
    if (progress.nextKey !== keyId) {
      console.log(`[MULTI_KEY] Key '${keyId}' is not the next required key for door '${doorId}'. Expected: '${progress.nextKey}'`);
      return false;
    }
    
    console.log(`[MULTI_KEY] Key '${keyId}' is the correct next key for door '${doorId}' (${progress.progress + 1}/${progress.total})`);
    return true;
  }
  
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
    // 检查是否为多钥匙门，如果是则重置进度
    if (isMultiKeyDoor(doorId)) {
      const progress = getMultiKeyProgress(doorId);
      
      // 如果有进度，说明用户使用了错误的钥匙，需要重置
      if (progress && progress.progress > 0) {
        resetMultiKeyProgress(doorId);
        
        // 更新门标题移除进度指示
        const currentTitle = doorWin.getTitle();
        const baseTitle = currentTitle.replace(/\s*\([^)]*\)$/, ''); // 移除现有状态
        const resetTitle = `${baseTitle} (locked)`;
        doorWin.setTitle(resetTitle);
        
        // 显示序列重置消息
        const resetVariables = { doorId, keyId };
        const resetMessage = getFormattedMessage('sequence_reset', resetVariables, 'Wrong key! Sequence reset.');
        
        dialog.showMessageBox(doorWin, {
          type: 'warning',
          title: 'Multi-Key Sequence Reset',
          message: resetMessage,
          detail: `Key '${keyId}' is not the next required key. The sequence has been reset.`
        });
        
        console.log(`[MULTI_KEY] Wrong key '${keyId}' used on door '${doorId}', sequence reset`);
      } else {
        // 没有进度，显示标准错误消息
        const variables = { doorId, keyId, reason: 'not the first required key in sequence' };
        const accessDeniedMessage = getFormattedMessage('access_denied', variables, 'This key cannot open this door!');
        
        dialog.showMessageBox(doorWin, {
          type: 'error',
          title: 'Access Denied',
          message: accessDeniedMessage,
          detail: `This is a multi-key door. Expected first key: '${progress?.nextKey || 'unknown'}'`
        });
      }
    } else {
      // 普通门的错误处理
      // 确定拒绝原因
      const isDoorEncrypted = encryptedItems.has(doorId);
      const isKeyEncrypted = encryptedItems.has(keyId);
      let reason = 'insufficient permissions';
      
      if (!isDoorEncrypted) {
        reason = 'door is not encrypted but access still denied';
      } else if (!isKeyEncrypted) {
        reason = 'key is not encrypted for encrypted door';
      } else {
        const authorizedKeys = doorKeyRelations.get(doorId);
        if (!authorizedKeys || !authorizedKeys.has(keyId)) {
          reason = 'key is not authorized for this door';
        }
      }
      
      // 检查是否是已使用的一次性钥匙
      if (!isKeyUsable(keyId)) {
        reason = 'key has already been used and is no longer functional';
      }
      
      // 获取自定义访问拒绝消息
      const variables = { doorId, keyId, reason };
      const accessDeniedMessage = getFormattedMessage('access_denied', variables, 'This key cannot open this door!');
      
      dialog.showMessageBox(doorWin, {
        type: 'error',
        title: 'Access Denied',
        message: accessDeniedMessage,
        detail: 'The key and door do not match, or insufficient permissions.'
      });
    }
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
  const duration = Math.min(distance / 5, 1000); // 最大300ms
  const steps = Math.ceil(duration / 1); // 60fps
  
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
    // 检查是否为多钥匙门
    if (isMultiKeyDoor(doorId)) {
      const doorState = doorStates.get(doorId);
      const progress = getMultiKeyProgress(doorId);
      
      if (!progress) {
        console.error(`[MULTI_KEY] Could not get progress for door '${doorId}'`);
        return;
      }
      
      // 添加钥匙到已使用列表
      doorState.usedKeys.push(keyId);
      doorState.lastKeyUsed = keyId;
      
      // 启动或重新启动超时计时器
      startMultiKeyTimeout(doorId);
      
      // 检查是否完成序列
      if (doorState.usedKeys.length === doorState.requiredKeys.length) {
        // 序列完成，开门
        doorState.isOpen = true;
        
        // 清除超时
        if (doorState.timeoutId) {
          clearTimeout(doorState.timeoutId);
          doorState.timeoutId = null;
        }
        
        // 更新门标题
        doorWin.setTitle(currentTitle.replace('(locked)', '(opened)').replace('(encrypted)', '(opened)'));
        
        // 显示完成消息
        const completeVariables = { 
          doorId, 
          keyId, 
          progress: doorState.usedKeys.length, 
          total: doorState.requiredKeys.length 
        };
        const completeMessage = getFormattedMessage('sequence_complete', completeVariables, `All keys used! Door ${doorId} unlocked!`);
        
        dialog.showMessageBox(doorWin, {
          type: 'info',
          title: 'Multi-Key Door Unlocked',
          message: completeMessage
        });
        
        console.log(`[MULTI_KEY] Door '${doorId}' fully unlocked with all ${doorState.requiredKeys.length} keys`);
      } else {
        // 显示进度更新消息
        const nextProgress = getMultiKeyProgress(doorId);
        const progressVariables = { 
          doorId, 
          keyId, 
          progress: doorState.usedKeys.length, 
          total: doorState.requiredKeys.length,
          nextKey: nextProgress.nextKey || 'none'
        };
        const progressMessage = getFormattedMessage('progress_update', progressVariables, 
          `Key ${keyId} accepted. Need ${nextProgress.nextKey} next. (${doorState.usedKeys.length}/${doorState.requiredKeys.length})`);
        
        // 更新门标题显示进度
        const baseTitle = currentTitle.replace(/\s*\([^)]*\)$/, ''); // 移除现有状态
        const progressTitle = `${baseTitle} (${doorState.usedKeys.length}/${doorState.requiredKeys.length} keys)`;
        doorWin.setTitle(progressTitle);
        
        dialog.showMessageBox(doorWin, {
          type: 'info',
          title: 'Multi-Key Progress',
          message: progressMessage
        });
        
        console.log(`[MULTI_KEY] Door '${doorId}' progress: ${doorState.usedKeys.length}/${doorState.requiredKeys.length} keys used`);
      }
      
      // 处理一次性钥匙消费（多钥匙门也支持一次性钥匙）
      if (oneTimeKeys.has(keyId)) {
        usedKeys.add(keyId);
        console.log(`[ONE_TIME_KEY] Key '${keyId}' consumed and marked as used`);
        
        // 检查是否需要关闭钥匙窗口
        if (closeAfterUse.has(keyId) && keyWin) {
          const keyClosingVariables = { doorId, keyId };
          const keyClosingMessage = getFormattedMessage('key_closing', keyClosingVariables, `Key ${keyId} used successfully. Closing key window.`);
          
          // 延迟关闭，让用户先看到进度消息
          setTimeout(() => {
            dialog.showMessageBox(keyWin, {
              type: 'info',
              message: keyClosingMessage
            }).then(() => {
              keyWin.close();
              console.log(`[ONE_TIME_KEY] Key window '${keyId}' closed after use`);
            });
          }, 1000);
        }
      }
      
      return; // 多钥匙门处理完成
    }
    
    // 普通门开门逻辑
    doorWin.setTitle(currentTitle.replace('(locked)', '(opened)').replace('(encrypted)', '(opened)'));
    
    // 更新状态
    doorStates.set(doorId, { isOpen: true, lastKeyUsed: keyId });
    
    // 处理一次性钥匙消费
    if (oneTimeKeys.has(keyId)) {
      usedKeys.add(keyId);
      console.log(`[ONE_TIME_KEY] Key '${keyId}' consumed and marked as used`);
      
      // 显示钥匙消费消息
      const keyUsedVariables = { doorId, keyId };
      const keyUsedMessage = getFormattedMessage('key_used', keyUsedVariables, `Key ${keyId} consumed and can no longer be used.`);
      
      // 检查是否需要关闭钥匙窗口
      if (closeAfterUse.has(keyId) && keyWin) {
        const keyClosingVariables = { doorId, keyId };
        const keyClosingMessage = getFormattedMessage('key_closing', keyClosingVariables, `Key ${keyId} used successfully. Closing key window.`);
        
        // 先显示关闭消息，然后关闭窗口
        dialog.showMessageBox(keyWin, {
          type: 'info',
          message: keyClosingMessage
        }).then(() => {
          // 关闭钥匙窗口
          keyWin.close();
          console.log(`[ONE_TIME_KEY] Key window '${keyId}' closed after use`);
        });
      } else {
        // 只显示钥匙消费消息
        dialog.showMessageBox(doorWin, {
          type: 'info',
          message: keyUsedMessage
        });
      }
    }
    
    // 获取自定义开门消息
    const variables = { doorId, keyId };
    const openMessage = getFormattedMessage('door_opened', variables, 'Door opened!');
    
    dialog.showMessageBox(doorWin, { 
      type: 'info', 
      message: openMessage 
    }).then(() => {
      // 成功对话框已关闭
    });

    console.log(`[DOOR] ${doorId} 已打开`);
  } else {
    // 关门逻辑（多钥匙门和普通门都适用）
    const doorState = doorStates.get(doorId);
    
    // 如果是多钥匙门，重置进度
    if (isMultiKeyDoor(doorId)) {
      resetMultiKeyProgress(doorId);
      console.log(`[MULTI_KEY] Door '${doorId}' closed, progress reset`);
    }
    
    doorWin.setTitle(currentTitle.replace('(opened)', '(locked)').replace('(opened)', '(encrypted)'));
    
    // 更新状态
    if (doorState) {
      doorState.isOpen = false;
      doorState.lastKeyUsed = keyId;
    } else {
      doorStates.set(doorId, { isOpen: false, lastKeyUsed: keyId });
    }
    
    // 获取自定义关门消息
    const variables = { doorId, keyId };
    const closeMessage = getFormattedMessage('door_closed', variables, 'Door closed!');
    
    dialog.showMessageBox(doorWin, {
      type: 'info',
      message: closeMessage
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

// ==================== 一次性钥匙系统 ====================

/**
 * 设置钥匙为一次性使用
 * @param {string} keyId - 钥匙ID
 * @param {boolean} isOneTime - 是否为一次性使用
 * @param {boolean} shouldCloseAfterUse - 使用后是否关闭窗口
 */
export function setKeyOneTimeUse(keyId, isOneTime = true, shouldCloseAfterUse = false) {
  if (!keyId || typeof keyId !== 'string') {
    console.error('[ONE_TIME_KEY] Invalid keyId provided to setKeyOneTimeUse:', keyId);
    return;
  }
  
  if (typeof isOneTime !== 'boolean') {
    console.error('[ONE_TIME_KEY] isOneTime must be a boolean:', isOneTime);
    return;
  }
  
  if (typeof shouldCloseAfterUse !== 'boolean') {
    console.error('[ONE_TIME_KEY] shouldCloseAfterUse must be a boolean:', shouldCloseAfterUse);
    return;
  }
  
  if (isOneTime) {
    oneTimeKeys.add(keyId);
    console.log(`[ONE_TIME_KEY] Key '${keyId}' set as one-time use`);
    
    if (shouldCloseAfterUse) {
      closeAfterUse.add(keyId);
      console.log(`[ONE_TIME_KEY] Key '${keyId}' will close after use`);
    }
  } else {
    oneTimeKeys.delete(keyId);
    closeAfterUse.delete(keyId);
    console.log(`[ONE_TIME_KEY] Key '${keyId}' set as reusable`);
  }
}

/**
 * 检查钥匙是否可用
 * @param {string} keyId - 钥匙ID
 * @returns {boolean} 钥匙是否可用
 */
export function isKeyUsable(keyId) {
  if (!keyId || typeof keyId !== 'string') {
    console.warn('[ONE_TIME_KEY] Invalid keyId provided to isKeyUsable:', keyId);
    return false;
  }
  
  // 如果钥匙不是一次性的，总是可用
  if (!oneTimeKeys.has(keyId)) {
    return true;
  }
  
  // 如果是一次性钥匙，检查是否已使用
  const isUsable = !usedKeys.has(keyId);
  console.log(`[ONE_TIME_KEY] Key '${keyId}' usability check: ${isUsable}`);
  return isUsable;
}

/**
 * 重置钥匙使用状态
 * @param {string} keyId - 钥匙ID
 */
export function resetKeyUsage(keyId) {
  if (!keyId || typeof keyId !== 'string') {
    console.error('[ONE_TIME_KEY] Invalid keyId provided to resetKeyUsage:', keyId);
    return;
  }
  
  if (usedKeys.has(keyId)) {
    usedKeys.delete(keyId);
    console.log(`[ONE_TIME_KEY] Key '${keyId}' usage reset - now available for use`);
  } else {
    console.log(`[ONE_TIME_KEY] Key '${keyId}' was not used, no reset needed`);
  }
}

/**
 * 设置钥匙使用后是否关闭
 * @param {string} keyId - 钥匙ID
 * @param {boolean} shouldClose - 是否应该关闭
 */
export function setKeyCloseAfterUse(keyId, shouldClose = true) {
  if (!keyId || typeof keyId !== 'string') {
    console.error('[ONE_TIME_KEY] Invalid keyId provided to setKeyCloseAfterUse:', keyId);
    return;
  }
  
  if (typeof shouldClose !== 'boolean') {
    console.error('[ONE_TIME_KEY] shouldClose must be a boolean:', shouldClose);
    return;
  }
  
  if (shouldClose) {
    closeAfterUse.add(keyId);
    console.log(`[ONE_TIME_KEY] Key '${keyId}' will close after use`);
  } else {
    closeAfterUse.delete(keyId);
    console.log(`[ONE_TIME_KEY] Key '${keyId}' will not close after use`);
  }
}

// ==================== 多钥匙门系统 ====================

/**
 * 设置多钥匙门配置
 * @param {string} doorId - 门ID
 * @param {Array} requiredKeySequence - 需要的钥匙序列
 * @param {number} timeoutMs - 超时时间（毫秒）
 */
export function setMultiKeyDoor(doorId, requiredKeySequence, timeoutMs = 30000) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[MULTI_KEY] Invalid doorId provided to setMultiKeyDoor:', doorId);
    return;
  }
  
  if (!Array.isArray(requiredKeySequence) || requiredKeySequence.length === 0) {
    console.error('[MULTI_KEY] requiredKeySequence must be a non-empty array:', requiredKeySequence);
    return;
  }
  
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
    console.error('[MULTI_KEY] timeoutMs must be a positive number:', timeoutMs);
    return;
  }
  
  // 验证所有钥匙ID都是字符串
  for (const keyId of requiredKeySequence) {
    if (!keyId || typeof keyId !== 'string') {
      console.error('[MULTI_KEY] All keys in sequence must be valid strings:', keyId);
      return;
    }
  }
  
  multiKeyDoors.set(doorId, {
    requiredKeys: [...requiredKeySequence], // 创建副本
    timeoutDuration: timeoutMs
  });
  
  // 初始化门状态，包含多钥匙门的进度跟踪字段
  const currentState = doorStates.get(doorId) || { isOpen: false, lastKeyUsed: null };
  doorStates.set(doorId, {
    ...currentState,
    requiredKeys: [...requiredKeySequence],
    usedKeys: [],
    timeoutId: null,
    timeoutDuration: timeoutMs
  });
  
  console.log(`[MULTI_KEY] Door '${doorId}' configured as multi-key door requiring keys: [${requiredKeySequence.join(', ')}] with ${timeoutMs}ms timeout`);
}

/**
 * 获取多钥匙门的进度
 * @param {string} doorId - 门ID
 * @returns {Object|null} 进度信息或null
 */
export function getMultiKeyProgress(doorId) {
  if (!doorId || typeof doorId !== 'string') {
    console.warn('[MULTI_KEY] Invalid doorId provided to getMultiKeyProgress:', doorId);
    return null;
  }
  
  const doorState = doorStates.get(doorId);
  if (!doorState || !doorState.requiredKeys) {
    return null; // 不是多钥匙门
  }
  
  const progress = {
    doorId,
    requiredKeys: doorState.requiredKeys,
    usedKeys: doorState.usedKeys || [],
    progress: (doorState.usedKeys || []).length,
    total: doorState.requiredKeys.length,
    nextKey: null,
    isComplete: false,
    hasTimeout: doorState.timeoutId !== null
  };
  
  // 确定下一个需要的钥匙
  if (progress.progress < progress.total) {
    progress.nextKey = progress.requiredKeys[progress.progress];
  }
  
  // 检查是否完成
  progress.isComplete = progress.progress === progress.total;
  
  return progress;
}

/**
 * 重置多钥匙门的进度
 * @param {string} doorId - 门ID
 */
export function resetMultiKeyProgress(doorId) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[MULTI_KEY] Invalid doorId provided to resetMultiKeyProgress:', doorId);
    return;
  }
  
  const doorState = doorStates.get(doorId);
  if (!doorState || !doorState.requiredKeys) {
    console.log(`[MULTI_KEY] Door '${doorId}' is not a multi-key door, no reset needed`);
    return;
  }
  
  // 清除现有超时
  if (doorState.timeoutId) {
    clearTimeout(doorState.timeoutId);
    console.log(`[MULTI_KEY] Cleared timeout for door '${doorId}'`);
  }
  
  // 重置进度
  doorState.usedKeys = [];
  doorState.timeoutId = null;
  
  console.log(`[MULTI_KEY] Progress reset for door '${doorId}'`);
}

/**
 * 检查门是否为多钥匙门
 * @param {string} doorId - 门ID
 * @returns {boolean} 是否为多钥匙门
 */
function isMultiKeyDoor(doorId) {
  const doorState = doorStates.get(doorId);
  return doorState && doorState.requiredKeys && doorState.requiredKeys.length > 1;
}

/**
 * 启动多钥匙门超时计时器
 * @param {string} doorId - 门ID
 */
function startMultiKeyTimeout(doorId) {
  const doorState = doorStates.get(doorId);
  if (!doorState || !doorState.timeoutDuration) {
    return;
  }
  
  // 清除现有超时
  if (doorState.timeoutId) {
    clearTimeout(doorState.timeoutId);
  }
  
  // 设置新超时
  doorState.timeoutId = setTimeout(() => {
    console.log(`[MULTI_KEY] Timeout reached for door '${doorId}', resetting progress`);
    
    // 显示超时消息
    const doorWin = getWindow(doorId);
    if (doorWin) {
      const variables = { doorId };
      const timeoutMessage = getFormattedMessage('timeout', variables, 'Timeout! Multi-key sequence reset.');
      
      dialog.showMessageBox(doorWin, {
        type: 'warning',
        title: 'Sequence Timeout',
        message: timeoutMessage
      });
    }
    
    // 重置进度
    resetMultiKeyProgress(doorId);
  }, doorState.timeoutDuration);
  
  console.log(`[MULTI_KEY] Started timeout timer for door '${doorId}' (${doorState.timeoutDuration}ms)`);
}

// ==================== 消息配置系统 ====================

/**
 * 解析消息模板并替换变量
 * @param {string} template - 消息模板
 * @param {Object} variables - 变量对象
 * @returns {string} 解析后的消息
 */
function parseMessageTemplate(template, variables = {}) {
  if (!template || typeof template !== 'string') {
    console.warn('[MESSAGE] Invalid template provided:', template);
    return template || '';
  }
  
  try {
    return template.replace(/\{(\w+)\}/g, (match, varName) => {
      if (variables.hasOwnProperty(varName)) {
        return variables[varName];
      }
      console.warn(`[MESSAGE] Variable '${varName}' not found in template: ${template}`);
      return match; // 保留原始占位符
    });
  } catch (error) {
    console.error('[MESSAGE] Error parsing template:', template, error);
    return template;
  }
}

/**
 * 获取消息模板（按优先级：key > door > global）
 * @param {string} messageType - 消息类型
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 * @returns {string|null} 消息模板或null
 */
function getMessageTemplate(messageType, doorId = null, keyId = null) {
  // 优先级1: 钥匙特定消息
  if (keyId && keyMessages.has(keyId)) {
    const keyMsgMap = keyMessages.get(keyId);
    if (keyMsgMap.has(messageType)) {
      return keyMsgMap.get(messageType);
    }
  }
  
  // 优先级2: 门特定消息
  if (doorId && doorMessages.has(doorId)) {
    const doorMsgMap = doorMessages.get(doorId);
    if (doorMsgMap.has(messageType)) {
      return doorMsgMap.get(messageType);
    }
  }
  
  // 优先级3: 全局消息
  if (globalMessages.has(messageType)) {
    return globalMessages.get(messageType);
  }
  
  return null;
}

/**
 * 获取格式化的消息
 * @param {string} messageType - 消息类型
 * @param {Object} variables - 变量对象
 * @param {string} defaultMessage - 默认消息
 * @returns {string} 格式化后的消息
 */
function getFormattedMessage(messageType, variables = {}, defaultMessage = '') {
  const template = getMessageTemplate(messageType, variables.doorId, variables.keyId);
  
  if (template) {
    return parseMessageTemplate(template, variables);
  }
  
  return defaultMessage;
}

/**
 * 验证消息模板
 * @param {string} template - 消息模板
 * @returns {boolean} 是否有效
 */
function validateMessageTemplate(template) {
  if (!template || typeof template !== 'string') {
    return false;
  }
  
  // 检查是否包含有效的变量占位符格式
  const validVariables = ['doorId', 'keyId', 'progress', 'total', 'nextKey', 'reason'];
  const variableMatches = template.match(/\{(\w+)\}/g);
  
  if (variableMatches) {
    for (const match of variableMatches) {
      const varName = match.slice(1, -1); // 移除大括号
      if (!validVariables.includes(varName)) {
        console.warn(`[MESSAGE] Unknown variable '${varName}' in template: ${template}`);
        console.warn(`[MESSAGE] Valid variables are: ${validVariables.join(', ')}`);
      }
    }
  }
  
  return true;
}

/**
 * 设置全局消息模板
 * @param {string} messageType - 消息类型
 * @param {string} template - 消息模板
 */
export function setGlobalMessage(messageType, template) {
  if (!messageType || typeof messageType !== 'string') {
    console.error('[MESSAGE] Invalid messageType provided to setGlobalMessage:', messageType);
    return;
  }
  
  if (!validateMessageTemplate(template)) {
    console.error('[MESSAGE] Invalid template provided to setGlobalMessage:', template);
    return;
  }
  
  globalMessages.set(messageType, template);
  console.log(`[MESSAGE] Global message set for '${messageType}': ${template}`);
}

/**
 * 设置门特定消息模板
 * @param {string} doorId - 门ID
 * @param {string} messageType - 消息类型
 * @param {string} template - 消息模板
 */
export function setDoorMessage(doorId, messageType, template) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[MESSAGE] Invalid doorId provided to setDoorMessage:', doorId);
    return;
  }
  
  if (!messageType || typeof messageType !== 'string') {
    console.error('[MESSAGE] Invalid messageType provided to setDoorMessage:', messageType);
    return;
  }
  
  if (!validateMessageTemplate(template)) {
    console.error('[MESSAGE] Invalid template provided to setDoorMessage:', template);
    return;
  }
  
  if (!doorMessages.has(doorId)) {
    doorMessages.set(doorId, new Map());
  }
  
  doorMessages.get(doorId).set(messageType, template);
  console.log(`[MESSAGE] Door message set for '${doorId}.${messageType}': ${template}`);
}

/**
 * 设置钥匙特定消息模板
 * @param {string} keyId - 钥匙ID
 * @param {string} messageType - 消息类型
 * @param {string} template - 消息模板
 */
export function setKeyMessage(keyId, messageType, template) {
  if (!keyId || typeof keyId !== 'string') {
    console.error('[MESSAGE] Invalid keyId provided to setKeyMessage:', keyId);
    return;
  }
  
  if (!messageType || typeof messageType !== 'string') {
    console.error('[MESSAGE] Invalid messageType provided to setKeyMessage:', messageType);
    return;
  }
  
  if (!validateMessageTemplate(template)) {
    console.error('[MESSAGE] Invalid template provided to setKeyMessage:', template);
    return;
  }
  
  if (!keyMessages.has(keyId)) {
    keyMessages.set(keyId, new Map());
  }
  
  keyMessages.get(keyId).set(messageType, template);
  console.log(`[MESSAGE] Key message set for '${keyId}.${messageType}': ${template}`);
}

/**
 * 清除消息模板
 * @param {string} scope - 作用域 ('global', 'door', 'key')
 * @param {string} id - ID (门ID或钥匙ID，global时可为null)
 * @param {string} messageType - 消息类型 (可选，不提供则清除所有)
 */
export function clearMessages(scope, id = null, messageType = null) {
  if (!scope || typeof scope !== 'string') {
    console.error('[MESSAGE] Invalid scope provided to clearMessages:', scope);
    return;
  }
  
  switch (scope) {
    case 'global':
      if (messageType) {
        globalMessages.delete(messageType);
        console.log(`[MESSAGE] Cleared global message for '${messageType}'`);
      } else {
        globalMessages.clear();
        console.log('[MESSAGE] Cleared all global messages');
      }
      break;
      
    case 'door':
      if (!id) {
        console.error('[MESSAGE] Door ID required when clearing door messages');
        return;
      }
      if (doorMessages.has(id)) {
        if (messageType) {
          doorMessages.get(id).delete(messageType);
          console.log(`[MESSAGE] Cleared door message for '${id}.${messageType}'`);
        } else {
          doorMessages.delete(id);
          console.log(`[MESSAGE] Cleared all messages for door '${id}'`);
        }
      }
      break;
      
    case 'key':
      if (!id) {
        console.error('[MESSAGE] Key ID required when clearing key messages');
        return;
      }
      if (keyMessages.has(id)) {
        if (messageType) {
          keyMessages.get(id).delete(messageType);
          console.log(`[MESSAGE] Cleared key message for '${id}.${messageType}'`);
        } else {
          keyMessages.delete(id);
          console.log(`[MESSAGE] Cleared all messages for key '${id}'`);
        }
      }
      break;
      
    default:
      console.error('[MESSAGE] Invalid scope. Use "global", "door", or "key"');
  }
}

