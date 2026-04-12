# Markdown Live Preview 装饰扩展

## 用户故事

作为用户，我希望在编辑 Markdown 时能看到实时的视觉渲染效果（标题变大、粗体加粗、链接高亮等），而不是只看到原始标记符号，以获得接近 Obsidian 的编辑体验。

## 依赖

- 无依赖（L0）
- 前置：`@swarmnote/editor` 包已存在（已完成）

## 需求描述

在 `@swarmnote/editor` 包中实现 Markdown Live Preview 装饰扩展，利用 `@lezer/markdown` 解析语法树，通过 CM6 Decoration API 给各类 Markdown 元素添加 CSS class，配合 CSS 实现"所见即所得"效果。

这是 Obsidian、Joplin、HyperMD 等编辑器的标准实现模式：**不 fork 解析器，而是在标准 CM6 体系内用装饰层 + CSS 实现视觉效果**。

### 核心装饰列表

| Markdown 元素 | 装饰类型 | CSS class 示例 | 视觉效果 |
| --- | --- | --- | --- |
| ATX 标题（# ~ ######） | Line Decoration | `cm-h1` ~ `cm-h6`, `cm-headerLine` | 字号递减，`#` 符号淡化 |
| 粗体 `**text**` | Mark Decoration | `cm-strong` | 加粗，`**` 淡化/隐藏 |
| 斜体 `*text*` | Mark Decoration | `cm-em` | 斜体，`*` 淡化/隐藏 |
| 行内代码 `` `code` `` | Mark Decoration | `cm-inlineCode` | 等宽字体 + 背景色 |
| 代码块 ` ```...``` ` | Line Decoration | `cm-codeBlock` | 背景色块，关闭拼写检查 |
| 链接 `[text](url)` | Mark Decoration | `cm-link`, `cm-url` | 链接色，URL 淡化 |
| 图片 `![alt](src)` | Widget Decoration | `cm-image` | 内联图片预览（后续） |
| 引用 `> text` | Line Decoration | `cm-blockquote` | 左边框 + 缩进 |
| 列表 `- item` | Line Decoration | `cm-list` | 缩进 + 列表标记样式 |
| 水平线 `---` | Line Decoration | `cm-hr` | 横线样式 |
| 删除线 `~~text~~` | Mark Decoration | `cm-strikethrough` | 删除线 |

### 关键行为

- **光标所在行显示原始标记**：当光标在某行时，该行的 Markdown 标记符号（`##`、`**` 等）不隐藏，便于编辑
- **离开行时隐藏标记**：光标移开后，标记符号淡化或隐藏，只显示渲染效果
- **仅渲染可见区域**：使用 `view.viewport` 限定装饰范围，避免大文档性能问题

## 交互设计

- 无独立 UI，效果体现在编辑器渲染中
- 编辑体验参考 Obsidian 的 Live Preview 模式

## 技术方案

### 核心实现

```text
packages/editor/src/extensions/
├── markdownDecoration.ts     # ViewPlugin：遍历 Lezer AST，按节点类型分发装饰
├── markdownHighlight.ts      # 语法高亮增强（可选，classHighlighter 已覆盖基础）
└── livePreview.css           # 装饰对应的 CSS 样式
```

**实现模式**（参考 CM6 官方文档 + simple-markdown-editor MIT 项目）：

1. `ViewPlugin.fromClass`：创建一个 Plugin，在 `constructor` 和 `update` 中调用 `buildDecorations`
2. `ensureSyntaxTree(state, viewport.to)`：获取当前可见区域的 Lezer 语法树
3. `tree.iterate({ enter })`：遍历语法节点，根据 `node.name` 分发到对应装饰
4. `RangeSetBuilder<Decoration>`：高效构建装饰集合
5. CSS 负责视觉效果（字号、颜色、隐藏标记字符等）

### MIT 兼容代码起点

- [CodeMirror 6 Decoration 文档](https://codemirror.net/docs/ref/#view.Decoration)
- [simple-markdown-editor](https://github.com/CTRL-Neo-Studios/simple-markdown-editor)（MIT，以复刻 Obsidian Live Preview 为目标）
- [@lezer/markdown API](https://github.com/lezer-parser/markdown)

## 验收标准

- [ ] 标题（h1-h6）渲染：字号递减，`#` 符号在非聚焦行淡化
- [ ] 粗体、斜体、行内代码渲染正确
- [ ] 代码块有背景色，关闭拼写检查
- [ ] 链接高亮，URL 部分淡化
- [ ] 引用有左边框样式
- [ ] 列表项缩进和标记样式正确
- [ ] 光标所在行显示原始 Markdown 标记
- [ ] 大文档（1000+ 行）滚动流畅，无明显卡顿
- [ ] 亮色/暗色主题下样式均正确

## 任务拆分建议

1. 实现基础 `markdownDecorationExtension`（标题 + 粗体 + 斜体 + 代码）
2. 扩展装饰：链接、引用、列表、水平线、删除线
3. 实现"光标行显示原始标记"逻辑
4. 编写 Live Preview CSS（亮色 + 暗色）
5. Image Widget Decoration（只读渲染）
6. 性能测试：大文档场景验证

## 开放问题

- 是否需要支持 GFM 表格的 Live Preview？（工作量大，可推迟）
- Image Widget 是否在本阶段实现？（建议先只做文本装饰，图片后续版本）
- CSS 是否需要跟随 RN 侧主题变量？（WebView 内需要独立的 CSS 变量体系）
