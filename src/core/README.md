# 核心模块说明

## 文件结构

```
src/core/
├── index.js                    # 统一导出文件
├── config.js                   # 配置管理模块
├── windowManager.js            # 窗口管理模块
├── doorKeySystem.js            # 门钥匙关系系统
├── gameLogic.js                # 游戏逻辑模块
├── lensSystem.js               # 镜头系统模块
├── windowStorage.js            # 窗口存储模块
├── workerManager.js            # Worker 线程管理
├── ipcHandlers.js              # IPC 通信处理
├── loggerConfig.js             # 日志配置模块
├── LOGGING_GUIDE.md            # 日志系统指南
├── README.md                   # 本文档
└── utils/                      # 工具模块
    ├── directoryNavigator.js   # 目录导航工具
    ├── errorHandler.js         # 错误处理工具
    ├── pathSecurityValidator.js # 路径安全验证
    └── ERROR_HANDLING_GUIDE.md # 错误处理指南
```

## 模块功能

### 1. windowManager.js
**窗口创建、管理、事件处理、位置计算**

#### 核心窗口管理
- `createWindow(id, opts)` - 创建通用窗口
- `getAllWindows()` - 获取所有窗口映射
- `getWindow(id)` - 获取指定窗口
- `getBounds(id)` / `setBounds(id, bounds)` - 窗口边界操作
- `setWindowCloseCallback(callback)` - 设置窗口关闭回调

#### 特定窗口类型
- `createDesktop()` - 创建桌面窗口
- `createVideo()` - 创建视频窗口
- `createTerminal()` - 创建终端窗口
- `createDoor(doorId, title, encrypt, otherContents)` - 创建门窗口
- `createKey(keyId, title, encrypt, relatedDoors, otherContents)` - 创建钥匙窗口
- `createPicture(pictureId, imagePath, fitMode, title, width, height)` - 创建图片窗口

#### 内容窗口系统（模糊/镜头）
- `createContentWindow(id, options)` - 创建内容窗口（支持模糊效果）
- `createLensWindow(lensId, targetWindowId, options)` - 创建镜头窗口
- `destroyLensSystem(lensId)` - 销毁镜头系统
- `getLensSystems()` - 获取所有镜头系统
- `getLensSystem(lensId)` - 获取镜头系统信息

#### 窗口属性操作
- `updateWindowProperty(id, property, value)` - 更新窗口属性（title/size/position/resizable/visibility）
- `setWindowOpacity(id, opacity)` - 设置窗口透明度（0.0-1.0）
- `setWindowAlwaysOnTop(id, flag, level)` - 设置窗口置顶
- `updateContentBlur(id, blurAmount)` - 更新内容窗口模糊度（0-50）

#### 图片窗口操作
- `setPicture(windowId, imagePath, fitMode)` - 更改窗口显示的图片
- `setFitMode(windowId, fitMode)` - 更改窗口缩放模式（fill/contain/cover/scale-down/none）

#### 窗口信息查询
- `getWindowsInfo()` - 获取所有窗口详细信息
- `getWindowInfo(id)` - 获取单个窗口详细信息
- `getWindowTitle(id)` - 获取窗口标题
- `reloadWindowHtml(id, htmlPath)` - 重新加载窗口HTML

#### 位置管理
- `setWindowOffset(x, y)` - 设置窗口偏移量
- `getWindowOffset()` - 获取当前窗口偏移量
- `setKeyDoorMaxOverlap(ratio)` - 设置钥匙与门最大重叠比例（0.0-1.0）
- `getKeyDoorMaxOverlap()` - 获取钥匙与门最大重叠比例

#### 存储系统集成
- `getWindowSerializationData(windowId)` - 获取窗口序列化数据
- `createWindowFromData(windowData, options)` - 从数据创建窗口
- `updateWindowFromData(windowId, windowData)` - 从数据更新窗口

### 2. doorKeySystem.js
**门钥匙权限管理、多钥匙门、一次性钥匙、消息系统、目录访问控制**

#### 基础关系管理
- `establishRelation(doorId, keyId)` - 建立门钥匙双向关系
- `initializeDoorRelation(doorId)` - 初始化门的关系映射
- `initializeKeyRelation(keyId, relatedDoors)` - 初始化钥匙的关系映射
- `addEncryptedItem(itemId)` - 添加加密物品

#### 权限检查与开门
- `canOpenDoor(doorId, keyId)` - 检查开门权限
- `handleDoorToggle(doorId, keyId)` - 处理门的开关切换
- `handleFailedOpen(doorId, keyId)` - 处理开门失败（含弹开动画）
- `getDoorState(doorId)` - 获取门状态
- `getRelationsDebugInfo()` - 获取所有关系映射（调试用）

#### 一次性钥匙系统
- `setKeyOneTimeUse(keyId, isOneTime, shouldCloseAfterUse)` - 设置钥匙为一次性使用
- `isKeyUsable(keyId)` - 检查钥匙是否可用
- `resetKeyUsage(keyId)` - 重置钥匙使用状态
- `setKeyCloseAfterUse(keyId, shouldClose)` - 设置钥匙使用后是否关闭

#### 多钥匙门系统
- `setMultiKeyDoor(doorId, requiredKeySequence, timeoutMs)` - 设置多钥匙门配置
- `getMultiKeyProgress(doorId)` - 获取多钥匙门的进度
- `resetMultiKeyProgress(doorId)` - 重置多钥匙门的进度

#### 消息配置系统
- `setGlobalMessage(messageType, template)` - 设置全局消息模板
- `setDoorMessage(doorId, messageType, template)` - 设置门特定消息模板
- `setKeyMessage(keyId, messageType, template)` - 设置钥匙特定消息模板
- `clearMessages(scope, id, messageType)` - 清除消息模板

**支持的消息类型**:
  - `door_opened` - 门打开消息
  - `door_closed` - 门关闭消息
  - `access_denied` - 访问拒绝消息
  - `key_used` - 钥匙使用消息
  - `key_closing` - 钥匙关闭消息
  - `progress_update` - 多钥匙进度更新
  - `sequence_complete` - 多钥匙序列完成
  - `sequence_reset` - 多钥匙序列重置
  - `timeout` - 超时消息

**消息模板变量**: `{doorId}`, `{keyId}`, `{progress}`, `{total}`, `{nextKey}`, `{reason}`

#### 目录访问控制系统
- `setDirectoryAccess(dirPath, doorId, requiredKeys)` - 设置目录访问权限
- `checkDirectoryAccess(dirPath)` - 检查目录访问权限
- `filterAccessibleDirectories(directories)` - 过滤可访问的目录
- `removeDirectoryAccess(dirPath)` - 移除目录访问控制
- `getDirectoryAccessDebugInfo()` - 获取目录访问控制信息（调试用）

### 3. lensSystem.js
**镜头系统、内容同步、位置追踪**

- `registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow)` - 注册镜头系统
- `unregisterLensSystem(lensId)` - 注销镜头系统
- `getLensSystemInfo(lensId)` - 获取镜头系统信息
- `getAllLensSystems()` - 获取所有镜头系统
- `getLensSystemCount()` - 获取镜头系统数量
- `lensSystemExists(lensId)` - 检查镜头系统是否存在

### 4. windowStorage.js
**窗口状态序列化、文件存储、配置恢复**

- `saveWindowToFile(windowId, filename, options)` - 保存窗口配置到文件
- `loadWindowFromFile(filepath)` - 从文件加载窗口配置
- `deserializeWindow(windowData, options)` - 反序列化并重建窗口
- `listStoredWindows(directory)` - 列出已保存的窗口文件
- `deleteStoredWindow(filename)` - 删除保存的窗口文件

### 5. gameLogic.js
**游戏状态管理、关卡逻辑**

- `initializeGameLogic()` - 初始化游戏逻辑
- `handleVideoWindowClosed()` - 视频窗口关闭处理
- `createDemoDoorsAndKeys()` - 创建演示内容
- `getGameState()` - 获取游戏状态

### 6. workerManager.js
**Worker 线程管理、重叠检测循环**

- `initializeWorker()` - 初始化 Worker
- `startOverlapLoop()` / `stopOverlapLoop()` - 控制检测循环
- `cleanupWorker()` - 清理 Worker 资源

### 7. ipcHandlers.js
**IPC 通信处理、终端命令执行**

- `initializeIpcHandlers()` - 初始化 IPC 处理程序
- `cleanupIpcHandlers()` - 清理 IPC 处理程序

### 8. config.js
**配置管理模块**

- 提供全局配置常量和默认值

### 9. loggerConfig.js
**日志配置模块**

- 日志级别配置和管理
- 详见 `LOGGING_GUIDE.md`

### 10. utils/ 工具模块

#### errorHandler.js
- `ValidationError` - 验证错误类
- `SystemError` - 系统错误类
- `FileCompletionError` - 文件完成错误类
- `ERROR_CODES` - 错误代码常量
- `logError(error)` - 错误日志记录
- 详见 `utils/ERROR_HANDLING_GUIDE.md`

#### pathSecurityValidator.js
- 路径安全验证功能
- 防止路径遍历攻击

#### directoryNavigator.js
- 目录导航和文件系统操作工具

## 使用方式

### 在主文件中导入
```javascript
// 导入单个模块
import { createWindow } from './src/core/windowManager.js';

// 导入多个模块
import { createWindow, createDoor } from './src/core/windowManager.js';
import { canOpenDoor, setMultiKeyDoor } from './src/core/doorKeySystem.js';

// 导入存储功能
import { saveWindowToFile, loadWindowFromFile } from './src/core/windowStorage.js';

// 导入镜头系统
import { registerLensSystem, getLensSystemInfo } from './src/core/lensSystem.js';

// 统一导入（推荐）
import { 
  createWindow, 
  canOpenDoor, 
  saveWindowToFile,
  registerLensSystem 
} from './src/core/index.js';
```

### 模块间依赖
- `windowManager.js` - 核心模块，提供基础窗口管理
- `lensSystem.js` - 依赖 `windowManager.js`
- `doorKeySystem.js` - 依赖 `windowManager.js`, `utils/errorHandler.js`
- `windowStorage.js` - 依赖 `windowManager.js`, `lensSystem.js`
- `gameLogic.js` - 依赖 `windowManager.js`, `doorKeySystem.js`
- `workerManager.js` - 依赖所有其他模块
- `ipcHandlers.js` - 依赖 `windowManager.js`, `windowStorage.js`
- `config.js` - 独立配置模块
- `loggerConfig.js` - 独立日志配置模块
- `utils/` - 独立工具模块集合

## 核心特性

### 窗口管理
- **多类型窗口**: 支持桌面、视频、终端、门、钥匙、图片、内容、镜头等多种窗口类型
- **智能定位**: 自动窗口偏移、重叠检测、最优位置计算
- **动态属性**: 运行时修改窗口标题、大小、位置、透明度、置顶等属性
- **图片显示**: 支持多种缩放模式（fill/contain/cover/scale-down/none）

### 内容窗口与镜头系统
- **模糊效果**: 内容窗口支持可调节的模糊效果（0-50级）
- **镜头揭示**: 镜头窗口可以显示模糊内容的清晰版本
- **内容解析**: 支持文本/图片双内容模式（表面内容|||隐藏内容）
- **文件读取**: 支持从.txt文件读取内容
- **图片清晰化**: 镜头可以显示相同图片的清晰版本
- **数量限制**: 最多3个镜头系统同时存在

### 门钥匙系统
- **权限管理**: 加密门需要授权钥匙才能打开
- **一次性钥匙**: 支持使用后失效的钥匙，可选自动关闭窗口
- **多钥匙门**: 需要按顺序使用多个钥匙才能打开的门
- **超时机制**: 多钥匙门支持超时自动重置
- **自定义消息**: 支持全局、门特定、钥匙特定的消息模板
- **动画效果**: 开门失败时钥匙弹开动画
- **目录访问控制**: 将门钥匙系统扩展到文件系统目录访问

### 状态持久化
- **窗口保存**: 将窗口配置序列化为.fenestra文件
- **配置恢复**: 从文件重建窗口及其所有属性
- **镜头系统保存**: 支持保存和恢复镜头系统配置
- **跨平台**: 使用相对路径确保配置可移植

### 错误处理
- **标准化错误**: 使用自定义错误类（ValidationError, SystemError, FileCompletionError）
- **错误代码**: 统一的错误代码系统
- **详细上下文**: 错误包含丰富的调试信息
- **错误日志**: 集成日志系统记录所有错误

## 优势

1. **模块化**: 每个文件职责单一，易于维护
2. **可复用**: 模块可以独立使用和测试
3. **清晰依赖**: 模块间依赖关系明确
4. **易于扩展**: 新功能可以轻松添加到对应模块
5. **代码分离**: 主文件 `main.js` 变得简洁易读
6. **状态持久化**: 窗口配置可以保存和恢复
7. **跨平台兼容**: 相对路径处理确保配置可移植
8. **安全性**: 路径验证、权限管理、错误处理确保系统安全
9. **灵活性**: 丰富的配置选项和自定义能力
10. **可观测性**: 完善的日志系统和调试工具

## 注意事项

### 代码规范
- 所有模块都使用 ES6 模块语法
- 模块间通过导入/导出来共享功能
- 全局状态（如窗口映射）在 `windowManager.js` 中管理
- 每个模块都有完整的错误处理和日志记录

### 窗口存储
- 窗口存储使用 `.fenestra` 文件格式
- 存储目录默认为 `game-data/.fenestra-storage/`
- 支持拖拽 `.fenestra` 文件到终端进行恢复
- 配置文件使用相对路径确保跨平台兼容

### 镜头系统限制
- 最多同时存在3个镜头系统
- 镜头窗口关闭时自动注销镜头系统
- 目标窗口关闭时镜头窗口也会关闭

### 门钥匙系统
- 加密门需要授权钥匙才能打开
- 一次性钥匙使用后自动标记为已使用
- 多钥匙门必须按顺序使用钥匙
- 多钥匙门支持超时自动重置（默认30秒）

### 目录访问控制
- 目录路径会自动规范化以确保一致性
- 门打开后关联的目录自动解锁
- 支持多钥匙门的目录访问控制
- 过滤器会为锁定的目录添加详细的锁定信息

### 性能考虑
- 窗口位置计算包含重叠检测（最多50次尝试）
- 钥匙弹开动画使用缓动函数确保流畅
- Worker线程用于后台重叠检测
- 日志系统支持配置日志级别以控制输出量

## 使用示例

### 基础窗口操作
```javascript
import { createWindow, updateWindowProperty, setWindowOpacity } from './src/core/windowManager.js';

// 创建窗口
const window = createWindow('myWindow', {
  width: 800,
  height: 600,
  title: 'My Window',
  x: 100,
  y: 100
});

// 更新窗口属性
updateWindowProperty('myWindow', 'title', 'New Title');
updateWindowProperty('myWindow', 'size', [1024, 768]);
updateWindowProperty('myWindow', 'position', [200, 200]);

// 设置透明度
setWindowOpacity('myWindow', 0.8);
```

### 内容窗口与镜头系统
```javascript
import { createContentWindow, createLensWindow } from './src/core/windowManager.js';

// 创建模糊内容窗口
createContentWindow('content1', {
  contentType: 'text',
  contentPath: 'Surface text|||Hidden text revealed by lens',
  blurAmount: 20,
  blurred: true,
  width: 800,
  height: 600
});

// 创建镜头窗口来揭示内容
createLensWindow('lens1', 'content1', {
  width: 300,
  height: 200
});

// 创建图片内容窗口（清晰化模式）
createContentWindow('imageContent', {
  contentType: 'image',
  contentPath: 'doors/Door.png',
  blurAmount: 15,
  width: 400,
  height: 600
});
```

### 门钥匙系统
```javascript
import { 
  createDoor, 
  createKey, 
  establishRelation, 
  addEncryptedItem,
  setKeyOneTimeUse,
  setMultiKeyDoor,
  setDoorMessage
} from './src/core/index.js';

// 创建加密门和钥匙
createDoor('door1', 'Secret Door', true);
createKey('key1', 'Master Key', true, ['door1']);

// 建立关系
addEncryptedItem('door1');
addEncryptedItem('key1');
establishRelation('door1', 'key1');

// 设置一次性钥匙（使用后关闭）
setKeyOneTimeUse('key1', true, true);

// 创建多钥匙门（需要3个钥匙按顺序使用）
setMultiKeyDoor('door2', ['key1', 'key2', 'key3'], 30000);

// 自定义开门消息
setDoorMessage('door1', 'door_opened', 'Welcome! Door {doorId} opened with {keyId}');
```

### 目录访问控制
```javascript
import { 
  setDirectoryAccess, 
  checkDirectoryAccess,
  filterAccessibleDirectories 
} from './src/core/doorKeySystem.js';

// 设置目录访问权限
setDirectoryAccess('/secret/folder', 'door1', ['key1']);

// 检查访问权限
const access = checkDirectoryAccess('/secret/folder');
if (access.hasAccess) {
  console.log('Access granted');
} else {
  console.log(`Access denied: ${access.lockReason}`);
  console.log(`Required key: ${access.requiredKey}`);
}

// 过滤目录列表
const allDirs = ['/public', '/secret/folder', '/private'];
const accessibleDirs = filterAccessibleDirectories(allDirs);
```

### 窗口存储系统
```javascript
import { 
  saveWindowToFile, 
  loadWindowFromFile, 
  deserializeWindow,
  listStoredWindows 
} from './src/core/windowStorage.js';

// 保存窗口配置
const result = saveWindowToFile('window1', 'my-config.fenestra');
if (result.success) {
  console.log(`Saved to: ${result.filepath}`);
}

// 列出已保存的配置
const files = listStoredWindows();
console.log('Saved configurations:', files);

// 加载并恢复窗口
const loadResult = loadWindowFromFile('my-config.fenestra');
if (loadResult.success) {
  const restoreResult = deserializeWindow(loadResult.data);
  console.log(`Window restored: ${restoreResult.windowId}`);
}
```

### 图片窗口操作
```javascript
import { createPicture, setPicture, setFitMode } from './src/core/windowManager.js';

// 创建图片窗口
createPicture('pic1', 'doors/Door.png', 'contain', 'My Picture', 400, 300);

// 更改显示的图片
setPicture('pic1', 'doors/Keychain.jpeg', 'cover');

// 更改缩放模式
setFitMode('pic1', 'fill');
```

### 消息模板系统
```javascript
import { 
  setGlobalMessage, 
  setDoorMessage, 
  setKeyMessage 
} from './src/core/doorKeySystem.js';

// 设置全局消息
setGlobalMessage('access_denied', 'Sorry, {keyId} cannot open {doorId}. Reason: {reason}');

// 设置门特定消息
setDoorMessage('door1', 'door_opened', 'The ancient door {doorId} creaks open...');

// 设置钥匙特定消息
setKeyMessage('key1', 'key_used', 'The golden key {keyId} has fulfilled its purpose.');

// 多钥匙门进度消息
setGlobalMessage('progress_update', 'Progress: {progress}/{total}. Next key needed: {nextKey}');
```

### 终端命令
通过终端窗口可以使用以下命令：
- `save-window [windowId] [filename]` - 保存窗口配置
- `restore-window [filepath]` - 恢复窗口配置
- `list-saved` - 列出已保存的配置文件
- `delete-saved [filename]` - 删除配置文件
- `help` - 显示所有可用命令



## API 参考

### 窗口管理 API

#### createWindow(id, opts)
创建通用窗口
- **参数**:
  - `id` (string): 窗口唯一标识符
  - `opts` (Object): 窗口配置选项
    - `width` (number): 窗口宽度，默认800
    - `height` (number): 窗口高度，默认500
    - `x` (number): X坐标（可选，自动计算）
    - `y` (number): Y坐标（可选，自动计算）
    - `title` (string): 窗口标题
    - `resizable` (boolean): 是否可调整大小，默认true
    - `transparent` (boolean): 是否透明，默认false
    - `otherContents` (string|Object): HTML内容或查询参数
    - `htmlName` (string): HTML文件名
- **返回**: BrowserWindow 实例

#### createContentWindow(id, options)
创建内容窗口（支持模糊效果）
- **参数**:
  - `id` (string): 窗口ID
  - `options` (Object):
    - `contentType` (string): 'text' 或 'image'
    - `contentPath` (string): 内容路径（支持 "表面|||隐藏" 格式）
    - `blurAmount` (number): 模糊程度 0-50，默认10
    - `blurred` (boolean): 是否初始模糊，默认true
    - `width` (number): 窗口宽度，默认800
    - `height` (number): 窗口高度，默认600
    - `x`, `y` (number): 位置（可选）
    - `title` (string): 窗口标题
- **返回**: { success: boolean, message: string, id: string }

#### createLensWindow(lensId, targetWindowId, options)
创建镜头窗口
- **参数**:
  - `lensId` (string): 镜头窗口ID
  - `targetWindowId` (string): 目标内容窗口ID
  - `options` (Object):
    - `contentType` (string): 内容类型
    - `contentPath` (string): 内容路径
    - `width` (number): 镜头宽度，默认300
    - `height` (number): 镜头高度，默认200
    - `x`, `y` (number): 位置（可选，默认目标窗口中心）
- **返回**: { success: boolean, message: string, id: string }
- **限制**: 最多3个镜头系统

#### setWindowOpacity(id, opacity)
设置窗口透明度
- **参数**:
  - `id` (string): 窗口ID
  - `opacity` (number): 透明度 0.0-1.0
- **返回**: { success: boolean, message: string }

#### setWindowAlwaysOnTop(id, flag, level)
设置窗口置顶
- **参数**:
  - `id` (string): 窗口ID
  - `flag` (boolean): 是否置顶
  - `level` (string): 置顶级别，默认'normal'
    - 可选值: 'normal', 'floating', 'torn-off-menu', 'modal-panel', 'main-menu', 'status', 'pop-up-menu', 'screen-saver'
- **返回**: { success: boolean, message: string }

#### updateContentBlur(id, blurAmount)
更新内容窗口模糊度
- **参数**:
  - `id` (string): 窗口ID
  - `blurAmount` (number): 模糊程度 0-50
- **返回**: { success: boolean, message: string }

### 门钥匙系统 API

#### establishRelation(doorId, keyId)
建立门钥匙双向关系
- **参数**:
  - `doorId` (string): 门ID
  - `keyId` (string): 钥匙ID

#### canOpenDoor(doorId, keyId)
检查开门权限
- **参数**:
  - `doorId` (string): 门ID
  - `keyId` (string): 钥匙ID
- **返回**: boolean - 是否有权限开门

#### setKeyOneTimeUse(keyId, isOneTime, shouldCloseAfterUse)
设置钥匙为一次性使用
- **参数**:
  - `keyId` (string): 钥匙ID
  - `isOneTime` (boolean): 是否为一次性使用，默认true
  - `shouldCloseAfterUse` (boolean): 使用后是否关闭窗口，默认false

#### setMultiKeyDoor(doorId, requiredKeySequence, timeoutMs)
设置多钥匙门配置
- **参数**:
  - `doorId` (string): 门ID
  - `requiredKeySequence` (Array<string>): 需要的钥匙序列
  - `timeoutMs` (number): 超时时间（毫秒），默认30000
- **示例**: `setMultiKeyDoor('door1', ['key1', 'key2', 'key3'], 30000)`

#### getMultiKeyProgress(doorId)
获取多钥匙门的进度
- **参数**:
  - `doorId` (string): 门ID
- **返回**: Object
  - `doorId` (string): 门ID
  - `requiredKeys` (Array): 需要的钥匙列表
  - `usedKeys` (Array): 已使用的钥匙列表
  - `progress` (number): 当前进度
  - `total` (number): 总钥匙数
  - `nextKey` (string): 下一个需要的钥匙
  - `isComplete` (boolean): 是否完成
  - `hasTimeout` (boolean): 是否有超时计时器

#### setGlobalMessage(messageType, template)
设置全局消息模板
- **参数**:
  - `messageType` (string): 消息类型
  - `template` (string): 消息模板（支持变量占位符）
- **消息类型**:
  - `door_opened`, `door_closed`, `access_denied`
  - `key_used`, `key_closing`
  - `progress_update`, `sequence_complete`, `sequence_reset`, `timeout`
- **模板变量**: `{doorId}`, `{keyId}`, `{progress}`, `{total}`, `{nextKey}`, `{reason}`
- **示例**: `setGlobalMessage('door_opened', 'Door {doorId} opened with {keyId}!')`

#### setDirectoryAccess(dirPath, doorId, requiredKeys)
设置目录访问权限
- **参数**:
  - `dirPath` (string): 目录路径
  - `doorId` (string): 关联的门ID
  - `requiredKeys` (Array<string>): 需要的钥匙ID数组，默认[]

#### checkDirectoryAccess(dirPath)
检查目录访问权限
- **参数**:
  - `dirPath` (string): 目录路径
- **返回**: Object
  - `hasAccess` (boolean): 是否有访问权限
  - `isLocked` (boolean): 是否锁定
  - `requiredKey` (string): 需要的钥匙
  - `lockReason` (string): 锁定原因
  - `errorCode` (string): 错误代码
  - `doorType` (string): 门类型（'single-key', 'multi-key', 'no-key'）
  - `progress` (string): 多钥匙门进度（如适用）

#### filterAccessibleDirectories(directories)
过滤可访问的目录
- **参数**:
  - `directories` (Array): 目录条目数组（字符串或对象）
- **返回**: Array - 过滤后的可访问目录数组
- **注意**: 锁定的目录对象会被添加 `isLocked`, `lockReason`, `requiredKey` 等属性

### 窗口存储 API

#### saveWindowToFile(windowId, filename, options)
保存窗口配置到文件
- **参数**:
  - `windowId` (string): 窗口ID
  - `filename` (string): 文件名（.fenestra扩展名）
  - `options` (Object): 保存选项
- **返回**: { success: boolean, message: string, filepath: string }

#### loadWindowFromFile(filepath)
从文件加载窗口配置
- **参数**:
  - `filepath` (string): 文件路径
- **返回**: { success: boolean, message: string, data: Object }

#### deserializeWindow(windowData, options)
反序列化并重建窗口
- **参数**:
  - `windowData` (Object): 窗口数据
  - `options` (Object): 恢复选项
- **返回**: { success: boolean, message: string, windowId: string }

#### listStoredWindows(directory)
列出已保存的窗口文件
- **参数**:
  - `directory` (string): 目录路径（可选）
- **返回**: Array<string> - 文件名列表

### 镜头系统 API

#### registerLensSystem(lensId, lensWindow, targetWindowId, targetWindow)
注册镜头系统
- **参数**:
  - `lensId` (string): 镜头ID
  - `lensWindow` (BrowserWindow): 镜头窗口
  - `targetWindowId` (string): 目标窗口ID
  - `targetWindow` (BrowserWindow): 目标窗口

#### getLensSystemInfo(lensId)
获取镜头系统信息
- **参数**:
  - `lensId` (string): 镜头ID
- **返回**: Object | null
  - `lensId` (string): 镜头ID
  - `targetWindowId` (string): 目标窗口ID
  - `lensWindow` (BrowserWindow): 镜头窗口
  - `targetWindow` (BrowserWindow): 目标窗口

#### getLensSystemCount()
获取镜头系统数量
- **返回**: number - 当前镜头系统数量

## 错误代码

### ERROR_CODES (from errorHandler.js)
- `MALFORMED_PATH` - 路径格式错误
- `DIRECTORY_LOCKED` - 目录被锁定
- `MISSING_KEY` - 缺少钥匙
- `KEY_VALIDATION_FAILED` - 钥匙验证失败
- `INTERNAL_ERROR` - 内部错误

## 最佳实践

### 1. 窗口创建
- 使用描述性的窗口ID
- 为特殊窗口类型使用专用创建函数（createDoor, createKey等）
- 利用自动位置计算避免窗口重叠

### 2. 门钥匙系统
- 始终在创建门和钥匙后建立关系
- 对加密门和钥匙调用 `addEncryptedItem()`
- 使用自定义消息提供更好的用户体验
- 为多钥匙门设置合理的超时时间

### 3. 内容窗口与镜头
- 使用 "表面|||隐藏" 格式提供双内容
- 模糊程度建议在10-30之间以保持可读性
- 镜头窗口大小应小于目标窗口
- 注意3个镜头的数量限制

### 4. 目录访问控制
- 在设置目录访问前确保门已创建
- 使用 `filterAccessibleDirectories()` 自动过滤目录列表
- 检查返回的 `errorCode` 以提供详细的错误信息

### 5. 错误处理
- 始终检查函数返回的 `success` 字段
- 使用 `try-catch` 包裹可能失败的操作
- 记录错误信息以便调试

### 6. 性能优化
- 避免创建过多窗口（建议<20个）
- 及时销毁不需要的镜头系统
- 使用窗口存储系统保存状态而不是保持窗口打开

## 相关文档

- **LOGGING_GUIDE.md** - 日志系统使用指南
- **utils/ERROR_HANDLING_GUIDE.md** - 错误处理指南
- **CONFIGURATION_GUIDE.md** - 配置指南（项目根目录）
- **LENS_SYSTEM_GUIDE.md** - 镜头系统详细指南（项目根目录）
- **WINDOW_STORAGE_GUIDE.md** - 窗口存储系统指南（项目根目录）
- **LEVEL_CREATION_GUIDE.md** - 关卡创建指南（项目根目录）
