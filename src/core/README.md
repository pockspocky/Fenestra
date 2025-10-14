# 核心模块说明

## 文件结构

```
src/core/
├── index.js              # 统一导出文件
├── windowManager.js      # 窗口管理模块
├── doorKeySystem.js      # 门钥匙关系系统
├── gameLogic.js          # 游戏逻辑模块
├── workerManager.js      # Worker 线程管理
├── ipcHandlers.js        # IPC 通信处理
└── README.md            # 本文档
```

## 模块功能

### 1. windowManager.js
- **功能**: 窗口创建、管理、事件处理
- **导出**: 
  - `createWindow()` - 创建窗口
  - `getBounds()` / `setBounds()` - 窗口边界操作
  - `createDesktop()` / `createVideo()` - 特定窗口创建
  - `createDoor()` / `createKey()` - 门钥匙窗口创建

### 2. doorKeySystem.js
- **功能**: 门钥匙权限管理、重叠检测、动画效果
- **导出**:
  - `establishRelation()` - 建立门钥匙关系
  - `canOpenDoor()` - 权限检查
  - `handleDoorToggle()` - 开关门处理
  - `handleFailedOpen()` - 开门失败处理

### 3. gameLogic.js
- **功能**: 游戏状态管理、关卡逻辑
- **导出**:
  - `initializeGameLogic()` - 初始化游戏
  - `handleVideoWindowClosed()` - 视频窗口关闭处理
  - `createDemoDoorsAndKeys()` - 创建演示内容
  - `getGameState()` - 获取游戏状态

### 4. workerManager.js
- **功能**: Worker 线程管理、重叠检测循环
- **导出**:
  - `initializeWorker()` - 初始化 Worker
  - `startOverlapLoop()` / `stopOverlapLoop()` - 控制检测循环
  - `cleanupWorker()` - 清理 Worker 资源

### 5. ipcHandlers.js
- **功能**: IPC 通信处理、终端命令执行
- **导出**:
  - `initializeIpcHandlers()` - 初始化 IPC 处理程序
  - `cleanupIpcHandlers()` - 清理 IPC 处理程序

### 6. windowStorage.js
- **功能**: 窗口状态序列化、文件存储、配置恢复
- **导出**:
  - `saveWindowToFile()` - 保存窗口配置到文件
  - `loadWindowFromFile()` - 从文件加载窗口配置
  - `deserializeWindow()` - 反序列化并重建窗口
  - `listStoredWindows()` - 列出已保存的窗口文件
  - `deleteStoredWindow()` - 删除保存的窗口文件

### 7. lensSystem.js
- **功能**: 镜头系统、内容同步、位置追踪
- **导出**:
  - `createLensSystem()` - 创建镜头系统
  - `destroyLensSystem()` - 销毁镜头系统
  - `getLensSystemInfo()` - 获取镜头系统信息
  - `updateLensContent()` - 更新镜头内容

## 使用方式

### 在主文件中导入
```javascript
// 导入单个模块
import { createWindow } from './src/core/windowManager.js';

// 导入多个模块
import { createWindow, createDoor } from './src/core/windowManager.js';
import { canOpenDoor } from './src/core/doorKeySystem.js';

// 导入存储功能
import { saveWindowToFile, loadWindowFromFile } from './src/core/windowStorage.js';

// 统一导入
import { createWindow, canOpenDoor } from './src/core/index.js';
```

### 模块间依赖
- `windowManager.js` - 独立模块，提供基础窗口管理
- `windowStorage.js` - 依赖 `windowManager.js`, `lensSystem.js`
- `lensSystem.js` - 依赖 `windowManager.js`
- `doorKeySystem.js` - 依赖 `windowManager.js`
- `gameLogic.js` - 依赖 `windowManager.js`, `doorKeySystem.js`
- `workerManager.js` - 依赖所有其他模块
- `ipcHandlers.js` - 依赖 `windowManager.js`, `windowStorage.js`

## 优势

1. **模块化**: 每个文件职责单一，易于维护
2. **可复用**: 模块可以独立使用和测试
3. **清晰依赖**: 模块间依赖关系明确
4. **易于扩展**: 新功能可以轻松添加到对应模块
5. **代码分离**: 主文件 `main.js` 变得简洁易读
6. **状态持久化**: 窗口配置可以保存和恢复
7. **跨平台兼容**: 相对路径处理确保配置可移植

## 注意事项

- 所有模块都使用 ES6 模块语法
- 模块间通过导入/导出来共享功能
- 全局状态（如窗口映射）在 `windowManager.js` 中管理
- 每个模块都有完整的错误处理和日志记录
- 窗口存储使用 `.fenestra` 文件格式
- 存储目录默认为 `.fenestra-storage/`
- 支持拖拽 `.fenestra` 文件到终端进行恢复

## 新增功能

### 窗口存储系统
```javascript
// 保存窗口配置
import { saveWindowToFile } from './src/core/windowStorage.js';
const result = saveWindowToFile('window1', 'my-config.fenestra');

// 加载窗口配置
import { loadWindowFromFile, deserializeWindow } from './src/core/windowStorage.js';
const loadResult = loadWindowFromFile('my-config.fenestra');
if (loadResult.success) {
  const restoreResult = deserializeWindow(loadResult.data);
}

// 列出已保存的配置
import { listStoredWindows } from './src/core/windowStorage.js';
const files = listStoredWindows();
```

### 终端命令扩展
- `save-window [windowId] [filename]` - 保存窗口配置
- `restore-window [filepath]` - 恢复窗口配置
- `list-saved` - 列出已保存的配置文件
- `delete-saved [filename]` - 删除配置文件

