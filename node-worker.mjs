import { Worker, workerData, parentPort } from 'worker_threads';
import { setTimeout } from 'node:timers/promises';
import { randomInt } from 'node:crypto';

function rectOverlapRatio(a, b) {
    // a,b: {x,y,width,height}
    // console.log(`[OVERLAP] 计算重叠比例`);
    // console.log(`[OVERLAP] 矩形A:`, a);
    // console.log(`[OVERLAP] 矩形B:`, b);
    
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    const interW = Math.max(0, x2 - x1);
    const interH = Math.max(0, y2 - y1);
    const interArea = interW * interH;
    
    // console.log(`[OVERLAP] 交集区域: ${interW} x ${interH} = ${interArea}`);
    
    if (interArea <= 0) {
    //   console.log(`[OVERLAP] 无重叠, 比例: 0`);
      return 0;
    }
    
    const minArea = Math.min(a.width * a.height, b.width * b.height);
    const ratio = interArea / Math.max(1, minArea);
    
    // console.log(`[OVERLAP] 最小面积: ${minArea}, 重叠比例: ${ratio.toFixed(4)}`);
    return ratio;
}

parentPort.on('message', async (msg) => {
    const ratio = rectOverlapRatio(msg.win1, msg.win2);
    if (ratio >= msg.ratio) {
        parentPort.postMessage(true);

    }
    parentPort.postMessage(ratio);
});