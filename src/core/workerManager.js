import { Worker } from 'worker_threads';
import { getBounds, getAllWindows } from './windowManager.js';
import { canOpenDoor, handleFailedOpen, handleDoorToggle } from './doorKeySystem.js';
import { isLevel1Completed } from './gameLogic.js';
import '../../logger.js'; // 导入日志系统

let worker = null;
let overlapTimer = null;

/**
 * 初始化 Worker
 */
export function initializeWorker() {
  worker = new Worker(new URL('../../nodeWorker.mjs', import.meta.url));
  
  // Worker 消息处理器
  worker.on('message', (msg) => {
    console.debug('Received message from worker thread:', msg);
    
    if (msg.type === 'overlapResult') {
      const { ratio, doorId, keyId, threshold } = msg;
      console.debug(`[WORKER] 重叠比例: ${ratio.toFixed(4)}`);
      
      if (ratio >= threshold) {
        // 检查开门权限
        if (canOpenDoor(doorId, keyId)) {
          console.log(`[LEVEL1] ${keyId} 与 ${doorId} 重叠，尝试开关门...`);
          handleDoorToggle(doorId, keyId);
        } else {
          console.warn(`[LEVEL1] ${keyId} 无法打开 ${doorId}（权限不足）`);
          handleFailedOpen(doorId, keyId);
        }
      }
    }
  });
  
  console.debug('[WORKER] Worker 已初始化');
}

/**
 * 启动重叠检测循环
 */
export function startOverlapLoop() {
  if (overlapTimer) {
    console.debug('[OVERLAP] 重叠检测循环已在运行，跳过启动');
    return;
  }
  
  console.debug('[OVERLAP] 设置定时器，每1000ms检测一次');
  overlapTimer = setInterval(() => {
    // 检查所有门和钥匙的重叠
    const windows = getAllWindows();
    
    for (const [doorId, doorWin] of windows) {
      if (typeof doorId !== 'string' || !doorId.startsWith('door')) continue;
      
      for (const [keyId, keyWin] of windows) {
        if (typeof keyId !== 'string' || !keyId.startsWith('key')) continue;
        
        const doorBounds = doorWin.getBounds();
        const keyBounds = keyWin.getBounds();
        
        // 发送到 Worker 计算重叠
        if (worker) {
          worker.postMessage({ 
            type: 'calculateOverlap',
            doorBounds: doorBounds,
            keyBounds: keyBounds,
            doorId: doorId,
            keyId: keyId,
            threshold: 0.6
          });
        }
      }
    }
  }, 1000);
  
  console.debug('[OVERLAP] 重叠检测循环已启动');
}

/**
 * 停止重叠检测循环
 */
export function stopOverlapLoop() {
  if (overlapTimer) {
    clearInterval(overlapTimer);
    overlapTimer = null;
    console.debug('[OVERLAP] 重叠检测循环已停止');
  }
}

/**
 * 重启重叠检测循环
 */
export function restartOverlapLoop() {
  stopOverlapLoop();
  startOverlapLoop();
}

/**
 * 获取 Worker 状态
 * @returns {Object} Worker 状态信息
 */
export function getWorkerStatus() {
  return {
    workerExists: worker !== null,
    timerExists: overlapTimer !== null,
    level1Completed: isLevel1Completed()
  };
}

/**
 * 清理 Worker 资源
 */
export function cleanupWorker() {
  stopOverlapLoop();
  
  if (worker) {
    worker.terminate();
    worker = null;
    console.debug('[WORKER] Worker 已终止');
  }
}

