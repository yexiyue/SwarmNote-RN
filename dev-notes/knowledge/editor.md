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
