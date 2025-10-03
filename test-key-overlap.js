// 测试钥匙与门重叠避免功能的脚本
import { 
  setKeyDoorMaxOverlap, 
  getKeyDoorMaxOverlap,
  createDoor,
  createKey,
  getAllWindows 
} from './src/core/windowManager.js';
import './logger.js';

// 设置日志级别
global.logLevel = "log";

console.log('=== 钥匙与门重叠避免功能测试 ===');

// 测试1: 设置重叠阈值
console.log('\n1. 设置重叠阈值');
setKeyDoorMaxOverlap(0.4); // 40%
console.log('当前最大重叠比例:', (getKeyDoorMaxOverlap() * 100).toFixed(1) + '%');

// 测试2: 创建门窗口
console.log('\n2. 创建门窗口');
const door1 = createDoor('door1', 'Main Door', false);
const door2 = createDoor('door2', 'Secret Door', true);
const door3 = createDoor('door3', 'Back Door', true);

// 等待门窗口创建完成
setTimeout(() => {
  console.log('门窗口创建完成');
  
  // 测试3: 创建钥匙窗口（应该自动避免重叠）
  console.log('\n3. 创建钥匙窗口（自动避免与门重叠超过40%）');
  
  const key1 = createKey('key1', 'Master Key', false);
  
  setTimeout(() => {
    console.log('第一个钥匙创建完成');
    
    const key2 = createKey('key2', 'Secret Key', true);
    
    setTimeout(() => {
      console.log('第二个钥匙创建完成');
      
      const key3 = createKey('key3', 'Multi Key', true);
      
      setTimeout(() => {
        console.log('第三个钥匙创建完成');
        
        // 显示所有窗口信息
        console.log('\n4. 所有窗口位置信息:');
        const allWindows = getAllWindows();
        
        // 按类型分组显示
        const doors = [];
        const keys = [];
        
        for (const [id, win] of allWindows) {
          const bounds = win.getBounds();
          const info = {
            id,
            position: `(${bounds.x}, ${bounds.y})`,
            size: `${bounds.width}x${bounds.height}`,
            bounds
          };
          
          if (id.startsWith('door')) {
            doors.push(info);
          } else if (id.startsWith('key')) {
            keys.push(info);
          }
        }
        
        console.log('\n门窗口:');
        doors.forEach(door => {
          console.log(`  ${door.id}: 位置${door.position}, 尺寸${door.size}`);
        });
        
        console.log('\n钥匙窗口:');
        keys.forEach(key => {
          console.log(`  ${key.id}: 位置${key.position}, 尺寸${key.size}`);
        });
        
        // 检查重叠情况
        console.log('\n5. 重叠检查结果:');
        let hasExcessiveOverlap = false;
        
        for (const key of keys) {
          for (const door of doors) {
            const overlapRatio = calculateOverlapRatio(key.bounds, door.bounds);
            const overlapPercent = (overlapRatio * 100).toFixed(1);
            
            console.log(`  ${key.id} 与 ${door.id} 重叠: ${overlapPercent}%`);
            
            if (overlapRatio > 0.4) {
              hasExcessiveOverlap = true;
              console.log(`    ⚠️  警告: 重叠超过40%阈值！`);
            }
          }
        }
        
        if (!hasExcessiveOverlap) {
          console.log('\n✅ 所有钥匙与门的重叠都在40%阈值以下');
        } else {
          console.log('\n❌ 存在钥匙与门重叠超过40%的情况');
        }
        
        console.log('\n=== 测试完成 ===');
        
      }, 1000);
    }, 1000);
  }, 1000);
}, 1000);

// 重叠计算函数（复制自windowManager.js）
function calculateOverlapRatio(rect1, rect2) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  const interWidth = Math.max(0, x2 - x1);
  const interHeight = Math.max(0, y2 - y1);
  const interArea = interWidth * interHeight;
  
  if (interArea <= 0) {
    return 0;
  }
  
  const rect1Area = rect1.width * rect1.height;
  const rect2Area = rect2.width * rect2.height;
  const minArea = Math.min(rect1Area, rect2Area);
  
  return interArea / minArea;
}
