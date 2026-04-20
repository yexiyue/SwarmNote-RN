# 编辑器

## 架构概览

编辑器采用 WebView 内嵌 CodeMirror 6 方案（参考 Joplin），通过 Comlink 实现双向 RPC。

调用链：`TypeScript (RN) → Comlink RPC → WebView → CM6 EditorView`

## Comlink WebView 适配器

### 双端消息通信

`src/lib/comlink-webview-adapter.ts` 实现 Comlink 的 Endpoint 接口：
- `createRNEndpoint(channel, getWebView)` — RN 侧：`injectJavaScript` 发送，`onMessage` 接收
- `createWebViewEndpoint(channel)` — WebView 侧：`ReactNativeWebView.postMessage` 发送，`addEventListener('message')` 接收

两端通过 `{ channel, payload }` 信封做多路复用（`editor-runtime` / `editor-host`）。

### injectJavaScript 安全传值

RN → WebView 方向通过 `injectJavaScript` 注入代码。必须用双重 `JSON.stringify` 产生安全的 JS 字符串字面量，然后 WebView 侧 `JSON.parse` 还原。

**正确做法**：

```js
const escaped = JSON.stringify(JSON.stringify(envelope));
webview.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:JSON.parse(${escaped})}));true;`);
```

**不要做**：

- 不要把 `JSON.stringify` 结果直接插入模板字面量 — 反引号会打断模板

### Uint8Array transferHandler

JSON.stringify(Uint8Array) 会丢失类型变成 `{"0":1,"1":2,...}`。两端都注册了自定义 `transferHandler`，把 `Uint8Array` 序列化为 `number[]`，反序列化还原。

**正确做法**：

- RN 侧调用 `registerTransferHandlers(Comlink)` （在 `useEditorBridge.ts` 模块顶层）
- WebView 侧调用 `registerTransferHandlers()` （在 `comlink-endpoint.ts` 中定义，`index.ts` 入口调用）

**不要做**：

- 不要在新增跨 bridge 的二进制数据类型时忘记双端注册

### transferHandler 仅对**顶层 RPC 参数**生效，不递归到嵌套字段

Comlink 的 `transferHandler.canHandle` 只在 marshal 单个 RPC 参数时检查；嵌套在对象字段里的 `Uint8Array` 不会被递归触发。在我们的自定义 endpoint 下整条 message 走 `JSON.stringify`，嵌套 `Uint8Array` 直接被 JSON 打散成 `{"0":N,"1":N,...}`，对端拿到的是 plain object（`.byteLength === undefined`）。

**症状**：编辑后 `[handler] CollaborationUpdate received bytes=undefined`。本地编辑表面上"触发了事件"，但 binary payload 全部丢失，落盘 / 同步全废。

**正确做法**：把 binary payload 作为**顶层 RPC 参数**单独走一个 method。例如把 `EditorEvent.CollaborationUpdate { update: Uint8Array }` 拆成：

```ts
// HostApi (packages/editor-web/src/types.ts)
interface HostApi {
  onEditorEvent(event: EditorEvent): void;       // 不带 binary 字段的事件
  onCollaborationUpdate(update: Uint8Array): void; // 顶层 Uint8Array → transferHandler 生效
  // ...
}
```

editor-runtime 侧不再 `emitEditorEvent({kind: 'collab-update', update})`，而是直接 `host.onCollaborationUpdate(update)`。

反方向（RN → WebView）的 `applyRemoteCollaborationUpdate(update)` 一直是顶层参数，所以从来没出过这个问题——这条规则只有在**新增 host callback 携带 binary** 时才会再被踩到。

**不要做**：

- 不要把 `Uint8Array` / `ArrayBuffer` 塞进事件对象 / record / map 等嵌套结构通过 Comlink RPC 传递
- 不要试图改 transferHandler 来"递归处理嵌套"——那是重写 Comlink 的序列化层，不值得；扁平 RPC 签名是更小的成本

**相关文件**：[`packages/editor-web/src/types.ts`](../../packages/editor-web/src/types.ts)、[`packages/editor-web/src/editor-runtime.ts`](../../packages/editor-web/src/editor-runtime.ts)、[`src/components/editor/useEditorBridge.ts`](../../src/components/editor/useEditorBridge.ts)、[`src/components/editor/MarkdownEditor.tsx`](../../src/components/editor/MarkdownEditor.tsx)

### Ready 握手

WebView 加载完成后通过 Comlink 调用 `runtime.host.onRuntimeReady()` 通知 RN 侧。RN 侧通过 `Comlink.expose(hostApi)` 接收。不再使用 raw `postMessage` 的 `__editorReady` 信号。

**相关文件**：`src/lib/comlink-webview-adapter.ts`、`src/components/editor/useEditorBridge.ts`、`packages/editor-web/src/index.ts`

## editor-web 构建管线

`vite build → vite-plugin-singlefile 内联为单 HTML → Metro require()`

WebView 支持 `<script type="module">`，vite 输出保持原样，不需要后处理。

**正确做法**：

- 修改 `packages/editor/` 或 `packages/editor-web/` 后，必须在 `packages/editor-web/` 运行 `pnpm build`
- 不重新构建的话，WebView 加载的还是旧 bundle

**相关文件**：`packages/editor-web/vite.config.ts`

## Android IME 兼容性

Android 必须禁用 EditContext API，否则 IME 输入法组合事件会出 bug。

**处理位置**：`packages/editor/src/createEditor.ts`

## 平台无关层

`packages/editor/` 是平台无关的 CM6 编辑器核心。

**不要做**：
- 不要在 `packages/editor/` 中引入 React Native 或 DOM 特定 API
- DOM 相关的逻辑放 `packages/editor-web/`
- RN 相关的逻辑放 `src/components/editor/`

### 编辑器运行时契约只从包入口导出

RN 宿主层与 bridge 代码应从 `@swarmnote/editor-web` 读取 `EditorApi` / `HostApi` / `EditorInitOptions` 等运行时类型，不要深层导入 `@swarmnote/editor-web/src/types`。

**正确做法**：

- 在 `packages/editor-web/src/index.ts` 统一 re-export runtime contract
- 宿主层通过包入口消费公开类型，避免依赖内部文件布局

**不要做**：

- 不要在 `src/components/editor/` 里深层导入 `@swarmnote/editor-web/src/*`

**相关文件**：`packages/editor-web/src/index.ts`、`packages/editor-web/src/types.ts`、`src/components/editor/MarkdownEditor.tsx`、`src/components/editor/useEditorBridge.ts`

### editor-web 模块结构

`packages/editor-web/src/` 按职责拆分为三个模块：

- `comlink-endpoint.ts` — WebView 侧 Comlink Endpoint 适配（与 RN 侧 `comlink-webview-adapter.ts` 对称）、transferHandler 注册、环境检测、debugLog
- `editor-runtime.ts` — `createEditorRuntime(host)` 工厂函数，管理 CM6 编辑器生命周期和 Yjs 协作绑定
- `index.ts` — 入口：注册 transferHandler、创建双通道 Endpoint、Comlink 连线、环境分支

**不要做**：

- 不要把新功能直接加到 `index.ts`，按职责放到对应模块
- 不要在 `editor-runtime.ts` 中直接依赖 `ReactNativeWebView` 全局变量，通过 `comlink-endpoint.ts` 的 `debugLog` 间接访问

### Yjs 绑定需要显式解绑 update listener

`editor-runtime.ts` 重建 editor 或切换 `Y.Doc` 时，必须先解绑旧 `ydoc.on('update', ...)` 监听，再重新绑定；远端 update 要使用固定 origin，避免被当成本地改动再次回传给宿主。

**正确做法**：

- 在 runtime 中维护当前 `ydoc` 和对应的 update listener 引用
- 重建 editor 前先 `ydoc.off('update', listener)`
- `applyRemoteCollaborationUpdate()` 与本地 update 过滤共用固定 remote origin 常量

**不要做**：

- 不要每次 `createEditor()` 都直接追加 `ydoc.on('update', ...)` 而不清理
- 不要让远端协作更新再次触发 outbound collaboration event

**相关文件**：`packages/editor-web/src/editor-runtime.ts`

## RN 宿主集成 Yjs Doc

### 打开笔记的初始化流程

Rust 是 Y.Doc 的权威拥有方。RN 侧打开笔记的链路：

```
点击树节点
  │
  ▼
useCurrentDocStore.open(relPath)
  │  workspace.openDoc(relPath) → { docUuid, yjsState: ArrayBuffer }
  ▼
<MarkdownEditor key={docUuid} docUuid initialState={yjsState} onCollabUpdate={...} />
  │
  │  内部按顺序：
  │  1. editorApi.createEditor({ collaboration: { ydoc: {}, fragmentName: 'document' } })
  │     ↳ editor-runtime 内部 new Y.Doc() 并绑定 y-codemirror.next
  │  2. editorApi.applyRemoteCollaborationUpdate(initialState)
  │     ↳ 用 REMOTE_COLLABORATION_ORIGIN 灌入 → 不触发 outbound CollaborationUpdate（防回环）
  │  3. registerBridge(docUuid, applyRemoteCollaborationUpdate)
  │
  ▼
本地编辑 → CollaborationUpdate event → onCollabUpdate(update)
  │  workspace.applyUpdate(docUuid, update.buffer.slice(...))
  │  ↳ 注意 Uint8Array 转 ArrayBuffer 时必须 slice，buffer 可能宽于 view
  ▼
Rust 落盘 + 必要时广播给其他设备
```

**关键约束**：

- `MarkdownEditor` 用 `key={docUuid}` 切笔记 — 整个 WebView 重建（200-500ms 加载），换来代码极简。后续可升级为 swap-Y.Text 内部 API。
- `current-doc-store.open()` 用 `openSeq` 抢占保护快速点击；过期请求会主动 close_doc 释放资源。
- 切 doc 之前 store action 已经把旧 docUuid 的 `closeDoc` 调过；MarkdownEditor unmount 不需要再次 close。
- 切工作区时 `workspace-manager.closeWorkspace()` 会先 reset 三个 store，再 `await ws.close()`，Rust 端 close 会 flush 所有打开的 doc。

### editor-bridge-registry — event-bus 与编辑器的桥

[`event-bus.ts`](../../src/core/event-bus.ts) 是普通模块（不是 React 组件），但 `ExternalUpdate` 事件需要 push update 给当前活跃编辑器。解决方案：[`src/core/editor-bridge-registry.ts`](../../src/core/editor-bridge-registry.ts) 单例容器。

```ts
register(docUuid, applyRemoteUpdate);  // MarkdownEditor mount + collab 模式时
clear(docUuid);                         // unmount 时；仅当 active.docUuid 匹配才清
getActive();                            // event-bus 在 ExternalUpdate 中读取
```

**关键约束**：

- `clear` 必须传 docUuid 并校验匹配。React strict mode 下 effect 会双 fire，简单清空会误把第二次 register 干掉。
- 切笔记时新 mount 在旧 unmount **前**触发 register 是正常的（key 切换时 React 会先创建新 instance）；registry 自然被新值覆盖。
- 同时只允许一个活跃编辑器 — MVP 简化设计。
- ExternalUpdate payload 是 `{ docId: string, update: ArrayBuffer }`，registry 用 docId 索引（不是 relPath）。

### 防回环靠 origin 标记，无需额外 dedupe

[`editor-runtime.ts:88-91`](../../packages/editor-web/src/editor-runtime.ts#L88-L91) 已经写：

```ts
const listener = (update: Uint8Array, origin: unknown) => {
  if (origin === remoteOrigin) {
    return;
  }
  emitEditorEvent({ kind: EditorEventType.CollaborationUpdate, update });
};
```

`applyRemoteCollaborationUpdate` 内部用 `Y.applyUpdate(ydoc, update, REMOTE_COLLABORATION_ORIGIN)`，所以远端灌入的 update **不会**触发 outbound CollaborationUpdate 事件，自然不会回写 Rust。RN 侧不需要再做 dedupe。

### MarkdownEditor 双模式

| 模式 | 触发条件 | 用途 |
|---|---|---|
| `collaboration` | `docUuid && initialState` 都存在 | 真实笔记（(main)/index.tsx） |
| `text` (legacy) | 仅 `initialText` | editor-test.tsx 调试入口 |

`enableYjs` 旧 prop 保留兼容，新代码不要使用。

## Live Preview 扩展体系

### Inline Rendering 框架

`makeInlineReplaceExtension` 是 Live Preview 的核心引擎：接收一组 `InlineRenderingSpec`，遍历 Lezer 语法树，对匹配节点应用 `Decoration.replace` 或 Widget 替换。

**已注册的替换**（`packages/editor/src/extensions/inlineRendering/index.ts`）：

- `replaceCheckboxes` — `[ ]` / `[x]` → 交互式 checkbox
- `replaceBulletLists` — `-` / `*` / `+` → styled bullet
- `replaceDividers` — `---` → 横线 widget
- `replaceFormatCharacters` — 隐藏 `##`、`**`、`` ` ``、`~~`、`>`、`==`、`[]()`
- `replaceBackslashEscapes` — `\*` 中隐藏 `\`

**Reveal 策略**（光标接近时显示原始 Markdown）：

| 策略       | 行为                         | 典型节点                                  |
| ---------- | ---------------------------- | ----------------------------------------- |
| `line`     | 光标在同一行时显示           | HeaderMark, CodeMark, QuoteMark           |
| `active`   | 光标在节点/父节点范围内显示  | EmphasisMark, LinkMark, StrikethroughMark |
| `select`   | 选区与节点相交时显示         | 较少使用                                  |

**正确做法**：

- 新增替换类型时实现 `InlineRenderingSpec` 接口，在 `index.ts` 注册
- 为每种节点类型选择合适的 reveal 策略：行级元素用 `line`，内联元素用 `active`

**相关文件**：`packages/editor/src/extensions/inlineRendering/`

### 块级图像渲染

独立于 inline rendering 框架，用 `ViewPlugin` + `ImageWidget` 实现。

- 只渲染独占一行的 `![alt](url)` 格式
- `ImageHeightCache`：LRU 缓存（max 500），防止图片加载导致滚动跳动
- 通过 `EditorFeatureToggles.blockImageRendering` 控制开关
- Reveal 策略：光标在图片行时显示原始 Markdown

**不要做**：

- 不要在 inline rendering 框架（`makeInlineReplaceExtension`）中处理块级元素

**相关文件**：`packages/editor/src/extensions/renderBlockImages.ts`

### 链接交互

两个独立扩展协作：

- `ctrlClickLinksExtension` — Ctrl/Cmd+Click 打开链接 + 移动端长按 500ms
- `linkTooltipExtension` — hover 显示链接 URL tooltip

链接点击通过 `EditorEvent.LinkOpen` 事件回传给 RN 侧，URL 从 Lezer 语法树的 `Link` / `URL` 节点提取。

**相关文件**：`packages/editor/src/extensions/links/`

### 列表续行

`insertNewlineContinueMarkup` 注册在 Enter keymap 上，优先于 `standardKeymap`。

**行为**：

- bullet 列表 → 续 `- `
- ordered 列表 → 续 `N+1.`（自动递增）
- checklist → 续 `- [ ]`（未勾选）
- blockquote → 续 `>`
- 空标记行 → 删除标记、回退缩进一级

基于 CodeMirror 官方 `insertNewlineContinueMarkup` 的 Joplin fork 版本。

**相关文件**：`packages/editor/src/editorCommands/insertNewlineContinueMarkup.ts`

## 主题系统

### EditorThemeConfig

`EditorThemeConfig` 定义在 `types.ts`，包含 `appearance`（light/dark）、`fontFamily`、`fontSize`、`colors` map。

### createEditorTheme

`packages/editor/src/theme/createTheme.ts` 根据 config 生成 `EditorView.theme()`。内置蜂巢纸笺品牌色（与 `global.css` 的 HSL 变量一致），可被 `colors` 覆盖。

**正确做法**：

- 通过 `updateSettings({ theme: { appearance: 'dark' } })` 运行时切换主题
- 主题使用独立 Compartment，切换时不重建 editor
- RN 侧在 `MarkdownEditor` 中用 `useColorScheme()` 自动同步

**不要做**：

- 不要在 WebView HTML 中硬编码颜色 — 全部通过 `EditorView.theme()` 注入
- 不要在 `markdownDecorationExtension` 的 theme 中放颜色 — 颜色统一由 `createEditorTheme` 管理

**相关文件**：`packages/editor/src/theme/createTheme.ts`、`packages/editor/src/extensions/editorSettingsExtension.ts`

## 代码块语言高亮

直接使用 `@codemirror/language-data` 的完整 `languages` 列表，支持 50+ 种语言。

**正确做法**：

- `createEditor.ts` 中 `import { languages } from '@codemirror/language-data'` 传入 `markdown({ codeLanguages: languages })`
- 不需要手动维护语言列表

**相关文件**：`packages/editor/src/createEditor.ts`
