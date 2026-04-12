# 移动端编辑器 UX 打磨

## 用户故事

作为用户，我希望在手机上编辑 Markdown 时有舒适的体验：有格式化快捷工具栏、键盘不遮挡编辑区域、暗色模式正常显示，接近 Joplin/Obsidian 的移动端编辑体验。

## 依赖

- Live Preview 装饰扩展（L1）

## 需求描述

集中处理移动端编辑器的用户体验细节，Joplin 在这些方面已有成熟的解决方案可供参考。

### 功能项

| 功能 | 优先级 | 描述 |
| --- | --- | --- |
| 格式化工具栏 | P0 | 键盘上方浮动的快捷操作栏（加粗、斜体、标题、代码、列表等） |
| 虚拟键盘适配 | P0 | 键盘弹出时编辑区域自动缩小，光标保持可见 |
| 暗色主题 | P0 | 编辑器 WebView 内 CSS 跟随 RN 侧主题切换 |
| iOS 选区适配 | P1 | 长按选区气泡正常工作 |
| 滚动保持 | P1 | 切换文档后恢复上次滚动位置，编辑时光标始终在可见区域 |
| 搜索面板 | P1 | 文档内搜索/替换（复用 CM6 searchExtension） |
| 粘贴处理 | P2 | 粘贴图片/文件时的处理逻辑（保存到本地 + 插入 Markdown 链接） |

## 交互设计

### 格式化工具栏

```text
┌──────────────────────────────────────────┐
│  编辑区域（WebView）                       │
│                                          │
│  # 这是标题                               │
│  这是正文，**粗体**和*斜体*                 │
│                                          │
├──────────────────────────────────────────┤
│ [B] [I] [H] [<>] [-] [☐] [🔗] [📷] [↩]  │  ← 格式化工具栏（原生 RN 组件）
├──────────────────────────────────────────┤
│           虚拟键盘                         │
└──────────────────────────────────────────┘
```

- 工具栏是**原生 RN 组件**（不在 WebView 内），悬浮在键盘上方
- 按钮调用 `editorApi.execCommand('toggleBold')` 等 Comlink RPC
- 键盘收起时工具栏隐藏

### 暗色主题

- RN 侧检测当前主题 → 通过 Comlink 通知 WebView
- WebView 内切换 CSS class（`body.dark`）
- 编辑器 CSS 变量跟随切换

## 技术方案

### 格式化工具栏

- 使用 RN 的 `KeyboardAvoidingView` 或 `InputAccessoryView`（iOS）
- 按钮触发 Comlink RPC：`editorApi.execCommand(commandName)`
- 已有命令：`toggleBold`、`toggleItalic`、`toggleCode`、`toggleHeading`（在 `@swarmnote/editor` 中实现）

### 虚拟键盘适配

- `<WebView>` 外层包裹 `KeyboardAvoidingView`
- 设置 `keyboardDisplayRequiresUserAction={false}` 允许 JS 触发键盘
- 键盘弹出时通过 `Keyboard` API 获取高度，动态调整编辑区域

### 暗色主题

- 新增 Comlink API：`editorApi.setTheme('dark' | 'light')`
- WebView 内通过 `document.body.classList.toggle('dark')` 切换
- CSS 变量体系与 RN 侧 `global.css` 保持一致

### 搜索面板

- 复用 CM6 `@codemirror/search` 扩展
- 可能需要自定义搜索 UI（CM6 默认搜索面板在移动端不友好）
- 或者在 RN 侧实现搜索 UI，通过 Comlink 调用 CM6 搜索 API

## 验收标准

- [ ] 格式化工具栏在键盘上方正确显示，按钮功能正常
- [ ] 键盘弹出/收起时编辑区域平滑调整，光标不被遮挡
- [ ] 暗色模式下编辑器配色正确（背景、文字、语法高亮等）
- [ ] iOS 长按选区能正常选中文本
- [ ] 切换文档后上次滚动位置可恢复
- [ ] 文档内搜索可用
- [ ] Android 和 iOS 上体验一致

## 任务拆分建议

1. 实现格式化工具栏组件（RN 原生）+ Comlink 命令调用
2. 虚拟键盘适配（KeyboardAvoidingView + 高度计算）
3. 暗色主题 CSS 变量 + 切换机制
4. iOS 选区行为调试
5. 滚动位置保持/恢复
6. 搜索面板（CM6 searchExtension 或自定义 UI）
7. 粘贴文件/图片处理

## 开放问题

- `InputAccessoryView` 仅 iOS 支持，Android 需要用其他方案（自定义 View？）
- 搜索面板是用 CM6 内置 UI 还是 RN 侧自定义 UI？
- 粘贴图片的存储位置：本地文件系统还是 SQLite BLOB？
