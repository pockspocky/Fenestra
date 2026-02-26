import { dialog } from 'electron';
import path from 'node:path';
import { getWindow } from './windowManager.js';
import '../../logger.js'; // Import logging system
import { 
  FileCompletionError, 
  ERROR_CODES, 
  logError 
} from '../utils/errorHandler.js';
import {
  triggerDoorOpened,
  triggerDoorClosed,
  triggerKeyUsed,
  triggerAccessDenied,
  triggerDoorStateChanged
} from '../core/callbacks/doorKeyCallbacks.js';

// TODO: Future integration with pathValidator singleton
// When implementing directory unlocking via door/key system:
// 1. Import pathValidator: import { pathValidator } from '../security/pathSecurityValidator.js';
// 2. In setDoorState() when opening a door, unlock associated directories:
//    if (state === 'open' && directoryPath) {
//      pathValidator.unlockDirectory(directoryPath);
//    }
// 3. In setDoorState() when closing a door, lock associated directories:
//    if (state === 'closed' && directoryPath) {
//      pathValidator.lockDirectory(directoryPath);
//    }
// 4. Map doorId to directory paths in directoryAccessMap
// See pathSecurityValidator.js for singleton usage documentation.

// Door-key relationship management system
const doorKeyRelations = new Map(); // doorId -> Set of keyIds
const keyDoorRelations = new Map(); // keyId -> Set of doorIds
const encryptedItems = new Set(); // Store encrypted item IDs
const doorStates = new Map(); // doorId -> { isOpen: boolean, lastKeyUsed: string, state: 'open'|'closed', isLocked: boolean, isEncrypted: boolean, closedImagePath: string, openedImagePath: string, createdAt: number, lastStateChange: number }

// Message configuration system
const globalMessages = new Map(); // messageType -> template
const doorMessages = new Map(); // doorId -> Map(messageType -> template)
const keyMessages = new Map(); // keyId -> Map(messageType -> template)

// One-time key system
const oneTimeKeys = new Set(); // keyId - keys configured for one-time use
const usedKeys = new Set(); // keyId - keys that have already been used
const closeAfterUse = new Set(); // keyId - keys that should close after use

// Multi-key door system
const multiKeyDoors = new Map(); // doorId -> { requiredKeys: Array, timeoutDuration: number }

/**
 * Establish bidirectional relationship
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID
 */
export function establishRelation(doorId, keyId) {
  // door -> key relationship
  if (!doorKeyRelations.has(doorId)) {
    doorKeyRelations.set(doorId, new Set());
  }
  doorKeyRelations.get(doorId).add(keyId);
  
  // key -> door relationship
  if (!keyDoorRelations.has(keyId)) {
    keyDoorRelations.set(keyId, new Set());
  }
  keyDoorRelations.get(keyId).add(doorId);
}

/**
 * Check door opening permission
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID
 * @returns {boolean} Whether has permission to open door
 */
export function canOpenDoor(doorId, keyId) {
  // NEW: Check for custom authorization callback
  const authCallback = authorizationCallbacks.get(doorId);
  
  if (authCallback) {
    try {
      const result = authCallback(doorId, keyId);
      
      // Validate boolean return
      if (typeof result !== 'boolean') {
        console.warn(`[AUTH_CALLBACK] Callback for door '${doorId}' returned non-boolean: ${result}, treating as false`);
        return false;
      }
      
      console.log(`[AUTH_CALLBACK] Custom authorization for door '${doorId}' with key '${keyId}': ${result}`);
      return result;
    } catch (error) {
      console.error(`[AUTH_CALLBACK] Error in authorization callback for door '${doorId}':`, {
        doorId,
        keyId,
        error: error.message,
        stack: error.stack
      });
      return false; // Deny access on error
    }
  }
  
  // EXISTING: Default authorization logic continues unchanged
  // First check if key is usable (one-time key usage status check)
  if (!isKeyUsable(keyId)) {
    console.log(`[DOOR_ACCESS] Key '${keyId}' is not usable (already used)`);
    return false;
  }
  
  // Check if it's a multi-key door
  if (isMultiKeyDoor(doorId)) {
    const progress = getMultiKeyProgress(doorId);
    if (!progress) {
      console.log(`[MULTI_KEY] Could not get progress for multi-key door '${doorId}'`);
      return false;
    }
    
    // Check if already fully unlocked
    if (progress.isComplete) {
      console.log(`[MULTI_KEY] Door '${doorId}' is already fully unlocked`);
      return true;
    }
    
    // Check if it's the next required key
    if (progress.nextKey !== keyId) {
      console.log(`[MULTI_KEY] Key '${keyId}' is not the next required key for door '${doorId}'. Expected: '${progress.nextKey}'`);
      return false;
    }
    
    console.log(`[MULTI_KEY] Key '${keyId}' is the correct next key for door '${doorId}' (${progress.progress + 1}/${progress.total})`);
    return true;
  }
  
  const isDoorEncrypted = encryptedItems.has(doorId);
  const isKeyEncrypted = encryptedItems.has(keyId);
  
  // If door is not encrypted, any key can open it
  if (!isDoorEncrypted) {
    return true;
  }
  
  // If door is encrypted, check if key has permission
  if (isDoorEncrypted && isKeyEncrypted) {
    const authorizedKeys = doorKeyRelations.get(doorId);
    return authorizedKeys && authorizedKeys.has(keyId);
  }
  
  return false;
}

/**
 * Handle failed door opening
 * @param {string} doorId - Door ID
 * @param {string} keyId - Key ID
 */
export function handleFailedOpen(doorId, keyId) {
  // Determine denial reason
  let reason = 'insufficient permissions';
  const isDoorEncrypted = encryptedItems.has(doorId);
  const isKeyEncrypted = encryptedItems.has(keyId);
  
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
  
  // Check if it's a used one-time key
  if (!isKeyUsable(keyId)) {
    reason = 'key has already been used and is no longer functional';
  }
  
  // Check if it's a multi-key door with wrong sequence
  if (isMultiKeyDoor(doorId)) {
    const progress = getMultiKeyProgress(doorId);
    if (progress && progress.progress > 0) {
      reason = 'wrong key in multi-key sequence';
    } else {
      reason = 'not the first required key in sequence';
    }
  }
  
  // Trigger access denied callback
  triggerAccessDenied(doorId, keyId, reason);
  
  // Show error window
  const doorWin = getWindow(doorId);
  const keyWin = getWindow(keyId);
  
  if (doorWin) {
    // Check if it's a multi-key door, if so reset progress
    if (isMultiKeyDoor(doorId)) {
      const progress = getMultiKeyProgress(doorId);
      
      // If there's progress, user used wrong key, need to reset
      if (progress && progress.progress > 0) {
        resetMultiKeyProgress(doorId);
        
        // Update door visual state to closed and locked
        setDoorState(doorId, 'closed');
        setDoorLocked(doorId, true);
        
        // Show sequence reset message
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
        // No progress, show standard error message
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
      // Regular door error handling
      // Determine denial reason
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
      
      // Check if it's a used one-time key
      if (!isKeyUsable(keyId)) {
        reason = 'key has already been used and is no longer functional';
      }
      
      // Get custom access denied message
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
  
  // Separate key and door (move key away from door)
  if (doorWin && keyWin) {
    bounceKeyAway(keyWin, doorWin, keyId, doorId);
    console.log(`[SEPARATE] Key ${keyId} separated from door ${doorId}`);
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
  
  // Use proper door state management API instead of parsing title (Requirements 4.1, 2.7, 9.4)
  const currentState = getDoorStateValue(doorId);
  const isCurrentlyOpen = currentState === 'open';

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
      
      // Trigger key used callback
      const isComplete = doorState.usedKeys.length === doorState.requiredKeys.length;
      triggerKeyUsed(keyId, doorId, true, {
        multiKey: true,
        progress: doorState.usedKeys.length,
        total: doorState.requiredKeys.length,
        isComplete
      });
      
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
        
        // Update door visual state (Requirements 4.6, 4.7 - titles remain unchanged)
        setDoorState(doorId, 'open');
        setDoorLocked(doorId, false);
        
        // Trigger door opened callback
        triggerDoorOpened(doorId, keyId, { 
          multiKey: true, 
          keysUsed: doorState.usedKeys 
        });
        
        // 执行门开启回调
        executeDoorOpenCallback(doorId, keyId);
        
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
        
        // Display progress in dialog (Requirements 4.6, 4.7 - titles remain unchanged)
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
    
    // 普通门开门逻辑 (Requirements 4.6, 4.7 - titles remain unchanged)
    
    // 更新状态
    doorStates.set(doorId, { isOpen: true, lastKeyUsed: keyId });
    
    // Update door visual state
    setDoorState(doorId, 'open');
    setDoorLocked(doorId, false);
    
    // Trigger door opened callback
    triggerDoorOpened(doorId, keyId);
    
    // Trigger key used callback
    triggerKeyUsed(keyId, doorId, true);
    
    // 执行门开启回调
    executeDoorOpenCallback(doorId, keyId);
    
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
    
    // 更新状态 (Requirements 4.6, 4.7 - titles remain unchanged)
    if (doorState) {
      doorState.isOpen = false;
      doorState.lastKeyUsed = keyId;
    } else {
      doorStates.set(doorId, { isOpen: false, lastKeyUsed: keyId });
    }
    
    // Update door visual state
    setDoorState(doorId, 'closed');
    setDoorLocked(doorId, true);
    
    // Trigger door closed callback
    triggerDoorClosed(doorId, keyId);
    
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
 * Get related doors for a key
 * @param {string} keyId - Key ID
 * @returns {Array<string>} Array of related door IDs
 */
export function getRelatedDoorsForKey(keyId) {
  const doorSet = keyDoorRelations.get(keyId);
  return doorSet ? Array.from(doorSet) : [];
}

/**
 * Get related keys for a door
 * @param {string} doorId - Door ID
 * @returns {Array<string>} Array of related key IDs
 */
export function getRelatedKeysForDoor(doorId) {
  const keySet = doorKeyRelations.get(doorId);
  return keySet ? Array.from(keySet) : [];
}

/**
 * Check if an item (door or key) is encrypted
 * @param {string} itemId - Item ID (door or key)
 * @returns {boolean} True if item is encrypted
 */
export function isItemEncrypted(itemId) {
  return encryptedItems.has(itemId);
}

/**
 * 获取门状态
 * @param {string} doorId - 门ID
 * @returns {Object|null} 门状态或null
 */
export function getDoorState(doorId) {
  return doorStates.get(doorId);
}

// ==================== 新门状态管理系统 ====================

/**
 * 初始化门状态
 * @param {string} doorId - 门ID
 * @param {Object} initialState - 初始状态配置
 */
export function initializeDoorState(doorId, initialState = {}) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[DOOR_STATE] Invalid doorId provided to initializeDoorState:', doorId);
    return;
  }

  const now = Date.now();
  const state = {
    isOpen: initialState.state === 'open',
    lastKeyUsed: null,
    state: initialState.state || 'closed',
    isLocked: initialState.isLocked !== undefined ? initialState.isLocked : true,
    isEncrypted: initialState.isEncrypted || false,
    closedImagePath: initialState.closedImagePath || null,
    openedImagePath: initialState.openedImagePath || null,
    createdAt: now,
    lastStateChange: now,
    ...initialState
  };

  doorStates.set(doorId, state);
  console.log(`[DOOR_STATE] Initialized state for door '${doorId}':`, state);
}

/**
 * 设置门的状态
 * @param {string} doorId - 门ID
 * @param {string} state - 状态 ('open' 或 'closed')
 * @returns {Object} 操作结果
 */
export function setDoorState(doorId, state) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[DOOR_STATE] Invalid doorId provided to setDoorState:', doorId);
    return { success: false, error: 'Invalid door ID' };
  }

  if (!['open', 'closed'].includes(state)) {
    console.warn('[DOOR_STATE] Invalid door state:', { doorId, state });
    return { success: false, error: 'Invalid state value. Must be "open" or "closed"' };
  }

  const doorState = doorStates.get(doorId);
  if (!doorState) {
    console.warn('[DOOR_STATE] Door not found:', doorId);
    return { success: false, error: 'Door not found' };
  }

  const oldState = doorState.state;
  doorState.state = state;
  doorState.isOpen = (state === 'open');
  doorState.lastStateChange = Date.now();

  console.log(`[DOOR_STATE] Door '${doorId}' state changed from '${oldState}' to '${state}'`);

  // Emit state change event
  emitDoorStateChangeEvent(doorId, oldState, state);

  // Notify door window via IPC
  notifyDoorWindow(doorId, state);

  return { success: true, oldState, newState: state };
}

/**
 * 获取门的当前状态
 * @param {string} doorId - 门ID
 * @returns {string|null} 状态 ('open', 'closed') 或 null
 */
export function getDoorStateValue(doorId) {
  if (!doorId || typeof doorId !== 'string') {
    console.warn('[DOOR_STATE] Invalid doorId provided to getDoorStateValue:', doorId);
    return null;
  }

  const doorState = doorStates.get(doorId);
  if (!doorState) {
    console.warn('[DOOR_STATE] Door not found:', doorId);
    return null;
  }

  return doorState.state || (doorState.isOpen ? 'open' : 'closed');
}

/**
 * 切换门的状态
 * @param {string} doorId - 门ID
 * @returns {Object} 操作结果
 */
export function toggleDoorState(doorId) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[DOOR_STATE] Invalid doorId provided to toggleDoorState:', doorId);
    return { success: false, error: 'Invalid door ID' };
  }

  const doorState = doorStates.get(doorId);
  if (!doorState) {
    console.warn('[DOOR_STATE] Door not found:', doorId);
    return { success: false, error: 'Door not found' };
  }

  const currentState = doorState.state || (doorState.isOpen ? 'open' : 'closed');
  const newState = currentState === 'open' ? 'closed' : 'open';

  return setDoorState(doorId, newState);
}

/**
 * 设置门的锁定状态
 * @param {string} doorId - 门ID
 * @param {boolean} isLocked - 是否锁定
 * @returns {Object} 操作结果
 */
export function setDoorLocked(doorId, isLocked) {
  if (!doorId || typeof doorId !== 'string') {
    console.error('[DOOR_STATE] Invalid doorId provided to setDoorLocked:', doorId);
    return { success: false, error: 'Invalid door ID' };
  }

  if (typeof isLocked !== 'boolean') {
    console.error('[DOOR_STATE] isLocked must be a boolean:', isLocked);
    return { success: false, error: 'isLocked must be a boolean' };
  }

  const doorState = doorStates.get(doorId);
  if (!doorState) {
    console.warn('[DOOR_STATE] Door not found:', doorId);
    return { success: false, error: 'Door not found' };
  }

  const oldLocked = doorState.isLocked;
  doorState.isLocked = isLocked;

  console.log(`[DOOR_STATE] Door '${doorId}' lock state changed from ${oldLocked} to ${isLocked}`);

  // Emit lock change event
  emitDoorLockChangeEvent(doorId, isLocked);

  // Notify door window via IPC
  notifyDoorLockChange(doorId, isLocked);

  return { success: true, oldLocked, newLocked: isLocked };
}

/**
 * 检查门是否锁定
 * @param {string} doorId - 门ID
 * @returns {boolean} 是否锁定
 */
export function isDoorLocked(doorId) {
  if (!doorId || typeof doorId !== 'string') {
    console.warn('[DOOR_STATE] Invalid doorId provided to isDoorLocked:', doorId);
    return false;
  }

  const doorState = doorStates.get(doorId);
  if (!doorState) {
    console.warn('[DOOR_STATE] Door not found:', doorId);
    return false;
  }

  return doorState.isLocked !== undefined ? doorState.isLocked : true;
}

// ==================== 事件系统 ====================

// Event listeners storage
const stateChangeListeners = [];
const lockChangeListeners = [];

/**
 * 注册状态变化监听器
 * @param {Function} callback - 回调函数 (doorId, oldState, newState) => void
 */
export function onDoorStateChange(callback) {
  if (typeof callback === 'function') {
    stateChangeListeners.push(callback);
    console.log('[DOOR_STATE] Registered state change listener');
  }
}

/**
 * 注册锁定状态变化监听器
 * @param {Function} callback - 回调函数 (doorId, isLocked) => void
 */
export function onDoorLockChange(callback) {
  if (typeof callback === 'function') {
    lockChangeListeners.push(callback);
    console.log('[DOOR_STATE] Registered lock change listener');
  }
}

/**
 * 触发状态变化事件
 * @param {string} doorId - 门ID
 * @param {string} oldState - 旧状态
 * @param {string} newState - 新状态
 */
function emitDoorStateChangeEvent(doorId, oldState, newState) {
  const event = { doorId, oldState, newState, timestamp: Date.now() };
  
  // Trigger callback system event
  triggerDoorStateChanged(doorId, oldState, newState);
  
  for (const listener of stateChangeListeners) {
    try {
      listener(doorId, oldState, newState);
    } catch (error) {
      console.error('[DOOR_STATE] Error in state change listener:', error);
    }
  }

  console.log('[DOOR_STATE] Emitted state change event:', event);
}

/**
 * 触发锁定状态变化事件
 * @param {string} doorId - 门ID
 * @param {boolean} isLocked - 是否锁定
 */
function emitDoorLockChangeEvent(doorId, isLocked) {
  const event = { doorId, isLocked, timestamp: Date.now() };
  
  for (const listener of lockChangeListeners) {
    try {
      listener(doorId, isLocked);
    } catch (error) {
      console.error('[DOOR_STATE] Error in lock change listener:', error);
    }
  }

  console.log('[DOOR_STATE] Emitted lock change event:', event);
}

/**
 * 通知门窗口状态变化 (via IPC)
 * @param {string} doorId - 门ID
 * @param {string} newState - 新状态
 */
function notifyDoorWindow(doorId, newState) {
  const doorWin = getWindow(doorId);
  if (doorWin && !doorWin.isDestroyed()) {
    try {
      doorWin.webContents.send('door-state-change', { doorId, newState });
      console.log(`[DOOR_STATE] Notified door window '${doorId}' of state change to '${newState}'`);
    } catch (error) {
      console.error(`[DOOR_STATE] Failed to notify door window '${doorId}':`, error);
    }
  }
}

/**
 * 通知门窗口锁定状态变化 (via IPC)
 * @param {string} doorId - 门ID
 * @param {boolean} isLocked - 是否锁定
 */
function notifyDoorLockChange(doorId, isLocked) {
  const doorWin = getWindow(doorId);
  if (doorWin && !doorWin.isDestroyed()) {
    try {
      doorWin.webContents.send('door-lock-change', { doorId, isLocked });
      console.log(`[DOOR_STATE] Notified door window '${doorId}' of lock change to ${isLocked}`);
    } catch (error) {
      console.error(`[DOOR_STATE] Failed to notify door window '${doorId}':`, error);
    }
  }
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

// ==================== 门开启回调系统 ====================

// 门开启回调存储
const doorOpenCallbacks = new Map(); // doorId -> callback function

/**
 * 注册门开启回调函数
 * @param {string} doorId - 门ID
 * @param {Function} callback - 回调函数 (doorId, keyId) => void
 * @throws {Error} 当doorId或callback无效时抛出错误
 */
export function registerDoorOpenCallback(doorId, callback) {
  // 验证doorId
  if (!doorId || typeof doorId !== 'string') {
    const error = new Error('Door ID must be a non-empty string');
    error.name = 'ValidationError';
    console.error('[DOOR_CALLBACK] Validation error:', error.message, { doorId, type: typeof doorId });
    throw error;
  }
  
  // 验证callback
  if (typeof callback !== 'function') {
    const error = new Error('Callback must be a function');
    error.name = 'ValidationError';
    console.error('[DOOR_CALLBACK] Validation error:', error.message, { callback, type: typeof callback });
    throw error;
  }
  
  // 如果已存在回调，将被替换
  if (doorOpenCallbacks.has(doorId)) {
    console.log(`[DOOR_CALLBACK] Replacing existing callback for door '${doorId}'`);
  }
  
  // 存储回调
  doorOpenCallbacks.set(doorId, callback);
  console.log(`[DOOR_CALLBACK] Registered callback for door '${doorId}'`);
}

/**
 * 注销门开启回调函数
 * @param {string} doorId - 门ID
 * @throws {Error} 当doorId无效时抛出错误
 */
export function unregisterDoorOpenCallback(doorId) {
  // 验证doorId
  if (!doorId || typeof doorId !== 'string') {
    const error = new Error('Door ID must be a non-empty string');
    error.name = 'ValidationError';
    console.error('[DOOR_CALLBACK] Validation error:', error.message, { doorId, type: typeof doorId });
    throw error;
  }
  
  // 检查是否存在回调
  if (!doorOpenCallbacks.has(doorId)) {
    console.warn(`[DOOR_CALLBACK] No callback registered for door '${doorId}', skipping unregister`);
    return;
  }
  
  // 移除回调
  doorOpenCallbacks.delete(doorId);
  console.log(`[DOOR_CALLBACK] Unregistered callback for door '${doorId}'`);
}

/**
 * 获取门开启回调信息
 * @param {string|null} doorId - 门ID（可选，null表示查询所有门）
 * @returns {Object|Array} 回调信息
 */
export function getDoorOpenCallbackInfo(doorId = null) {
  if (doorId === null) {
    // 返回所有注册了回调的门ID列表
    return Array.from(doorOpenCallbacks.keys());
  }
  
  // 返回特定门的回调信息
  return {
    doorId,
    hasCallback: doorOpenCallbacks.has(doorId)
  };
}

/**
 * 执行门开启回调（内部使用）
 * @param {string} doorId - 门ID
 * @param {string} keyId - 钥匙ID
 */
function executeDoorOpenCallback(doorId, keyId) {
  // 检查是否存在回调
  const callback = doorOpenCallbacks.get(doorId);
  
  if (!callback) {
    // 没有回调，静默返回
    return;
  }
  
  try {
    // 执行回调
    callback(doorId, keyId);
    console.log(`[DOOR_CALLBACK] Executed callback for door '${doorId}' with key '${keyId}'`);
  } catch (error) {
    // 捕获并记录回调执行错误，但不中断门开启流程
    console.error(`[DOOR_CALLBACK] Error executing callback for door '${doorId}':`, {
      doorId,
      keyId,
      error: error.message,
      stack: error.stack
    });
  }
}

// ==================== 授权回调系统 ====================

// 授权回调存储
const authorizationCallbacks = new Map(); // doorId -> callback function

/**
 * 注册授权回调函数
 * @param {string} doorId - 门ID
 * @param {Function} callback - 授权回调函数 (doorId, keyId) => boolean
 * @throws {Error} 当doorId或callback无效时抛出错误
 */
export function registerAuthorizationCallback(doorId, callback) {
  // 验证doorId
  if (!doorId || typeof doorId !== 'string') {
    const error = new Error('Door ID must be a non-empty string');
    error.name = 'ValidationError';
    console.error('[AUTH_CALLBACK] Validation error:', error.message, { doorId, type: typeof doorId });
    throw error;
  }
  
  // 验证callback
  if (typeof callback !== 'function') {
    const error = new Error('Callback must be a function');
    error.name = 'ValidationError';
    console.error('[AUTH_CALLBACK] Validation error:', error.message, { callback, type: typeof callback });
    throw error;
  }
  
  // 如果已存在回调，将被替换
  if (authorizationCallbacks.has(doorId)) {
    console.log(`[AUTH_CALLBACK] Replacing existing authorization callback for door '${doorId}'`);
  }
  
  // 存储回调
  authorizationCallbacks.set(doorId, callback);
  console.log(`[AUTH_CALLBACK] Registered authorization callback for door '${doorId}'`);
}

/**
 * 注销授权回调函数
 * @param {string} doorId - 门ID
 * @throws {Error} 当doorId无效时抛出错误
 */
export function unregisterAuthorizationCallback(doorId) {
  // 验证doorId
  if (!doorId || typeof doorId !== 'string') {
    const error = new Error('Door ID must be a non-empty string');
    error.name = 'ValidationError';
    console.error('[AUTH_CALLBACK] Validation error:', error.message, { doorId, type: typeof doorId });
    throw error;
  }
  
  // 检查是否存在回调
  if (!authorizationCallbacks.has(doorId)) {
    console.warn(`[AUTH_CALLBACK] No authorization callback registered for door '${doorId}', skipping unregister`);
    return;
  }
  
  // 移除回调
  authorizationCallbacks.delete(doorId);
  console.log(`[AUTH_CALLBACK] Unregistered authorization callback for door '${doorId}'`);
}

/**
 * 获取授权回调信息
 * @param {string|null} doorId - 门ID（可选，null表示查询所有门）
 * @returns {Object|Array} 回调信息
 */
export function getAuthorizationCallbackInfo(doorId = null) {
  if (doorId === null) {
    // 返回所有注册了授权回调的门ID列表
    return Array.from(authorizationCallbacks.keys());
  }
  
  // 返回特定门的授权回调信息
  return {
    doorId,
    hasCallback: authorizationCallbacks.has(doorId)
  };
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

// ==================== 目录访问控制系统 ====================

// 目录访问权限映射
const directoryAccessMap = new Map(); // dirPath -> { doorId, isLocked, requiredKeys }

/**
 * 设置目录访问权限
 * @param {string} dirPath - 目录路径
 * @param {string} doorId - 关联的门ID
 * @param {Array} requiredKeys - 需要的钥匙ID数组（可选）
 */
export function setDirectoryAccess(dirPath, doorId, requiredKeys = []) {
  if (!dirPath || typeof dirPath !== 'string') {
    console.error('[DIR_ACCESS] Invalid dirPath provided to setDirectoryAccess:', dirPath);
    return;
  }
  
  if (!doorId || typeof doorId !== 'string') {
    console.error('[DIR_ACCESS] Invalid doorId provided to setDirectoryAccess:', doorId);
    return;
  }
  
  if (!Array.isArray(requiredKeys)) {
    console.error('[DIR_ACCESS] requiredKeys must be an array:', requiredKeys);
    return;
  }
  
  // 规范化目录路径
  const normalizedPath = normalizePath(dirPath);
  
  directoryAccessMap.set(normalizedPath, {
    doorId,
    isLocked: true,
    requiredKeys: [...requiredKeys]
  });
  
  console.log(`[DIR_ACCESS] Directory access set for '${normalizedPath}' -> door '${doorId}' with keys: [${requiredKeys.join(', ')}]`);
}

/**
 * 检查目录访问权限
 * @param {string} dirPath - 目录路径
 * @returns {Object} 访问权限信息
 */
export function checkDirectoryAccess(dirPath) {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      const error = new FileCompletionError(
        'Invalid directory path provided',
        ERROR_CODES.MALFORMED_PATH,
        { dirPath, type: typeof dirPath }
      );
      logError(error);
      
      return {
        hasAccess: false,
        isLocked: false,
        requiredKey: null,
        lockReason: 'Invalid directory path',
        errorCode: error.code
      };
    }
    
    // 规范化目录路径
    const normalizedPath = normalizePath(dirPath);
    
    // 检查是否有访问控制设置
    const accessInfo = directoryAccessMap.get(normalizedPath);
    
    if (!accessInfo) {
      // 没有访问控制，默认允许访问
      console.debug(`[DIR_ACCESS] No access control for '${normalizedPath}', allowing access`);
      return {
        hasAccess: true,
        isLocked: false,
        requiredKey: null,
        lockReason: null,
        errorCode: null
      };
    }
    
    const { doorId, requiredKeys } = accessInfo;
    
    // 检查关联的门是否已打开
    const doorState = doorStates.get(doorId);
    
    if (doorState && doorState.isOpen) {
      console.debug(`[DIR_ACCESS] Door '${doorId}' is open, allowing access to '${normalizedPath}'`);
      return {
        hasAccess: true,
        isLocked: false,
        requiredKey: null,
        lockReason: null,
        errorCode: null
      };
    }
    
    // 门未打开，检查是否为多钥匙门
    if (isMultiKeyDoor(doorId)) {
      const progress = getMultiKeyProgress(doorId);
      
      if (progress && progress.isComplete) {
        console.debug(`[DIR_ACCESS] Multi-key door '${doorId}' is complete, allowing access to '${normalizedPath}'`);
        return {
          hasAccess: true,
          isLocked: false,
          requiredKey: null,
          lockReason: null,
          errorCode: null
        };
      }
      
      // 多钥匙门未完成
      const nextKey = progress ? progress.nextKey : (requiredKeys.length > 0 ? requiredKeys[0] : null);
      const remainingKeys = progress ? progress.total - progress.progress : requiredKeys.length;
      
      console.debug(`[DIR_ACCESS] Multi-key door '${doorId}' not complete, denying access to '${normalizedPath}'. Next key: '${nextKey}'`);
      
      return {
        hasAccess: false,
        isLocked: true,
        requiredKey: nextKey,
        lockReason: `Multi-key door requires ${remainingKeys} more key${remainingKeys > 1 ? 's' : ''}`,
        errorCode: ERROR_CODES.DIRECTORY_LOCKED,
        doorType: 'multi-key',
        progress: progress ? `${progress.progress}/${progress.total}` : `0/${requiredKeys.length}`
      };
    }
    
    // 普通门，检查是否有任何授权钥匙可用
    if (requiredKeys.length > 0) {
      // 检查是否有可用的钥匙
      const availableKey = requiredKeys.find(keyId => isKeyUsable(keyId));
      
      if (availableKey) {
        console.debug(`[DIR_ACCESS] Door '${doorId}' locked but key '${availableKey}' is available for '${normalizedPath}'`);
        return {
          hasAccess: false,
          isLocked: true,
          requiredKey: availableKey,
          lockReason: `Directory locked, key "${availableKey}" required`,
          errorCode: ERROR_CODES.DIRECTORY_LOCKED,
          doorType: 'single-key',
          keyAvailable: true
        };
      } else {
        console.debug(`[DIR_ACCESS] Door '${doorId}' locked and no usable keys available for '${normalizedPath}'`);
        return {
          hasAccess: false,
          isLocked: true,
          requiredKey: requiredKeys[0], // 返回第一个钥匙作为提示
          lockReason: `Directory locked, required keys are not available`,
          errorCode: ERROR_CODES.MISSING_KEY,
          doorType: 'single-key',
          keyAvailable: false,
          allRequiredKeys: requiredKeys
        };
      }
    }
    
    // 门锁定但没有指定钥匙
    console.debug(`[DIR_ACCESS] Door '${doorId}' locked with no specific keys for '${normalizedPath}'`);
    return {
      hasAccess: false,
      isLocked: true,
      requiredKey: null,
      lockReason: `Directory locked by door "${doorId}"`,
      errorCode: ERROR_CODES.DIRECTORY_LOCKED,
      doorType: 'no-key',
      doorId
    };
    
  } catch (error) {
    const completionError = new FileCompletionError(
      `Directory access check failed: ${error.message}`,
      ERROR_CODES.KEY_VALIDATION_FAILED,
      { 
        dirPath,
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    );
    logError(completionError);
    
    return {
      hasAccess: false,
      isLocked: false,
      requiredKey: null,
      lockReason: 'Access check failed due to internal error',
      errorCode: completionError.code
    };
  }
}

/**
 * 过滤可访问的目录
 * @param {Array} directories - 目录条目数组
 * @returns {Array} 过滤后的可访问目录数组
 */
export function filterAccessibleDirectories(directories) {
  try {
    if (!Array.isArray(directories)) {
      const error = new FileCompletionError(
        'Invalid directories array provided',
        ERROR_CODES.MALFORMED_PATH,
        { directories, type: typeof directories }
      );
      logError(error);
      return [];
    }
    
    const accessibleDirectories = [];
    const processingErrors = [];
    
    for (let i = 0; i < directories.length; i++) {
      const directory = directories[i];
      
      try {
        // 支持不同的目录对象格式
        let dirPath;
        
        if (typeof directory === 'string') {
          dirPath = directory;
        } else if (directory && typeof directory === 'object') {
          // 支持文件系统条目对象
          dirPath = directory.path || directory.name || directory.fullPath;
        } else {
          processingErrors.push({
            index: i,
            directory,
            error: 'Invalid directory entry type',
            errorCode: ERROR_CODES.MALFORMED_PATH
          });
          continue;
        }
        
        if (!dirPath) {
          processingErrors.push({
            index: i,
            directory,
            error: 'Directory entry missing path information',
            errorCode: ERROR_CODES.MALFORMED_PATH
          });
          continue;
        }
        
        // 检查访问权限
        const accessInfo = checkDirectoryAccess(dirPath);
        
        if (accessInfo.hasAccess) {
          accessibleDirectories.push(directory);
          console.debug(`[DIR_ACCESS] Directory '${dirPath}' is accessible`);
        } else {
          console.debug(`[DIR_ACCESS] Directory '${dirPath}' is locked: ${accessInfo.lockReason}`);
          
          // 为锁定的目录添加详细的锁定信息
          if (typeof directory === 'object' && directory !== null) {
            directory.isLocked = true;
            directory.lockReason = accessInfo.lockReason;
            directory.requiredKey = accessInfo.requiredKey;
            directory.errorCode = accessInfo.errorCode;
            directory.doorType = accessInfo.doorType;
            
            // 添加额外的上下文信息
            if (accessInfo.progress) {
              directory.progress = accessInfo.progress;
            }
            if (accessInfo.keyAvailable !== undefined) {
              directory.keyAvailable = accessInfo.keyAvailable;
            }
            if (accessInfo.allRequiredKeys) {
              directory.allRequiredKeys = accessInfo.allRequiredKeys;
            }
          }
        }
        
      } catch (entryError) {
        processingErrors.push({
          index: i,
          directory,
          error: entryError.message,
          errorCode: ERROR_CODES.INTERNAL_ERROR
        });
        
        const error = new FileCompletionError(
          `Error processing directory entry at index ${i}: ${entryError.message}`,
          ERROR_CODES.INTERNAL_ERROR,
          { 
            index: i,
            directory,
            originalError: entryError.message
          }
        );
        logError(error);
      }
    }
    
    // Log summary with detailed information
    const totalDirectories = directories.length;
    const accessibleCount = accessibleDirectories.length;
    const lockedCount = totalDirectories - accessibleCount - processingErrors.length;
    const errorCount = processingErrors.length;
    
    console.log(`[DIR_ACCESS] Directory filtering complete: ${totalDirectories} total, ${accessibleCount} accessible, ${lockedCount} locked, ${errorCount} errors`);
    
    if (processingErrors.length > 0) {
      console.warn(`[DIR_ACCESS] Processing errors encountered:`, processingErrors);
    }
    
    return accessibleDirectories;
    
  } catch (error) {
    const completionError = new FileCompletionError(
      `Directory filtering failed: ${error.message}`,
      ERROR_CODES.INTERNAL_ERROR,
      { 
        directoriesCount: Array.isArray(directories) ? directories.length : 'unknown',
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    );
    logError(completionError);
    
    return [];
  }
}

/**
 * 移除目录访问控制
 * @param {string} dirPath - 目录路径
 */
export function removeDirectoryAccess(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    console.error('[DIR_ACCESS] Invalid dirPath provided to removeDirectoryAccess:', dirPath);
    return;
  }
  
  const normalizedPath = normalizePath(dirPath);
  
  if (directoryAccessMap.has(normalizedPath)) {
    directoryAccessMap.delete(normalizedPath);
    console.log(`[DIR_ACCESS] Directory access control removed for '${normalizedPath}'`);
  } else {
    console.log(`[DIR_ACCESS] No access control found for '${normalizedPath}'`);
  }
}

/**
 * 获取所有目录访问控制信息（用于调试）
 * @returns {Object} 目录访问控制映射
 */
export function getDirectoryAccessDebugInfo() {
  return {
    directoryAccessMap: Object.fromEntries(directoryAccessMap),
    totalControlledDirectories: directoryAccessMap.size
  };
}

/**
 * 规范化路径用于一致性比较
 * @param {string} dirPath - 目录路径
 * @returns {string} 规范化后的路径
 */
function normalizePath(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return '';
  }
  
  // 使用 Node.js path.resolve 来规范化路径
  try {
    return path.resolve(dirPath);
  } catch (error) {
    console.warn('[DIR_ACCESS] Path normalization failed:', error);
    return dirPath;
  }
}

// ==================== 状态导出/导入系统 ====================

/**
 * 导出所有门钥匙关系状态用于序列化
 * @returns {Object} 完整的关系状态对象
 */
export function exportRelationshipState() {
  console.log('[STATE_EXPORT] Exporting door-key relationship state');
  
  // 将Map和Set转换为可序列化的对象和数组
  const state = {
    doorKeyRelations: {},
    keyDoorRelations: {},
    encryptedItems: Array.from(encryptedItems),
    doorStates: {},
    oneTimeKeys: {
      keys: Array.from(oneTimeKeys),
      usedKeys: Array.from(usedKeys),
      closeAfterUse: Array.from(closeAfterUse)
    },
    multiKeyDoors: {},
    globalMessages: Object.fromEntries(globalMessages),
    doorMessages: {},
    keyMessages: {},
    directoryAccessMap: {},
    doorOpenCallbacks: Array.from(doorOpenCallbacks.keys()),
    authorizationCallbacks: Array.from(authorizationCallbacks.keys())
  };
  
  // 转换 doorKeyRelations (Map<string, Set<string>>)
  for (const [doorId, keySet] of doorKeyRelations.entries()) {
    state.doorKeyRelations[doorId] = Array.from(keySet);
  }
  
  // 转换 keyDoorRelations (Map<string, Set<string>>)
  for (const [keyId, doorSet] of keyDoorRelations.entries()) {
    state.keyDoorRelations[keyId] = Array.from(doorSet);
  }
  
  // 转换 doorStates (Map<string, Object>)
  for (const [doorId, doorState] of doorStates.entries()) {
    // 创建状态副本，排除不可序列化的字段（如timeoutId）
    state.doorStates[doorId] = {
      isOpen: doorState.isOpen,
      lastKeyUsed: doorState.lastKeyUsed,
      requiredKeys: doorState.requiredKeys ? [...doorState.requiredKeys] : undefined,
      usedKeys: doorState.usedKeys ? [...doorState.usedKeys] : undefined,
      timeoutDuration: doorState.timeoutDuration,
      // New door visual state fields
      state: doorState.state,
      isLocked: doorState.isLocked,
      isEncrypted: doorState.isEncrypted,
      closedImagePath: doorState.closedImagePath,
      openedImagePath: doorState.openedImagePath,
      createdAt: doorState.createdAt,
      lastStateChange: doorState.lastStateChange
      // 注意：不导出 timeoutId，因为它不可序列化且在恢复时需要重新创建
    };
  }
  
  // 转换 multiKeyDoors (Map<string, Object>)
  for (const [doorId, config] of multiKeyDoors.entries()) {
    state.multiKeyDoors[doorId] = {
      requiredKeys: [...config.requiredKeys],
      timeoutDuration: config.timeoutDuration
    };
  }
  
  // 转换 doorMessages (Map<string, Map<string, string>>)
  for (const [doorId, msgMap] of doorMessages.entries()) {
    state.doorMessages[doorId] = Object.fromEntries(msgMap);
  }
  
  // 转换 keyMessages (Map<string, Map<string, string>>)
  for (const [keyId, msgMap] of keyMessages.entries()) {
    state.keyMessages[keyId] = Object.fromEntries(msgMap);
  }
  
  // 转换 directoryAccessMap (Map<string, Object>)
  for (const [dirPath, accessInfo] of directoryAccessMap.entries()) {
    state.directoryAccessMap[dirPath] = {
      doorId: accessInfo.doorId,
      isLocked: accessInfo.isLocked,
      requiredKeys: [...accessInfo.requiredKeys]
    };
  }
  
  console.log('[STATE_EXPORT] Export complete', {
    doorKeyRelations: Object.keys(state.doorKeyRelations).length,
    keyDoorRelations: Object.keys(state.keyDoorRelations).length,
    encryptedItems: state.encryptedItems.length,
    doorStates: Object.keys(state.doorStates).length,
    oneTimeKeys: state.oneTimeKeys.keys.length,
    multiKeyDoors: Object.keys(state.multiKeyDoors).length
  });
  
  return state;
}

/**
 * 导入并恢复门钥匙关系状态
 * @param {Object} relationshipState - 之前导出的状态对象
 */
export function importRelationshipState(relationshipState) {
  if (!relationshipState || typeof relationshipState !== 'object') {
    console.error('[STATE_IMPORT] Invalid relationship state provided:', relationshipState);
    throw new Error('Invalid relationship state: must be an object');
  }
  
  console.log('[STATE_IMPORT] Importing door-key relationship state');
  
  try {
    // 清除现有状态
    doorKeyRelations.clear();
    keyDoorRelations.clear();
    encryptedItems.clear();
    doorStates.clear();
    oneTimeKeys.clear();
    usedKeys.clear();
    closeAfterUse.clear();
    multiKeyDoors.clear();
    globalMessages.clear();
    doorMessages.clear();
    keyMessages.clear();
    directoryAccessMap.clear();
    doorOpenCallbacks.clear();
    authorizationCallbacks.clear();
    
    // 恢复 doorKeyRelations
    if (relationshipState.doorKeyRelations) {
      for (const [doorId, keyArray] of Object.entries(relationshipState.doorKeyRelations)) {
        doorKeyRelations.set(doorId, new Set(keyArray));
      }
    }
    
    // 恢复 keyDoorRelations
    if (relationshipState.keyDoorRelations) {
      for (const [keyId, doorArray] of Object.entries(relationshipState.keyDoorRelations)) {
        keyDoorRelations.set(keyId, new Set(doorArray));
      }
    }
    
    // 恢复 encryptedItems
    if (Array.isArray(relationshipState.encryptedItems)) {
      relationshipState.encryptedItems.forEach(itemId => encryptedItems.add(itemId));
    }
    
    // 恢复 doorStates
    if (relationshipState.doorStates) {
      for (const [doorId, doorState] of Object.entries(relationshipState.doorStates)) {
        // 恢复状态，但不恢复 timeoutId（需要在多钥匙门逻辑中重新创建）
        doorStates.set(doorId, {
          isOpen: doorState.isOpen,
          lastKeyUsed: doorState.lastKeyUsed,
          requiredKeys: doorState.requiredKeys ? [...doorState.requiredKeys] : undefined,
          usedKeys: doorState.usedKeys ? [...doorState.usedKeys] : undefined,
          timeoutDuration: doorState.timeoutDuration,
          timeoutId: null, // 将在需要时重新创建
          // Restore new door visual state fields
          state: doorState.state,
          isLocked: doorState.isLocked,
          isEncrypted: doorState.isEncrypted,
          closedImagePath: doorState.closedImagePath,
          openedImagePath: doorState.openedImagePath,
          createdAt: doorState.createdAt,
          lastStateChange: doorState.lastStateChange
        });
      }
    }
    
    // 恢复 oneTimeKeys 系统
    if (relationshipState.oneTimeKeys) {
      if (Array.isArray(relationshipState.oneTimeKeys.keys)) {
        relationshipState.oneTimeKeys.keys.forEach(keyId => oneTimeKeys.add(keyId));
      }
      if (Array.isArray(relationshipState.oneTimeKeys.usedKeys)) {
        relationshipState.oneTimeKeys.usedKeys.forEach(keyId => usedKeys.add(keyId));
      }
      if (Array.isArray(relationshipState.oneTimeKeys.closeAfterUse)) {
        relationshipState.oneTimeKeys.closeAfterUse.forEach(keyId => closeAfterUse.add(keyId));
      }
    }
    
    // 恢复 multiKeyDoors
    if (relationshipState.multiKeyDoors) {
      for (const [doorId, config] of Object.entries(relationshipState.multiKeyDoors)) {
        multiKeyDoors.set(doorId, {
          requiredKeys: [...config.requiredKeys],
          timeoutDuration: config.timeoutDuration
        });
        
        // 如果门有进度且未完成，重新启动超时计时器
        const doorState = doorStates.get(doorId);
        if (doorState && doorState.usedKeys && doorState.usedKeys.length > 0 && !doorState.isOpen) {
          startMultiKeyTimeout(doorId);
          console.log(`[STATE_IMPORT] Restarted timeout for multi-key door '${doorId}'`);
        }
      }
    }
    
    // 恢复 globalMessages
    if (relationshipState.globalMessages) {
      for (const [messageType, template] of Object.entries(relationshipState.globalMessages)) {
        globalMessages.set(messageType, template);
      }
    }
    
    // 恢复 doorMessages
    if (relationshipState.doorMessages) {
      for (const [doorId, messages] of Object.entries(relationshipState.doorMessages)) {
        const msgMap = new Map();
        for (const [messageType, template] of Object.entries(messages)) {
          msgMap.set(messageType, template);
        }
        doorMessages.set(doorId, msgMap);
      }
    }
    
    // 恢复 keyMessages
    if (relationshipState.keyMessages) {
      for (const [keyId, messages] of Object.entries(relationshipState.keyMessages)) {
        const msgMap = new Map();
        for (const [messageType, template] of Object.entries(messages)) {
          msgMap.set(messageType, template);
        }
        keyMessages.set(keyId, msgMap);
      }
    }
    
    // 恢复 directoryAccessMap
    if (relationshipState.directoryAccessMap) {
      for (const [dirPath, accessInfo] of Object.entries(relationshipState.directoryAccessMap)) {
        directoryAccessMap.set(dirPath, {
          doorId: accessInfo.doorId,
          isLocked: accessInfo.isLocked,
          requiredKeys: [...accessInfo.requiredKeys]
        });
      }
    }
    
    // 注意：不恢复 doorOpenCallbacks 和 authorizationCallbacks
    // 这些是运行时回调函数，不能序列化，需要在应用启动时重新注册
    if (relationshipState.doorOpenCallbacks && relationshipState.doorOpenCallbacks.length > 0) {
      console.log('[STATE_IMPORT] Note: Door open callbacks need to be re-registered for doors:', relationshipState.doorOpenCallbacks);
    }
    if (relationshipState.authorizationCallbacks && relationshipState.authorizationCallbacks.length > 0) {
      console.log('[STATE_IMPORT] Note: Authorization callbacks need to be re-registered for doors:', relationshipState.authorizationCallbacks);
    }
    
    console.log('[STATE_IMPORT] Import complete', {
      doorKeyRelations: doorKeyRelations.size,
      keyDoorRelations: keyDoorRelations.size,
      encryptedItems: encryptedItems.size,
      doorStates: doorStates.size,
      oneTimeKeys: oneTimeKeys.size,
      multiKeyDoors: multiKeyDoors.size
    });
    
  } catch (error) {
    console.error('[STATE_IMPORT] Error during import:', error);
    throw new Error(`Failed to import relationship state: ${error.message}`);
  }
}

