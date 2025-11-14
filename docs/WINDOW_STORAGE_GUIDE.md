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

---

**祝您使用愉快！🎉**

如有问题或建议，请查看项目 README.md 或提交 Issue。
