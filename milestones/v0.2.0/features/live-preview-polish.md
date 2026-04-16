# Live Preview 渲染完善

## 用户故事

作为用户，我希望编辑器能完整渲染 Markdown 的所有常见元素（图片、表格、数学公式、Front Matter、Inline HTML），并且样式统一美观，以获得接近 Obsidian 的编辑体验。

## 依赖

- F6 Tailwind 集成：无依赖（L0），是 F1/F2 的前置
- F3/F4/F5：无依赖（L0），可独立开发
- F1/F2：依赖 F6 Tailwind 集成（L1）

## 需求描述

### F6: editor-web Tailwind CSS 集成

在 `packages/editor-web/` 的 Vite 构建中引入 Tailwind CSS，采用**混合模式**：

- CM6 核心样式（scroller、content、cursor、selection 等）保持 `EditorView.theme()` 不动
- 自定义 Widget（表格、图片、代码块、数学公式等）的 DOM 元素使用 Tailwind className
- `vite-plugin-singlefile` 会将 Tailwind 生成的 CSS 内联到最终的单 HTML 文件中

#### 实现步骤

1. 在 `packages/editor-web/` 安装 `@tailwindcss/vite`
2. 创建 CSS 入口文件，`import "tailwindcss"`
3. 在 `index.html` 或 CSS 中定义编辑器 CSS 变量，与 RN 侧 `global.css` 保持一致的变量体系
4. 逐步将现有 Widget 的 `EditorView.theme()` 样式迁移到 Tailwind className

### F1: 图片渲染重做

**现状问题**：图片完全不显示，需要排查根因并重做。

**目标行为**（Obsidian reveal 风格）：
- 非聚焦时：渲染 `<img>` 元素显示图片
- 光标在图片行时：显示原始 `![alt](url)` Markdown 文本
- 支持 URL 图片和本地文件路径

**需要排查的问题**：
- WebView 是否能加载外部 URL 图片（CSP / 混合内容策略）
- WebView 是否能加载本地文件路径（`file://` 协议、Android/iOS 文件访问权限）
- `<img>` 标签的 src 解析逻辑是否正确

**现有代码**：`packages/editor/src/extensions/renderBlockImages.ts`，基础架构可复用（高度缓存、ViewPlugin、光标行 reveal），但需要修复显示问题并用 Tailwind 重写样式。

### F2: 表格渲染重做

**现状问题**：表格编辑体验有 bug，且不是 Obsidian 高级表格风格。

**目标行为**（Obsidian 高级表格风格）：
- **始终**渲染为 HTML `<table>`，不会切换回原始 Markdown
- 单元格直接可编辑（contentEditable）
- Tab 在单元格间导航
- 操作按钮：添加/删除行列、列对齐切换
- **行/列拖拽重排**
- 编辑单元格内容实时同步回 Markdown 源码

**现有代码**：`packages/editor/src/extensions/renderBlockTables.ts`，`EditableTableWidget` 架构可参考但需要重做：
- 修复 contentEditable ↔ Markdown 同步 bug
- 用 Tailwind 重写所有样式
- 新增拖拽重排功能（行/列拖拽手柄 + DOM 重排 + Markdown 重新生成）

**拖拽重排技术方案**：
- 行/列左侧/上方显示拖拽手柄（hover 时出现）
- 使用 HTML Drag and Drop API 或 pointer events 实现拖拽
- 拖拽结束后重排 `TableData` 并重新生成 Markdown

### F3: 数学公式 (KaTeX)

**现有代码**：
- `packages/editor/src/extensions/markdownMathExtension.ts` — Lezer 语法扩展
- `packages/editor/src/extensions/inlineRendering/replaceMathFormulas.ts` — inline `$...$` 替换

**待完善**：
- 确认 `$inline$` 渲染正确（KaTeX → Widget）
- 实现 `$$block$$` 块级数学公式渲染（Widget Decoration）
- 确保 katex CSS 在 WebView 中正确加载（已有 `import 'katex/dist/katex.min.css'`）

### F4: Front Matter

**现有代码**：`packages/editor/src/extensions/markdownFrontMatterExtension.ts`

**待完善**：
- 确认 `---` 区域正确识别
- 实现折叠显示（点击展开/收起）
- 折叠时显示摘要（如 "Front Matter (3 fields)"）

### F5: Inline HTML 渲染

**现有代码**：`packages/editor/src/extensions/inlineRendering/replaceInlineHtml.ts`

**待完善**：
- 确认 `<mark>` 渲染为高亮
- 确认 `<kbd>` 渲染为键盘按键样式
- 确认 `<sub>` `<sup>` 渲染为下标/上标
- 确保光标在 HTML 标签上时显示原始标记

## 交互设计

### 表格交互

```
┌─────────────────────────────────────┐
│  ⋮  │  ← →  │  ← →  │  ← →  │    │  ← 列对齐按钮（hover 显示）
├─────┼────────┼────────┼────────┤    │
│  ≡  │ Header │ Header │ Header │    │  ← ≡ 行拖拽手柄
├─────┼────────┼────────┼────────┤    │
│  ≡  │ Cell   │ Cell   │ Cell   │    │
├─────┼────────┼────────┼────────┤    │
│  ≡  │ Cell   │ Cell   │ Cell   │    │
└─────┴────────┴────────┴────────┘    │
  [+ Row] [- Row] [+ Col] [- Col]     ← 操作按钮（hover 显示）
```

### 图片渲染

- 非聚焦：居中显示图片，圆角，最大宽度 100%
- 加载失败：显示 alt 文本 fallback
- 点击图片：光标移到图片行，显示原始 Markdown

## 技术方案

### 前端

- 所有 Widget 使用 Tailwind className 替代 `EditorView.theme()` 硬编码样式
- 暗色模式通过 Tailwind `dark:` 前缀支持
- CSS 变量与 RN 侧 `global.css` 保持一致

### 涉及文件

| 功能 | 文件 |
| ---- | ---- |
| Tailwind 集成 | `packages/editor-web/vite.config.ts`, `packages/editor-web/src/editor.css`(新建) |
| 图片重做 | `packages/editor/src/extensions/renderBlockImages.ts` |
| 表格重做 | `packages/editor/src/extensions/renderBlockTables.ts` |
| 数学公式 | `packages/editor/src/extensions/markdownMathExtension.ts`, `replaceMathFormulas.ts` |
| Front Matter | `packages/editor/src/extensions/markdownFrontMatterExtension.ts` |
| Inline HTML | `packages/editor/src/extensions/inlineRendering/replaceInlineHtml.ts` |

## 验收标准

- [ ] editor-web 构建包含 Tailwind CSS，Widget 样式用 className
- [ ] 图片正常显示（URL + 本地路径），非聚焦时渲染、聚焦时 reveal
- [ ] 表格始终渲染为 HTML table，单元格可编辑，内容实时同步
- [ ] 表格支持添加/删除行列、列对齐切换
- [ ] 表格支持行/列拖拽重排
- [ ] `$inline$` 数学公式渲染为 KaTeX
- [ ] `$$block$$` 块级数学公式渲染为 KaTeX
- [ ] Front Matter `---` 区域可折叠/展开
- [ ] `<mark>` `<kbd>` `<sub>` `<sup>` 正确渲染
- [ ] 亮色/暗色模式下所有 Widget 样式正确
- [ ] 大文档（1000+ 行）滚动流畅，无明显卡顿

## 任务拆分建议

> 此部分可留空，由 /project-plan 自动拆分为 GitHub Issues。

## 开放问题

- 图片不显示的根因需要先排查确认（WebView 环境 vs 浏览器 dev 模式对比）
- 表格拖拽重排的复杂度可能较高，可作为增强单独排期
- `$$block$$` 数学公式是否需要支持编辑（点击进入编辑模式）还是只做只读渲染
- Front Matter 折叠后的摘要格式：显示字段数 vs 显示 title 字段值
