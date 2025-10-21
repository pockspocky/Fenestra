# 日志系统使用指南

## 概述

所有核心模块都已集成了统一的日志系统，支持不同级别的日志输出。

## 日志级别

| 级别 | 描述 | 显示内容 |
|------|------|----------|
| `debug` | 调试信息 | 所有日志 |
| `log` | 普通信息 | log, warn, error |
| `warn` | 警告信息 | warn, error |
| `error` | 错误信息 | 只显示 error |
| `none` | 静默模式 | 不显示任何日志 |

## 使用方法

### 1. 基本日志调用

```javascript
// 调试信息（只在 debug 级别显示）
console.debug('这是调试信息');

// 普通信息（在 log, debug 级别显示）
console.log('这是普通信息');

// 警告信息（在 warn, log, debug 级别显示）
console.warn('这是警告信息');

// 错误信息（在所有级别显示，除了 none）
console.error('这是错误信息');
```

### 2. 设置日志级别

```javascript
import { setLogLevel } from './src/core/loggerConfig.js';

// 开发环境
setLogLevel("debug");

// 生产环境
setLogLevel("warn");

// 测试环境
setLogLevel("error");

// 完全静默
setLogLevel("none");
```

### 3. 环境自动设置

```javascript
import { setLogLevelFromEnv } from './src/core/loggerConfig.js';

// 根据 NODE_ENV 自动设置
setLogLevelFromEnv();
// development -> debug
// production -> warn  
// test -> error
```

### 4. 获取当前设置

```javascript
import { getLogLevel, getAvailableLogLevels } from './src/core/loggerConfig.js';

console.log('当前日志级别:', getLogLevel());
console.log('可用级别:', getAvailableLogLevels());
```

## 各模块日志使用

### windowManager.js
- `debug`: 窗口创建、配置、事件处理
- `log`: 窗口状态变化
- `warn`: 窗口操作失败

### doorKeySystem.js
- `debug`: 关系建立、权限检查过程
- `log`: 开关门操作、钥匙弹开
- `warn`: 权限不足、开门失败
- `error`: 系统错误

### gameLogic.js
- `debug`: 游戏状态变化、关卡逻辑
- `log`: 重要游戏事件
- `warn`: 游戏逻辑异常

### workerManager.js
- `debug`: Worker 消息、重叠计算
- `log`: 重要 Worker 事件
- `warn`: Worker 异常

### ipcHandlers.js
- `debug`: IPC 请求处理过程
- `warn`: IPC 参数错误
- `error`: IPC 处理失败

### nodeWorker.mjs
- `debug`: 重叠计算过程
- `log`: 计算结果
- `warn`: 计算异常

## 最佳实践

### 1. 日志级别选择
```javascript
// ✅ 正确：根据重要性选择级别
console.debug('窗口移动事件触发'); // 调试信息
console.log('用户成功开门'); // 重要信息
console.warn('钥匙权限不足'); // 警告
console.error('系统崩溃'); // 错误

// ❌ 错误：滥用日志级别
console.error('窗口移动'); // 这不是错误
console.debug('系统崩溃'); // 这应该是错误
```

### 2. 结构化日志
```javascript
// ✅ 推荐：结构化日志
console.log(`[DOOR] ${doorId} 已打开，钥匙: ${keyId}`);
console.debug(`[WORKER] 重叠比例: ${ratio.toFixed(4)}`);

// ❌ 不推荐：非结构化日志
console.log('门打开了');
console.debug('重叠比例是 0.6');
```

### 3. 性能考虑
```javascript
// ✅ 正确：只在需要时计算
if (global.logLevel === 'debug') {
  console.debug('复杂计算结果:', expensiveCalculation());
}

// 或者使用条件日志
console.debug('计算结果:', () => expensiveCalculation());
```

## 默认配置

系统默认使用 `debug` 级别，显示所有日志信息，适合开发和调试。

## 配置建议

### 开发环境
```javascript
setLogLevel("debug"); // 显示所有日志（默认设置）
```

### 生产环境
```javascript
setLogLevel("warn"); // 只显示警告和错误
```

### 测试环境
```javascript
setLogLevel("error"); // 只显示错误
```

### 调试特定模块
```javascript
// 临时设置为 debug 来调试特定问题
setLogLevel("debug");
// ... 调试代码 ...
setLogLevel("log"); // 恢复原设置
```

## 故障排除

### 问题：看不到日志输出
1. 检查日志级别设置
2. 确认 `logger.js` 已正确导入
3. 检查 `global.logLevel` 值

### 问题：日志输出过多
1. 提高日志级别（如从 `debug` 改为 `log`）
2. 检查是否有不必要的 `console.debug` 调用

### 问题：日志输出过少
1. 降低日志级别（如从 `warn` 改为 `log`）
2. 确认重要信息使用了正确的日志级别
