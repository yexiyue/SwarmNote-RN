/**
 * editor-web 入口
 *
 * 负责：
 * 1. 注册 Comlink transferHandler
 * 2. 创建双通道 Comlink Endpoint 并连线
 * 3. 环境检测：WebView 模式 vs 浏览器独立调试模式
 */
import 'katex/dist/katex.min.css';
import * as Comlink from 'comlink';
import { DEFAULT_SETTINGS } from '@swarmnote/editor';
import {
  createWebViewEndpoint,
  isWebViewEnvironment,
  registerTransferHandlers,
} from './comlink-endpoint';
import { createEditorRuntime } from './editor-runtime';
import type { HostApi } from './types';

export type {
  EditorApi,
  EditorInitOptions,
  HostApi,
  HostEventHandler,
  RuntimeCreateEditorOptions,
  RuntimeState,
} from './types';

// 注册自定义 transferHandler（Uint8Array 等）
registerTransferHandlers();

// 创建双通道 Endpoint
const HOST_CHANNEL = 'editor-host';
const RUNTIME_CHANNEL = 'editor-runtime';

const hostEndpoint = createWebViewEndpoint(HOST_CHANNEL);
const runtimeEndpoint = createWebViewEndpoint(RUNTIME_CHANNEL);

// 连线：wrap 远端 HostApi，expose 本地 EditorApi
const host = Comlink.wrap<HostApi>(hostEndpoint);
const runtimeApi = createEditorRuntime(host);
Comlink.expose(runtimeApi, runtimeEndpoint);

// 环境分支
if (isWebViewEnvironment()) {
  // RN WebView 模式：通过 Comlink 通知宿主 runtime 已就绪
  host.onRuntimeReady();
} else {
  // 独立浏览器模式：直接创建编辑器用于开发调试
  runtimeApi.createEditor({
    initialText:
      '# Hello SwarmNote\n\n这是浏览器独立模式。\n\n## 功能测试\n\n- **加粗** 和 *斜体*\n- `行内代码`\n- [链接](https://example.com)\n\n### 代码块\n\n```typescript\nconst hello = "world";\nconsole.log(hello);\n```\n\n> 引用文本\n\n1. 有序列表\n2. 第二项\n\n- [ ] 待办事项\n- [x] 已完成\n\n---\n',
    settings: DEFAULT_SETTINGS,
  });
}
