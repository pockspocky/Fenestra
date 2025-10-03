# 窗口偏移功能使用指南

## 概述

窗口偏移功能允许新创建的窗口自动相对于最后一个窗口进行偏移，避免窗口完全重叠。

## 功能特性

### 🎯 自动偏移
- 新窗口会自动基于最后一个窗口的位置进行偏移
- 默认偏移量：水平30像素，垂直30像素
- 支持自定义偏移量

### 🔧 灵活配置
- 可以设置自定义偏移量
- 可以获取当前偏移量配置
- 支持在运行时动态调整

### 📍 智能定位
- 如果指定了具体位置（x, y），使用指定位置
- 如果没有指定位置，使用自动偏移
- 第一个窗口使用默认起始位置 (100, 100)

## 使用方法

### 1. 基本使用

```javascript
import { createWindow } from './src/core/windowManager.js';

// 创建窗口（自动偏移）
const win1 = createWindow('window1', { width: 400, height: 300 });
const win2 = createWindow('window2', { width: 400, height: 300 }); // 自动偏移
const win3 = createWindow('window3', { width: 400, height: 300 }); // 自动偏移
```

### 2. 设置偏移量

```javascript
import { setWindowOffset, getWindowOffset } from './src/core/windowManager.js';

// 设置偏移量（水平50像素，垂直50像素）
setWindowOffset(50, 50);

// 获取当前偏移量
const offset = getWindowOffset();
console.log('当前偏移量:', offset); // { x: 50, y: 50 }
```

### 3. 混合使用

```javascript
// 第一个窗口指定位置
const win1 = createWindow('window1', { 
  width: 400, 
  height: 300, 
  x: 200, 
  y: 200 
});

// 后续窗口自动偏移
const win2 = createWindow('window2', { width: 400, height: 300 }); // 自动偏移到 (230, 230)
const win3 = createWindow('window3', { width: 400, height: 300 }); // 自动偏移到 (260, 260)
```

## 配置示例

### 开发环境
```javascript
// 较大的偏移量，便于调试
setWindowOffset(50, 50);
```

### 生产环境
```javascript
// 较小的偏移量，节省屏幕空间
setWindowOffset(20, 20);
```

### 测试环境
```javascript
// 最小偏移量，快速测试
setWindowOffset(10, 10);
```

## 实际应用

### 门和钥匙窗口
```javascript
// 门和钥匙会自动偏移排列
const door1 = createDoor('door1', 'Main Door', false);
const door2 = createDoor('door2', 'Secret Door', true);
const key1 = createKey('key1', 'Master Key', false);
const key2 = createKey('key2', 'Secret Key', true);
```

### 桌面和视频窗口
```javascript
// 桌面窗口指定位置，视频窗口自动偏移
const desktop = createDesktop(); // 指定位置
const video = createVideo();     // 自动偏移
```

## 日志输出

系统会记录窗口偏移的相关信息：

```
[WINDOW_OFFSET] 窗口偏移量设置为: (30, 30)
[WINDOW_OFFSET] 计算新窗口位置: (230, 230), 基于窗口: door1
[WINDOW] 开始创建窗口 ID: door2
```

## 测试

运行测试脚本查看效果：

```bash
node test-window-offset.js
```

## 注意事项

1. **偏移计算**：偏移是基于最后一个创建的窗口位置
2. **窗口顺序**：窗口创建顺序影响偏移计算
3. **指定位置**：如果指定了 x, y 坐标，不会使用自动偏移
4. **性能**：偏移计算是轻量级的，不会影响性能

## 故障排除

### 问题：窗口没有偏移
- 检查是否调用了 `setWindowOffset()`
- 确认窗口创建时没有指定 x, y 坐标
- 查看日志确认偏移计算过程

### 问题：偏移量不合适
- 使用 `setWindowOffset()` 调整偏移量
- 根据屏幕大小和窗口大小调整
- 考虑不同操作系统的差异

### 问题：窗口重叠
- 增加偏移量
- 检查窗口大小设置
- 确认屏幕分辨率足够
