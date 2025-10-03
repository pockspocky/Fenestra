# 钥匙与门重叠避免功能使用指南

## 概述

钥匙与门重叠避免功能确保生成的钥匙窗口不会与任何门窗口重叠超过指定的阈值（默认40%），提供更好的用户体验和视觉清晰度。

## 功能特性

### 🎯 智能位置查找
- 自动为钥匙窗口寻找合适的位置
- 避免与现有门窗口重叠超过配置的阈值
- 支持多种位置查找策略

### 🔧 可配置阈值
- 默认最大重叠比例：40%
- 支持动态调整重叠阈值
- 范围：0% - 100%

### 📍 多策略定位
- 左上角区域优先
- 右上角区域备选
- 左下角区域备选
- 随机位置最后尝试

## 使用方法

### 1. 基本使用

```javascript
import { createDoor, createKey } from './src/core/windowManager.js';

// 创建门窗口
const door1 = createDoor('door1', 'Main Door', false);
const door2 = createDoor('door2', 'Secret Door', true);

// 创建钥匙窗口（自动避免重叠）
const key1 = createKey('key1', 'Master Key', false);
const key2 = createKey('key2', 'Secret Key', true);
```

### 2. 配置重叠阈值

```javascript
import { setKeyDoorMaxOverlap, getKeyDoorMaxOverlap } from './src/core/windowManager.js';

// 设置最大重叠比例为30%
setKeyDoorMaxOverlap(0.3);

// 获取当前设置
const maxOverlap = getKeyDoorMaxOverlap();
console.log(`当前最大重叠比例: ${(maxOverlap * 100).toFixed(1)}%`);
```

### 3. 不同阈值的效果

```javascript
// 严格模式：最多20%重叠
setKeyDoorMaxOverlap(0.2);

// 宽松模式：最多60%重叠
setKeyDoorMaxOverlap(0.6);

// 无限制模式：允许100%重叠
setKeyDoorMaxOverlap(1.0);
```

## 重叠计算

### 算法说明
重叠比例基于两个矩形的最小面积计算：

```javascript
overlapRatio = intersectionArea / min(rect1Area, rect2Area)
```

### 示例计算
```
门窗口: (100, 100, 320, 420)  // x, y, width, height
钥匙窗口: (150, 150, 200, 200)

重叠区域: (150, 150, 200, 200)
重叠面积: 200 * 200 = 40000

门面积: 320 * 420 = 134400
钥匙面积: 200 * 200 = 40000
最小面积: min(134400, 40000) = 40000

重叠比例: 40000 / 40000 = 1.0 (100%)
```

## 位置查找策略

### 1. 左上角区域（前10次尝试）
```
位置模式：
(100, 100), (350, 100), (600, 100), (850, 100), (1100, 100)
(100, 250), (350, 250), (600, 250), (850, 250), (1100, 250)
```

### 2. 右上角区域（接下来10次尝试）
```
位置模式：
从屏幕右侧向左排列，避免与现有窗口重叠
```

### 3. 左下角区域（接下来10次尝试）
```
位置模式：
从屏幕底部向上排列，避免与现有窗口重叠
```

### 4. 随机位置（最后20次尝试）
```
位置模式：
在屏幕可用区域内随机选择位置
```

## 配置建议

### 开发环境
```javascript
// 较严格的重叠控制，便于调试
setKeyDoorMaxOverlap(0.2); // 20%
```

### 生产环境
```javascript
// 平衡用户体验和屏幕空间利用
setKeyDoorMaxOverlap(0.4); // 40%
```

### 测试环境
```javascript
// 宽松的重叠控制，快速测试
setKeyDoorMaxOverlap(0.6); // 60%
```

## 日志输出

系统会记录详细的位置查找过程：

```
[KEY_POSITION] 为钥匙 key1 寻找合适位置，避免与门重叠超过 40%
[OVERLAP_CHECK] 检查与窗口 door1 的重叠: 85.2%
[KEY_POSITION] 位置 (100, 100) 与窗口 door1 重叠 85.2%，继续尝试...
[OVERLAP_CHECK] 检查与窗口 door1 的重叠: 12.5%
[KEY_POSITION] 找到合适位置: (350, 250), 尝试次数: 3
```

## 性能考虑

### 查找效率
- 最多尝试50个位置
- 每个位置检查所有现有窗口
- 时间复杂度：O(n * m)，其中n是尝试次数，m是窗口数量

### 优化建议
- 门窗口数量较少时性能最佳
- 屏幕空间充足时查找更快
- 阈值设置合理时减少查找时间

## 测试

运行测试脚本查看效果：

```bash
node test-key-overlap.js
```

测试脚本会：
1. 创建多个门窗口
2. 创建多个钥匙窗口
3. 检查所有重叠情况
4. 验证是否超过阈值

## 故障排除

### 问题：钥匙窗口重叠仍然超过阈值
- 检查阈值设置是否正确
- 确认屏幕空间是否充足
- 查看日志了解查找过程

### 问题：找不到合适位置
- 增加屏幕尺寸设置
- 降低重叠阈值
- 检查门窗口数量和位置

### 问题：性能问题
- 减少门窗口数量
- 优化屏幕尺寸设置
- 考虑使用更宽松的阈值

## 高级用法

### 自定义位置查找
```javascript
// 可以在 findSuitablePositionForKey 函数中添加自定义逻辑
// 例如：优先放置在特定区域
```

### 动态调整
```javascript
// 根据屏幕大小动态调整阈值
const screenSize = getScreenSize();
if (screenSize.width < 1200) {
  setKeyDoorMaxOverlap(0.3); // 小屏幕使用更严格的阈值
} else {
  setKeyDoorMaxOverlap(0.4); // 大屏幕使用标准阈值
}
```

### 批量创建
```javascript
// 创建多个钥匙时，系统会自动处理位置冲突
const keys = ['key1', 'key2', 'key3', 'key4'];
keys.forEach(keyId => {
  createKey(keyId, `Key ${keyId}`, false);
});
```
