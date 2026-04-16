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
    initialText: [
      '---',
      'title: Browser Dev Mode',
      'date: 2026-04-15',
      '---',
      '',
      '# SwarmNote Live Preview',
      '',
      '**加粗**、*斜体*、~~删除线~~、`行内代码`、==高亮==、[链接](https://example.com)',
      '',
      '转义测试：\\*not italic\\*',
      '',
      '## 列表',
      '',
      '- 无序列表',
      '  - 嵌套项',
      '- [ ] 未完成',
      '- [x] 已完成',
      '',
      '1. 有序列表',
      '2. 第二项',
      '',
      '> 引用文本',
      '',
      '## 代码块',
      '',
      '```typescript',
      'const hello: string = "world";',
      'console.log(hello);',
      '```',
      '',
      '## 表格',
      '',
      '| 功能 | 状态 | 说明 |',
      '| :--- | :---: | ---: |',
      '| Live Preview | ✅ | 格式字符隐藏 |',
      '| 表格渲染 | ✅ | HTML table |',
      '| 数学公式 | ✅ | KaTeX |',
      '',
      '## 数学公式',
      '',
      '行内：$E = mc^2$',
      '',
      '$$\\int_0^\\infty e^{-x} dx = 1$$',
      '',
      '## Inline HTML',
      '',
      '<mark>高亮</mark>、<kbd>Ctrl</kbd>、H<sub>2</sub>O、x<sup>2</sup>',
      '',
      '![placeholder](https://via.placeholder.com/400x100/f5f0e8/8b7355?text=Image+Test)',
      '',
      '---',
      '',
      'Live Preview 功能测试完毕。',
      '',
    ].join('\n'),
    settings: DEFAULT_SETTINGS,
  });
}
