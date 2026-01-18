/**
 * 镜头窗口系统
 * 管理镜头窗口与内容窗口的同步
 */

import '../../logger.js';
import {
  triggerLensCreated,
  triggerLensMoved,
  triggerLensDestroyed,
  triggerLensTrackingStarted,
  triggerLensTrackingStopped
} from '../core/callbacks/lensCallbacks.js';

// 存储镜头系统的映射关系
const lensSystems = new Map(); // lensId -> { lensWindow, targetWindow, targetWindowId }

/**
 * 注册镜头系统
 * @param {string} lensId - 镜头窗口ID
 * @param {BrowserWindow} lensWindow - 镜头窗口对象
 * @param {string} targetWindowId - 目标窗口ID
 * @param {BrowserWindow} targetWindow - 目标窗口对象
 */
export function registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow) {
  console.log(`[LENS_SYS] 注册镜头系统: ${lensId} -> ${targetWindowId}`);
  
  if (lensSystems.has(lensId)) {
    console.warn(`[LENS_SYS] 镜头 ${lensId} 已存在，将被覆盖`);
  }

  const system = {
    lensWindow,
    targetWindow,
    targetWindowId,
    isTracking: false,
    moveListener: null,
  };

  lensSystems.set(lensId, system);
  
  // Trigger lens created callback
  triggerLensCreated(lensId, {
    targetWindowId,
    lensWindow,
    targetWindow
  });
  
  // 开始位置追踪
  startPositionTracking(lensId, system);

  console.log(`[LENS_SYS] 镜头系统注册成功，当前总数: ${lensSystems.size}`);
}

/**
 * 注销镜头系统
 * @param {string} lensId - 镜头窗口ID
 */
export function unregisterLensSystem(lensId) {
  console.log(`[LENS_SYS] 注销镜头系统: ${lensId}`);
  
  const system = lensSystems.get(lensId);
  if (!system) {
    console.warn(`[LENS_SYS] 镜头 ${lensId} 不存在`);
    return;
  }

  // 停止位置追踪
  stopPositionTracking(lensId, system);

  // Trigger lens destroyed callback
  triggerLensDestroyed(lensId);

  lensSystems.delete(lensId);
  console.log(`[LENS_SYS] 镜头系统注销成功，当前总数: ${lensSystems.size}`);
}

/**
 * 获取镜头系统信息
 * @param {string} lensId - 镜头窗口ID
 * @returns {Object|null} 镜头系统信息
 */
export function getLensSystemInfo(lensId) {
  const system = lensSystems.get(lensId);
  if (!system) {
    return null;
  }

  const { lensWindow, targetWindow, targetWindowId } = system;

  if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
    console.warn(`[LENS_SYS] 镜头或目标窗口已销毁: ${lensId}`);
    unregisterLensSystem(lensId);
    return null;
  }

  return {
    lensId,
    targetWindowId,
    lensBounds: lensWindow.getBounds(),
    targetBounds: targetWindow.getBounds(),
    isTracking: system.isTracking,
  };
}

/**
 * 获取所有镜头系统
 * @returns {Array} 镜头系统列表
 */
export function getAllLensSystems() {
  const systems = [];
  
  for (const [lensId, system] of lensSystems.entries()) {
    const info = getLensSystemInfo(lensId);
    if (info) {
      systems.push(info);
    }
  }

  return systems;
}

/**
 * 开始位置追踪
 * @param {string} lensId - 镜头窗口ID
 * @param {Object} system - 镜头系统对象
 */
function startPositionTracking(lensId, system) {
  if (system.isTracking) {
    console.warn(`[LENS_SYS] 镜头 ${lensId} 已在追踪中`);
    return;
  }

  const { lensWindow, targetWindow } = system;

  // 监听镜头窗口移动
  const lensMoveListener = () => {
    if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
      stopPositionTracking(lensId, system);
      return;
    }

    const lensBounds = lensWindow.getBounds();
    const targetBounds = targetWindow.getBounds();

    // 计算相对位置
    const relativeX = lensBounds.x - targetBounds.x;
    const relativeY = lensBounds.y - targetBounds.y;

    console.debug(`[LENS_SYS] 镜头 ${lensId} 移动: 相对位置 (${relativeX}, ${relativeY})`);

    // Trigger lens moved callback
    triggerLensMoved(lensId, {
      x: lensBounds.x,
      y: lensBounds.y,
      relativeX,
      relativeY
    });

    // 通知镜头窗口更新显示区域
    if (!lensWindow.isDestroyed()) {
      lensWindow.webContents.send('lens-position-update', {
        lensBounds,
        targetBounds,
        relativeX,
        relativeY,
      });
    }
  };

  // 监听目标窗口移动
  const targetMoveListener = () => {
    if (lensWindow.isDestroyed() || targetWindow.isDestroyed()) {
      stopPositionTracking(lensId, system);
      return;
    }

    const targetBounds = targetWindow.getBounds();

    console.debug(`[LENS_SYS] 目标窗口 ${system.targetWindowId} 移动`);

    // 通知镜头窗口目标窗口已移动
    if (!lensWindow.isDestroyed()) {
      lensWindow.webContents.send('target-window-move', {
        windowId: system.targetWindowId,
        bounds: targetBounds,
      });
    }
  };

  // 注册事件监听器
  lensWindow.on('move', lensMoveListener);
  lensWindow.on('moved', lensMoveListener); // macOS使用'moved'
  targetWindow.on('move', targetMoveListener);
  targetWindow.on('moved', targetMoveListener);

  // 保存监听器引用
  system.moveListener = {
    lensMove: lensMoveListener,
    targetMove: targetMoveListener,
  };

  system.isTracking = true;
  console.log(`[LENS_SYS] 镜头 ${lensId} 开始位置追踪`);

  // Trigger lens tracking started callback
  triggerLensTrackingStarted(lensId);

  // 立即触发一次更新
  lensMoveListener();
}

/**
 * 停止位置追踪
 * @param {string} lensId - 镜头窗口ID
 * @param {Object} system - 镜头系统对象
 */
function stopPositionTracking(lensId, system) {
  if (!system.isTracking) {
    return;
  }

  const { lensWindow, targetWindow, moveListener } = system;

  // 移除事件监听器
  if (moveListener && !lensWindow.isDestroyed()) {
    lensWindow.removeListener('move', moveListener.lensMove);
    lensWindow.removeListener('moved', moveListener.lensMove);
  }

  if (moveListener && !targetWindow.isDestroyed()) {
    targetWindow.removeListener('move', moveListener.targetMove);
    targetWindow.removeListener('moved', moveListener.targetMove);
  }

  system.isTracking = false;
  system.moveListener = null;

  // Trigger lens tracking stopped callback
  triggerLensTrackingStopped(lensId);

  console.log(`[LENS_SYS] 镜头 ${lensId} 停止位置追踪`);
}

/**
 * 获取当前镜头系统数量
 * @returns {number} 镜头数量
 */
export function getLensSystemCount() {
  return lensSystems.size;
}

/**
 * 检查镜头ID是否已存在
 * @param {string} lensId - 镜头窗口ID
 * @returns {boolean} 是否存在
 */
export function lensSystemExists(lensId) {
  return lensSystems.has(lensId);
}


