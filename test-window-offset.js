// 测试窗口偏移功能的脚本
import { 
  setWindowOffset, 
  getWindowOffset, 
  createWindow, 
  getAllWindows 
} from './src/core/windowManager.js';
import './logger.js';

// 设置日志级别
global.logLevel = "log";

console.log('=== 窗口偏移功能测试 ===');

// 测试1: 设置偏移量
console.log('\n1. 设置窗口偏移量');
setWindowOffset(50, 50);
console.log('当前偏移量:', getWindowOffset());

// 测试2: 创建多个窗口查看偏移效果
console.log('\n2. 创建测试窗口');

// 创建第一个窗口（指定位置）
const win1 = createWindow('test1', { 
  width: 300, 
  height: 200, 
  x: 100, 
  y: 100, 
  title: 'Test Window 1 (指定位置)' 
});

// 等待一下让第一个窗口创建完成
setTimeout(() => {
  console.log('第一个窗口创建完成');
  
  // 创建第二个窗口（自动偏移）
  const win2 = createWindow('test2', { 
    width: 300, 
    height: 200, 
    title: 'Test Window 2 (自动偏移)' 
  });
  
  setTimeout(() => {
    console.log('第二个窗口创建完成');
    
    // 创建第三个窗口（自动偏移）
    const win3 = createWindow('test3', { 
      width: 300, 
      height: 200, 
      title: 'Test Window 3 (自动偏移)' 
    });
    
    setTimeout(() => {
      console.log('第三个窗口创建完成');
      
      // 显示所有窗口信息
      console.log('\n3. 所有窗口信息:');
      const allWindows = getAllWindows();
      for (const [id, win] of allWindows) {
        const bounds = win.getBounds();
        console.log(`窗口 ${id}: 位置(${bounds.x}, ${bounds.y}), 尺寸(${bounds.width}x${bounds.height})`);
      }
      
      console.log('\n=== 测试完成 ===');
      console.log('你应该看到窗口按照偏移量依次排列');
      
    }, 1000);
  }, 1000);
}, 1000);
