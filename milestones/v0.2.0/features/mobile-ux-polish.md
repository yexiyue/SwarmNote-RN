# 移动端编辑器 UX 打磨

## 用户故事

作为用户，我希望在手机上编辑 Markdown 时有舒适的体验：有格式化快捷工具栏、键盘不遮挡编辑区域、暗色模式正常显示、能搜索替换、粘贴图片自动处理，接近 Joplin/Obsidian 的移动端编辑体验。

## 依赖

- F9 暗色主题：无依赖（L0）
- F7 格式化工具栏：依赖 F6 Tailwind 集成（L1）
- F8 键盘适配：依赖 F6 Tailwind 集成（L1）
- F10 搜索面板：依赖 F7 + F8（L2）
- F11 粘贴图片处理：依赖 F1 图片渲染重做（L2）

## 需求描述

### F9: 暗色主题

**现状**：编辑器 WebView 内有基础的 CSS 变量（`index.html` 中 `@media (prefers-color-scheme: dark)`），但 Widget 样式未适配暗色模式。

**目标**：

- RN 侧检测当前主题 → 通过 Comlink 通知 WebView
- WebView 内切换 CSS class（`html.dark`），Tailwind `dark:` 前缀生效
- 所有 Widget（表格、图片、代码块、数学公式等）暗色模式下样式正确
- CSS 变量体系与 RN 侧 `global.css` 保持一致

**技术要点**：

- 新增 Comlink API：`editorApi.updateSettings({ theme: { appearance: 'dark' } })`（已有 `EditorAppearance` 类型）
- WebView 内通过 `document.documentElement.classList.toggle('dark')` 切换
- Tailwind 暗色模式策略设为 `class`（而非 `media`），以便 RN 侧主动控制

### F7: 格式化工具栏

**目标**：键盘上方浮动的快捷操作栏。

**按钮列表**：

| 按钮 | 命令 | 说明 |
| ---- | ---- | ---- |
| **B** | toggleBold | 加粗 |
| *I* | toggleItalic | 斜体 |
| H | toggleHeading | 标题（循环 h1-h3-正文） |
| `<>` | toggleCode | 行内代码 |
| `-` | toggleUnorderedList | 无序列表 |
| `☐` | toggleCheckList | 任务列表 |
| `1.` | toggleOrderedList | 有序列表 |
| `>` | insertCodeBlock | 代码块 |
| `🔗` | 自定义 | 插入链接 |
| `📷` | 自定义 | 插入图片 |

**交互设计**：

```text
┌──────────────────────────────────────────┐
│  编辑区域（WebView）                       │
│                                          │
│  # 这是标题                               │
│  这是正文，**粗体**和*斜体*                 │
│                                          │
├──────────────────────────────────────────┤
│ [B] [I] [H] [<>] [-] [☐] [1.] [>] [🔗]  │  ← 格式化工具栏（原生 RN 组件）
├──────────────────────────────────────────┤
│           虚拟键盘                         │
└──────────────────────────────────────────┘
```

**技术要点**：

- 工具栏是**原生 RN 组件**（不在 WebView 内），悬浮在键盘上方
- 按钮调用 `editorApi.execCommand('toggleBold')` 等 Comlink RPC
- 键盘收起时工具栏隐藏
- 按钮状态反映当前选区格式（已有 `SelectionFormattingChange` 事件）
- 使用 RN 的 `KeyboardAvoidingView` 或 `InputAccessoryView`（iOS）

### F8: 键盘适配

**目标**：键盘弹出时编辑区域自动缩小，光标保持可见。

**具体需求**：

- `<WebView>` 外层包裹 `KeyboardAvoidingView`
- 键盘弹出时编辑区域高度自动调整（非简单上推，而是缩小可视区域）
- 光标始终在可见区域内
- 键盘收起时编辑区域恢复
- 设置 `keyboardDisplayRequiresUserAction={false}` 允许 JS 触发键盘

### F10: 搜索面板

**目标**：文档内搜索/替换。

**方案选择**：

- CM6 `@codemirror/search` 扩展已集成（`createSearchExtension`）
- 搜索 UI 在 RN 侧实现（CM6 默认搜索面板在移动端不友好）
- 通过 Comlink 调用 `editorApi.setSearchState()` 控制搜索状态

**具体需求**：

- RN 侧搜索栏组件（输入框 + 上一个/下一个/替换按钮）
- 支持大小写敏感、全词匹配选项
- 高亮所有匹配项，当前匹配项高亮区分
- 显示匹配计数（如 "3/15"）

### F11: 粘贴图片处理

**目标**：粘贴图片时自动保存到本地并插入 Markdown 链接。

**用户流程**：
1. 用户复制一张图片
2. 在编辑器中粘贴
3. 图片自动保存到本地存储
4. 在光标位置插入 `![image](local-path/image.png)`
5. 图片 Widget 渲染显示图片

**技术要点**：

- WebView 内监听 `paste` 事件，提取图片数据
- 通过 Comlink 传输图片数据到 RN 侧
- RN 侧调用文件系统 API 保存图片
- 返回文件路径给 WebView，插入 Markdown

**开放决策**：

- 存储位置：本地文件系统 vs SQLite BLOB（建议文件系统，更易管理和调试）
- 文件命名：时间戳 vs UUID vs 内容哈希

## 技术方案

### 前端（RN 侧）

| 功能 | 涉及文件 |
| ---- | -------- |
| 暗色主题 | `src/components/editor/useEditorBridge.ts`（主题切换通知） |
| 格式化工具栏 | `src/components/editor/EditorToolbar.tsx`（新建） |
| 键盘适配 | `src/components/editor/MarkdownEditor.tsx`（KeyboardAvoidingView） |
| 搜索面板 | `src/components/editor/EditorSearchBar.tsx`（新建） |
| 粘贴图片 | `src/components/editor/useEditorBridge.ts`（处理粘贴回调） |

### WebView 侧

| 功能 | 涉及文件 |
| ---- | -------- |
| 暗色主题 | `packages/editor-web/index.html`（CSS 变量）、`packages/editor/src/theme/createTheme.ts` |
| 粘贴处理 | `packages/editor-web/src/editor-runtime.ts`（paste 事件监听） |

## 验收标准

- [ ] 暗色模式下编辑器所有元素配色正确（背景、文字、语法高亮、所有 Widget）
- [ ] RN 侧主题切换后 WebView 内同步切换
- [ ] 格式化工具栏在键盘上方正确显示
- [ ] 工具栏按钮功能正常，状态反映当前选区格式
- [ ] 键盘收起时工具栏隐藏
- [ ] 键盘弹出/收起时编辑区域平滑调整，光标不被遮挡
- [ ] 搜索栏可打开/关闭，搜索高亮正确，匹配计数显示
- [ ] 搜索支持替换功能
- [ ] 粘贴图片可保存到本地并插入 Markdown 链接
- [ ] Android 和 iOS 上体验一致
- [ ] Android 中文输入正常（IME composition 无丢字/崩溃）

## 任务拆分建议

> 此部分可留空，由 /project-plan 自动拆分为 GitHub Issues。

## 开放问题

- `InputAccessoryView` 仅 iOS 支持，Android 需要用其他方案（自定义 View + Keyboard API？）
- 粘贴图片的存储位置：本地文件系统 vs SQLite BLOB
- 搜索面板是否需要支持正则表达式（移动端使用场景不多，可推迟）
- 格式化工具栏是否需要支持自定义按钮顺序
