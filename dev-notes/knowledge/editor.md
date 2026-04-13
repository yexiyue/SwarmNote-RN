# 编辑器

## 架构概览

编辑器采用 WebView 内嵌 CodeMirror 6 方案（参考 Joplin），通过 Comlink 实现双向 RPC。

调用链：`TypeScript (RN) → Comlink RPC → WebView → CM6 EditorView`

## Comlink WebView 适配器

### 双端消息通信

`src/lib/comlink-webview-adapter.ts` 实现 Comlink 的 Endpoint 接口：
- `createRNEndpoint(getWebView)` — RN 侧：`injectJavaScript` 发送，`onMessage` 接收
- `createWebViewEndpoint()` — WebView 侧：`ReactNativeWebView.postMessage` 发送，`addEventListener('message')` 接收

**相关文件**：`src/lib/comlink-webview-adapter.ts`

## editor-web 构建管线

`tsdown → IIFE bundle → codegen.mjs 包装为 CJS string → Metro require()`

**正确做法**：
- 修改 `packages/editor/` 或 `packages/editor-web/` 后，必须在 `packages/editor-web/` 运行 `pnpm build`
- 不重新构建的话，WebView 加载的还是旧 bundle

**相关文件**：`packages/editor-web/scripts/codegen.mjs`

## Android IME 兼容性

Android 必须禁用 EditContext API，否则 IME 输入法组合事件会出 bug。

**处理位置**：`packages/editor/src/createEditor.ts`

## 平台无关层

`packages/editor/` 是平台无关的 CM6 编辑器核心。

**不要做**：
- 不要在 `packages/editor/` 中引入 React Native 或 DOM 特定 API
- DOM 相关的逻辑放 `packages/editor-web/`
- RN 相关的逻辑放 `src/components/editor/`
