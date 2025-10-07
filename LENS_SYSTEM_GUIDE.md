# 镜头窗口系统使用指南

## 📖 概述

镜头窗口系统允许您创建半透明的"镜头"窗口，用于显示底层模糊内容的清晰版本。这是一个视觉解密系统，类似于刮刮乐或放大镜效果。

## 🎯 核心概念

### 1. 内容窗口（底层窗口）
- 显示模糊处理的文字或图片
- 可调节模糊程度（0-50）
- 作为"秘密信息"的载体

### 2. 镜头窗口（顶层窗口）
- 半透明边框，始终置顶
- 显示对应区域的清晰内容
- 可拖动到内容窗口上方
- 最多同时存在3个镜头窗口

## 🚀 快速开始

### 基础示例：文字解密

```bash
# 1. 打开终端窗口（快捷键：Ctrl+~ 或 Cmd+~）

# 2. 创建一个内容窗口，显示模糊的文字
create-content content1 text "" 15 true

# 3. 创建一个镜头窗口
create-lens lens1 content1 300 200

# 4. 拖动镜头窗口到内容窗口上方，查看清晰文字
```

### 图片解密示例

```bash
# 1. 创建显示模糊图片的内容窗口
create-content secret-image image doors/Squirrel.jpg 20 true

# 2. 创建镜头窗口查看清晰图片
create-lens magnifier secret-image 400 300

# 3. 拖动镜头窗口，像放大镜一样查看图片
```

## 📋 命令参考

### 创建内容窗口

```bash
create-content [窗口ID] [类型] [路径] [模糊度] [是否模糊]
```

**参数说明：**
- `窗口ID`: 唯一标识符（如：content1）
- `类型`: `text` 或 `image`
- `路径`: 图片路径（类型为image时）或留空（类型为text时）
- `模糊度`: 0-50之间的数字（默认10）
- `是否模糊`: `true` 或 `false`（默认true）

**示例：**
```bash
# 创建模糊文字窗口
create-content msg1 text "" 10 true

# 创建模糊图片窗口
create-content pic1 image doors/Door.png 15 true

# 创建清晰图片窗口（不模糊）
create-content clear1 image doors/Squirrel.jpg 0 false
```

### 创建镜头窗口

```bash
create-lens [镜头ID] [目标窗口ID] [宽度] [高度]
```

**参数说明：**
- `镜头ID`: 镜头窗口的唯一标识符（如：lens1）
- `目标窗口ID`: 要查看的内容窗口ID
- `宽度`: 镜头窗口宽度（像素，默认300）
- `高度`: 镜头窗口高度（像素，默认200）

**示例：**
```bash
# 创建标准大小镜头
create-lens lens1 content1

# 创建大型镜头
create-lens lens2 content1 500 400

# 创建小型镜头
create-lens lens3 content1 200 150
```

### 窗口透明度控制

```bash
set-opacity [窗口ID] [0-1]
```

**示例：**
```bash
# 设置窗口半透明
set-opacity lens1 0.5

# 设置窗口完全不透明
set-opacity content1 1.0

# 设置窗口接近透明
set-opacity lens2 0.2
```

### 窗口置顶控制

```bash
set-always-on-top [窗口ID] [true/false] [level]
```

**Level选项：**
- `normal`: 正常（默认）
- `floating`: 浮动
- `screen-saver`: 屏保级别

**示例：**
```bash
# 设置窗口置顶
set-always-on-top content1 true

# 设置浮动级别置顶
set-always-on-top lens1 true floating

# 取消置顶
set-always-on-top content1 false
```

### 更新模糊程度

```bash
update-blur [窗口ID] [0-50]
```

**示例：**
```bash
# 增加模糊
update-blur content1 25

# 减少模糊
update-blur content1 5

# 完全清晰
update-blur content1 0
```

### 管理镜头系统

```bash
# 列出所有镜头
list-lens

# 查看镜头详情
lens-info lens1

# 销毁镜头系统
destroy-lens lens1
```

## 💡 使用技巧

### 1. 多层解密

创建多个镜头窗口查看不同区域：

```bash
create-content secret text "" 20 true
create-lens lens1 secret 250 150
create-lens lens2 secret 250 150
create-lens lens3 secret 250 150
```

拖动三个镜头到不同位置，分别查看内容的不同部分。

### 2. 渐进式模糊

```bash
# 创建高度模糊的内容
create-content mystery text "" 30 true

# 创建镜头查看
create-lens viewer mystery

# 逐步降低模糊度，增加难度
update-blur mystery 25
update-blur mystery 20
update-blur mystery 15
```

### 3. 图片寻宝游戏

```bash
# 创建完全模糊的图片
create-content treasure image path/to/image.jpg 50 true

# 给玩家一个小镜头
create-lens finder treasure 150 150

# 玩家需要移动小镜头找到关键信息
```

### 4. 透明度组合

```bash
create-content base text "" 15 true
create-lens view1 base 300 200

# 调整镜头透明度产生不同效果
set-opacity view1 0.8  # 轻微透明
set-opacity view1 0.5  # 半透明
set-opacity view1 0.3  # 高度透明
```

## ⚠️ 限制与注意事项

1. **镜头数量限制**：最多同时存在3个镜头窗口
2. **性能考虑**：模糊程度越高，性能消耗越大（建议≤30）
3. **窗口层级**：镜头窗口自动设置为置顶状态
4. **坐标同步**：镜头窗口需要与目标窗口保持在屏幕可见范围内

## 🐛 故障排除

### 镜头窗口不显示内容

```bash
# 1. 检查目标窗口是否存在
list

# 2. 检查镜头系统状态
lens-info [镜头ID]

# 3. 重新创建镜头
destroy-lens [镜头ID]
create-lens [镜头ID] [目标ID] [宽] [高]
```

### 模糊效果不生效

```bash
# 1. 确认模糊参数正确
update-blur [窗口ID] 20

# 2. 重新加载窗口
reload-html [窗口ID] contentViewer.html
```

### 窗口位置异常

```bash
# 手动调整窗口位置
set-position [窗口ID] 100 100
```

## 📊 完整工作流程示例

```bash
# === 场景：秘密消息解密游戏 ===

# 步骤1：打开终端
# 使用快捷键 Ctrl+~ (Windows/Linux) 或 Cmd+~ (Mac)

# 步骤2：创建包含秘密消息的模糊内容窗口
create-content secret-msg text "" 25 true

# 步骤3：创建第一个镜头窗口
create-lens magnifier1 secret-msg 300 200

# 步骤4：（可选）创建更多镜头查看不同区域
create-lens magnifier2 secret-msg 250 180

# 步骤5：拖动镜头窗口到内容窗口上方

# 步骤6：调整模糊度增加或降低难度
update-blur secret-msg 30  # 更模糊
update-blur secret-msg 15  # 更清晰

# 步骤7：调整镜头透明度获得不同效果
set-opacity magnifier1 0.7

# 步骤8：完成后清理
destroy-lens magnifier1
destroy-lens magnifier2
hide secret-msg  # 或使用 close 命令
```

## 🎨 创意应用

1. **教育工具**：隐藏答案，学生用镜头查看
2. **游戏机制**：探索迷雾地图
3. **艺术展示**：渐进式揭示作品细节
4. **密码系统**：多层加密信息
5. **互动演示**：聚焦关键内容

## 📚 技术架构

### 文件结构

```
renderer/
  ├── contentViewer.html    - 内容窗口（显示模糊内容）
  └── lensViewer.html       - 镜头窗口（显示清晰内容）

src/core/
  ├── lensSystem.js         - 镜头系统核心逻辑
  ├── windowManager.js      - 窗口管理功能
  └── ipcHandlers.js        - IPC通信处理
```

### 工作原理

1. **内容窗口**应用CSS `filter: blur()` 实现模糊效果
2. **镜头窗口**作为无边框透明窗口，始终置顶
3. **位置追踪**：监听窗口 `move` 事件，实时同步坐标
4. **内容同步**：根据相对位置，在镜头中显示对应的清晰内容
5. **IPC通信**：主进程与渲染进程通过事件传递坐标和状态

## 🔧 高级配置

### 自定义镜头边框颜色

修改 `lensViewer.html` 中的 CSS：

```css
#lens-frame {
  border: 3px solid rgba(255, 0, 0, 0.8);  /* 红色边框 */
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
}
```

### 调整模糊效果类型

修改 `contentViewer.html` 中的滤镜：

```css
#content-container.blurred {
  filter: blur(10px) brightness(0.8);  /* 添加亮度调整 */
}
```

---

## 📝 API 参考

完整API文档请参考：
- `src/core/lensSystem.js` - 镜头系统函数
- `src/core/windowManager.js` - 窗口管理函数
- `src/core/ipcHandlers.js` - IPC处理函数

---

**祝您使用愉快！🎉**

如有问题或建议，请查看项目 README.md 或提交 Issue。


