# 窗口存储系统使用指南

## 📖 概述

窗口存储系统允许您保存和恢复完整的窗口配置，包括窗口属性、内容设置和特殊功能。支持所有窗口类型的完整状态保存，实现跨会话的配置持久化。

## 🎯 核心功能

### 1. 完整状态保存
- 窗口位置、大小、透明度等基础属性
- 内容配置（图片路径、文本内容、模糊设置）
- 特殊属性（镜头关系、门钥匙配置）
- 元数据（创建时间、版本信息、描述）

### 2. 智能恢复系统
- 自动检测窗口类型并使用对应的创建函数
- 处理窗口ID冲突（可选择覆盖或创建新ID）
- 验证内容文件存在性，提供缺失文件警告
- 支持相对路径，确保配置可移植性

### 3. 拖拽操作支持
- 直接拖拽 `.fenestra` 文件到终端进行恢复
- 自动填充恢复命令
- 实时验证文件格式

## 🚀 快速开始

### 基础保存和恢复

```bash
# 1. 打开终端（Ctrl+~ 或 Cmd+~）

# 2. 创建一个窗口
create-content demo text "" 15 true

# 3. 保存窗口配置
save-window demo my-demo.fenestra

# 4. 恢复窗口配置
restore-window my-demo.fenestra
```

### 拖拽恢复

1. 在文件管理器中找到 `.fenestra` 文件
2. 拖拽文件到终端窗口
3. 自动填充 `restore-window` 命令
4. 按回车执行恢复

## 📋 命令参考

### 保存窗口

```bash
save-window [窗口ID] [文件名]
```

**参数说明：**
- `窗口ID`: 要保存的窗口标识符
- `文件名`: 保存的文件名（可选，自动生成时间戳文件名）

**示例：**
```bash
# 保存到自动生成的文件名
save-window content1

# 保存到指定文件名
save-window content1 my-puzzle.fenestra

# 保存到子目录
save-window lens1 puzzles/lens-config.fenestra
```

### 恢复窗口

```bash
restore-window [文件路径]
```

**参数说明：**
- `文件路径`: `.fenestra` 文件的路径（相对或绝对路径）

**示例：**
```bash
# 从存储目录恢复
restore-window my-puzzle.fenestra

# 从子目录恢复
restore-window puzzles/lens-config.fenestra

# 使用绝对路径
restore-window /path/to/config.fenestra
```

### 管理存储文件

```bash
# 列出所有已保存的配置
list-saved

# 删除指定配置文件
delete-saved my-puzzle.fenestra

# 查看存储目录信息
# （存储目录：.fenestra-storage/）
```

## 💡 高级用法

### 1. 批量保存

```bash
# 保存多个相关窗口
save-window door1 puzzle-set-doors.fenestra
save-window key1 puzzle-set-keys.fenestra
save-window lens1 puzzle-set-lens.fenestra
```

### 2. 配置模板

```bash
# 创建标准配置模板
create-content template text "" 10 true
save-window template templates/standard-content.fenestra

# 使用模板创建新窗口
restore-window templates/standard-content.fenestra
```

### 3. 场景保存

```bash
# 保存完整的游戏场景
save-window door1 scenes/level1-door.fenestra
save-window key1 scenes/level1-key.fenestra
save-window content1 scenes/level1-content.fenestra
```

### 4. 跨平台配置

```bash
# 使用相对路径确保跨平台兼容
create-picture demo doors/Door.png fill
save-window demo portable-config.fenestra

# 在其他系统上恢复（只要 doors/ 目录存在）
restore-window portable-config.fenestra
```

## 🗂️ 文件格式

### .fenestra 文件结构

```json
{
  "version": "1.0",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metadata": {
    "originalId": "content1",
    "windowType": "content",
    "description": "Content window with blur effect"
  },
  "windowConfig": {
    "id": "content1",
    "title": "Content Window",
    "bounds": { "x": 100, "y": 100, "width": 400, "height": 300 },
    "properties": {
      "resizable": true,
      "transparent": false,
      "alwaysOnTop": false,
      "opacity": 1.0,
      "visible": true
    }
  },
  "contentConfig": {
    "htmlName": "contentViewer.html",
    "type": "text",
    "path": "",
    "blurAmount": 15,
    "blurred": true,
    "otherContents": {}
  },
  "specialConfig": {}
}
```

### 支持的窗口类型

| 类型 | 描述 | 特殊配置 |
|------|------|----------|
| `picture` | 图片窗口 | 图片路径、适配模式 |
| `content` | 内容窗口 | 内容类型、模糊设置 |
| `lens` | 镜头窗口 | 目标窗口ID、追踪状态 |
| `door` | 门窗口 | 加密状态、关联钥匙 |
| `key` | 钥匙窗口 | 关联门、权限设置 |
| `terminal` | 终端窗口 | 命令历史、主题设置 |
| `generic` | 通用窗口 | 基础属性 |

## 📁 存储目录结构

```
.fenestra-storage/
├── content-window1-2024-01-01T12-00-00.fenestra
├── lens-viewer1-2024-01-01T12-05-30.fenestra
├── my-puzzle.fenestra
├── templates/
│   ├── standard-content.fenestra
│   └── default-lens.fenestra
└── scenes/
    ├── level1-door.fenestra
    ├── level1-key.fenestra
    └── level1-content.fenestra
```

## ⚠️ 注意事项

### 1. 文件路径处理
- 系统自动将绝对路径转换为相对路径以提高可移植性
- 恢复时优先在当前目录查找相对路径文件
- 缺失的内容文件会显示警告但不阻止窗口创建

### 2. 窗口ID冲突
- 默认情况下，如果目标ID已存在，恢复会失败
- 可以通过编程方式使用 `forceNewId` 选项创建新ID
- 建议在恢复前检查现有窗口列表

### 3. 版本兼容性
- 当前版本：1.0
- 未来版本会保持向后兼容
- 版本不匹配时会显示警告

### 4. 特殊窗口类型
- **镜头窗口**：需要目标窗口存在才能正常工作
- **门钥匙窗口**：关系映射需要手动重建
- **内容窗口**：缺失的图片文件会显示占位符

## 🐛 故障排除

### 问题：保存失败

```bash
# 检查窗口是否存在
list

# 检查存储目录权限
# 确保 .fenestra-storage/ 目录可写

# 检查磁盘空间
# 确保有足够空间保存文件
```

### 问题：恢复失败

```bash
# 检查文件是否存在
list-saved

# 验证文件格式
# 确保文件是有效的 JSON 格式

# 检查内容文件
# 确保引用的图片等文件存在
```

### 问题：拖拽不工作

1. 确保拖拽的是 `.fenestra` 文件
2. 确保终端窗口处于活动状态
3. 检查文件权限是否可读

### 问题：镜头窗口恢复后不工作

```bash
# 先恢复目标窗口
restore-window target-content.fenestra

# 再恢复镜头窗口
restore-window lens-config.fenestra
```

## 📊 完整工作流程示例

### 场景：创建和保存复杂拼图

```bash
# === 步骤1：创建拼图元素 ===

# 创建模糊的秘密内容
create-content secret text "" 25 true

# 创建镜头查看器
create-lens viewer secret 300 200

# 创建门和钥匙
create-door door1 doors/Door.png fill "Secret Door" 200 300
create-key key1 doors/Squirrel.jpg fill "Master Key" 150 200

# === 步骤2：保存配置 ===

save-window secret puzzle/secret-content.fenestra
save-window viewer puzzle/lens-viewer.fenestra
save-window door1 puzzle/secret-door.fenestra
save-window key1 puzzle/master-key.fenestra

# === 步骤3：清理并测试恢复 ===

# 关闭所有窗口
close secret
close viewer
close door1
close key1

# 恢复拼图
restore-window puzzle/secret-content.fenestra
restore-window puzzle/lens-viewer.fenestra
restore-window puzzle/secret-door.fenestra
restore-window puzzle/master-key.fenestra

# === 步骤4：验证功能 ===

# 检查所有窗口已恢复
list

# 测试镜头功能
# 拖动 viewer 窗口到 secret 窗口上方

# 测试门钥匙功能
# 拖动 key1 到 door1 上方
```

## 🎨 创意应用

### 1. 教学场景保存
```bash
# 保存教学演示的各个步骤
save-window step1 lessons/intro-step1.fenestra
save-window step2 lessons/intro-step2.fenestra
save-window step3 lessons/intro-step3.fenestra
```

### 2. 游戏关卡设计
```bash
# 保存游戏关卡配置
save-window level1-puzzle levels/level1.fenestra
save-window level2-puzzle levels/level2.fenestra
```

### 3. 艺术作品展示
```bash
# 保存艺术展示配置
save-window artwork1 gallery/piece1.fenestra
save-window artwork2 gallery/piece2.fenestra
```

### 4. 开发测试场景
```bash
# 保存测试用例配置
save-window test-case1 tests/blur-test.fenestra
save-window test-case2 tests/lens-test.fenestra
```

## 📚 API 参考

### JavaScript API

```javascript
// 导入存储模块
import { 
  saveWindowToFile, 
  loadWindowFromFile, 
  deserializeWindow,
  listStoredWindows,
  deleteStoredWindow 
} from './src/core/windowStorage.js';

// 保存窗口
const saveResult = saveWindowToFile('windowId', 'config.fenestra');
if (saveResult.success) {
  console.log('保存成功:', saveResult.filePath);
}

// 加载窗口
const loadResult = loadWindowFromFile('config.fenestra');
if (loadResult.success) {
  const restoreResult = deserializeWindow(loadResult.data);
  if (restoreResult.success) {
    console.log('恢复成功:', restoreResult.windowId);
  }
}

// 列出存储文件
const listResult = listStoredWindows();
console.log('存储文件:', listResult.files);

// 删除存储文件
const deleteResult = deleteStoredWindow('config.fenestra');
console.log('删除结果:', deleteResult.message);
```

---

**祝您使用愉快！🎉**

如有问题或建议，请查看项目 README.md 或提交 Issue。