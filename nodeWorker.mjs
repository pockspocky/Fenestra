import { Worker, workerData, parentPort } from 'worker_threads';
import './logger.js'; // 导入日志系统

// 设置日志级别
// global.logLevel = "debug"; // 可以改为 "debug", "log", "warn", "error", "none"

// 重叠计算函数
function rectOverlapRatio(a, b) {
  // a,b: {x,y,width,height}
  console.debug(`[WORKER] 计算重叠比例`);
  
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  
  if (interArea <= 0) {
    return 0;
  }
  
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  const ratio = interArea / Math.max(1, minArea);
  
  return ratio;
}

parentPort.on('message', (msg) => {
  console.debug('Received message from main thread:', msg);
  
  if (msg.type === 'calculateOverlap') {
    console.debug('[WORKER] 开始计算重叠...');
    console.debug('[WORKER] 门边界:', msg.doorBounds);
    console.debug('[WORKER] 钥匙边界:', msg.keyBounds);
    
    // 计算重叠比例
    const ratio = rectOverlapRatio(msg.doorBounds, msg.keyBounds);
    
    console.debug(`[WORKER] 计算完成，重叠比例: ${ratio.toFixed(4)}`);
    
    // 返回计算结果
    parentPort.postMessage({
      type: 'overlapResult',
      ratio: ratio,
      threshold: msg.threshold,
      doorBounds: msg.doorBounds,
      keyBounds: msg.keyBounds,
      doorId: msg.doorId,
      keyId: msg.keyId
    });
  } else {
    console.debug('[WORKER] 收到其他消息:', msg);
    parentPort.postMessage('Hello from worker thread!');
  }
});