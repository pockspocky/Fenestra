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
    // 开门
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
    // 关门
    doorWin.setTitle(currentTitle.replace('(opened)', '(locked)').replace('(opened)', '(encrypted)'));
    doorStates.set(doorId, { isOpen: false, lastKeyUsed: keyId });
    
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

