# SwarmNote 编辑器架构迁移：从 BlockNote 到 CodeMirror 6

> 本文记录 SwarmNote 双端（Tauri 桌面 + Expo 移动）从 BlockNote 迁移到 CodeMirror 6 的决策过程、Joplin 架构深度剖析、以及分阶段迁移计划。核心结论：**放弃 Notion 式 block 编辑器定位，转向 Obsidian 式 Markdown Live Preview 架构**，通过 Joplin 验证过的生产级模式实现双端 CM6 复用。

## 目录

1. [背景与决策](#1-背景与决策)
2. [为什么不继续用 BlockNote](#2-为什么不继续用-blocknote)
3. [为什么选择 CodeMirror 6](#3-为什么选择-codemirror-6)
4. [为什么参考 Joplin](#4-为什么参考-joplin)
5. [Joplin 架构全景](#5-joplin-架构全景)
6. [`@joplin/editor` 核心模块剖析](#6-joplineditor-核心模块剖析)
7. [移动端 WebView 集成的五个关键模式](#7-移动端-webview-集成的五个关键模式)
8. [关键坑：Android IME 与 EditContext API](#8-关键坑android-ime-与-editcontext-api)
9. [SwarmNote 的特殊需求：yjs 实时协作](#9-swarmnote-的特殊需求yjs-实时协作)
10. [分阶段迁移计划](#10-分阶段迁移计划)
11. [需要立即决策的问题](#11-需要立即决策的问题)
12. [参考资料](#12-参考资料)

---

## 1. 背景与决策

SwarmNote 桌面端（Tauri v2 + React 19）此前使用 **BlockNote**（基于 ProseMirror/Tiptap 的 Notion 式 block 编辑器），配合自研的 `crates/yrs-blocknote` crate 实现 Markdown ↔ BlockNote Y.Doc XML schema 的双向转换。这套架构在桌面端工作良好，支持自定义 React block（image、video）、拖拽重排、slash menu 等 Notion 式交互。

但在启动移动端（swarmnote-mobile，Expo SDK 55 + RN 0.83）时，发现了严重的架构冲突：

- **BlockNote 没有 React Native 原生实现**，ProseMirror 严重依赖浏览器 DOM 和 DOM Observer，不可能在 RN 上原生跑
- **BlockNote in WebView 方案的 UX 上限低于 Obsidian**，因为 ProseMirror 的 contenteditable 在移动端（尤其 Android 中文 IME）有大量已知问题
- **yrs-blocknote crate 紧耦合 BlockNote XML schema**，任何不同编辑器都无法直接复用这个桥接层

经过对 Obsidian、Joplin、react-native-enriched-markdown、Milkdown、Plate、Lexical 等方案的系统调研，最终决策：

> **SwarmNote 双端都迁移到 CodeMirror 6**，参考 Joplin 的 `@joplin/editor` 架构，实现一个平台无关的 CM6 编辑器包，桌面端直接 import，移动端通过 WebView 加载打包后的 bundle。产品定位从"Notion 式 block 笔记"转向"Obsidian 式 Markdown Live Preview 笔记"。

这是一次**产品定位级的决策**，不是单纯的技术换装。放弃的是 block 结构、拖拽、自定义 React block；换来的是双端统一架构、字符级 CRDT 实时协作的成熟路径（`y-codemirror.next`）、以及一个已被 Obsidian 千万级用户和 Joplin 生产环境验证过的 UX 上限。

---

## 2. 为什么不继续用 BlockNote

| 问题 | 具体表现 |
|---|---|
| **移动端 ContentEditable 坑** | ProseMirror 基于浏览器 contentEditable，Android WebView 的 composition event 在某些版本有已知 bug，中文输入会丢字 |
| **BlockNote 官方无移动端方案** | `@blocknote/react` 设计上只面向桌面 React，mobile UI 需要自己重写 slash menu、block drag handle 等交互 |
| **yjs schema 紧耦合** | BlockNote 在 yjs 里存的是 `<blockGroup>/<blockContainer>/<paragraph>` XML + ProseMirror marks，跨编辑器无法复用 |
| **yrs-blocknote 400+ 行的 XML 编解码** | 每次 BlockNote 自定义 block 变更，都要同步改 Rust 侧的 XML schema |
| **自定义 block 不能在移动端复用** | 桌面端的 `CustomReactImageBlock` / `CustomReactVideoBlock` 是 React 组件，移动端无法直接挪用 |

Joplin 团队也曾评估过 ProseMirror 系的方案，最终选择 CM6 的理由之一就是：

> "CodeMirror 6 是少数在移动端能体面工作的代码编辑器之一"（Obsidian 团队采访原话，Joplin 和 Obsidian 都选了 CM6）

---

## 3. 为什么选择 CodeMirror 6

CM6 相对于其他候选方案的独特优势：

| 候选 | 移动端友好 | yjs 集成 | 生产验证 | 结论 |
|---|---|---|---|---|
| **CodeMirror 6** | ✅ Obsidian、Joplin 生产实证 | ✅ `y-codemirror.next`（yjs 作者维护） | ✅ 数千万用户 | **✅ 选它** |
| BlockNote（现状） | ⚠️ 移动端不友好 | ✅ 原生支持 | ✅ | 移动端不行 |
| Lexical | ⚠️ Lexical iOS + RN wrapper 还在 early 阶段 | ✅ `@lexical/yjs` | ⚠️ Meta 自己项目用 | 太早期 |
| Milkdown / Plate | ⚠️ 同 ProseMirror/Slate 系，contentEditable 坑 | ✅ 通过 PM/Slate yjs | ⚠️ | 移动端同样受限 |
| react-native-enriched-markdown | ✅ 纯原生、无 contentEditable | ❌ uncontrolled 组件，只暴露 HTML 快照，没有细粒度编辑事件 | ⚠️ v0.4 太年轻 | yjs 集成不匹配 |
| TenTap | ⚠️ Tiptap-in-WebView，同 PM 坑 | ⚠️ 需自己重建 schema | ✅ | 工作量大 |

**CM6 + y-codemirror.next 的关键优势**：

1. **字符级 CRDT 开箱即用** —— y-codemirror.next 由 yjs 作者 Kevin Jahns 亲自维护，把 CM6 的 `ChangeSet` 直接翻译成 `Y.Text` 操作，光标、选区、undo/redo 全部自动对齐
2. **yjs schema 退化为单个 Y.Text** —— 整篇 Markdown 文档就是一个 Y.Text，不再需要 `yrs-blocknote` 的 400+ 行 XML 编解码，Rust 侧用 yrs 原生 API 就够了
3. **Live Preview 装饰是成熟模式** —— 用 `@lezer/markdown` 解析语法树 + CM6 `Decoration` API 给节点加 CSS class + 外层 CSS 隐藏 Markdown 标记字符。Joplin、Obsidian、HyperMD、simple-markdown-editor 都是这个模式
4. **双端零分歧** —— 同一个 CM6 实例、同一套扩展、同一套命令，桌面和移动共享代码

---

## 4. 为什么参考 Joplin

Joplin（44k+ stars，笔记类头部开源产品）的移动端架构恰好就是我们想要的：

- **同一个 `@joplin/editor` package，桌面 Electron 和移动 RN WebView 都在用**
- **CM6 + Live Preview 装饰全套扩展，生产打磨多年**
- **把 `@joplin/editor` 打包成可注入 WebView 的 IIFE bundle，通过类型安全的 RPC messenger 和 RN 侧通信**
- **Android IME、iOS 选区、虚拟键盘等平台细节的所有解决方案**

Joplin **没有** yjs / CRDT 实时协作功能（他们用自己的文件级 sync 协议），所以 yjs 部分需要 SwarmNote 自己加。但除了 yjs 这一块，其他所有的脏活 Joplin 已经都趟过了。

**一句话总结**：Joplin 帮我们解决了"CM6 怎么跨桌面 + 移动 WebView 共享"的问题，SwarmNote 只需要在这个成熟架构上加一个 `y-codemirror.next` 扩展。

---

## 5. Joplin 架构全景

Joplin 的双端 CM6 架构分为三层：

```text
┌─ @joplin/editor (纯 TS package，双端共享) ───────────────────┐
│                                                               │
│  CodeMirror/createEditor.ts     ← 唯一的 CM6 初始化入口       │
│  CodeMirror/CodeMirrorControl.ts ← EditorControl 实现        │
│  CodeMirror/extensions/          ← CM6 扩展集                 │
│    • markdownDecorationExtension ← Live Preview 核心          │
│    • markdownMathExtension       ← KaTeX 内联渲染             │
│    • markdownHighlightExtension                               │
│    • markdownFrontMatterExtension                             │
│    • searchExtension / overwriteMode / ctrlClickLinks / ...   │
│    • rendering/                  ← image/code 的块级渲染      │
│  CodeMirror/editorCommands/      ← toggleBold / toggleList 等 │
│  types.ts                        ← EditorControl 接口         │
│  events.ts                       ← EditorEvent 类型           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ 直接 import                         │ 打包成 bundle 注入
         │                                    │
┌────────┴────────┐           ┌────────────────┴──────────────┐
│  app-desktop    │           │  app-mobile (React Native)    │
│  (Electron)     │           │                               │
│                 │           │  contentScripts/              │
│  直接挂到 React │           │    markdownEditorBundle/      │
│  组件的 DOM 里  │           │      contentScript.ts         │
│                 │           │      useWebViewSetup.ts       │
│                 │           │      types.ts                 │
│                 │           │                               │
│                 │           │  components/NoteEditor/       │
│                 │           │    MarkdownEditor.tsx         │
│                 │           │                               │
│                 │           │  utils/ipc/                   │
│                 │           │    RNToWebViewMessenger.ts    │
│                 │           │    WebViewToRNMessenger.ts    │
└─────────────────┘           └───────────────────────────────┘
```

**关键设计原则**：

- `@joplin/editor` **完全不知道自己会被挂到 Electron 还是 RN WebView**，它就是一个纯 TS 编辑器库，暴露 `createEditor(parentElement, props) => EditorControl`
- 桌面端直接 `import { createEditor } from '@joplin/editor/CodeMirror'` 使用
- 移动端通过"bundle 层"（4 个文件）把 editor 打包成可注入 WebView 的 IIFE，外层由 RN 的 `MarkdownEditor.tsx` 组件包装

---

## 6. `@joplin/editor` 核心模块剖析

### 6.1 依赖栈

[`packages/editor/package.json`](../../../joplin/packages/editor/package.json) 核心依赖：

```json
{
  "@codemirror/autocomplete": "6.20.1",
  "@codemirror/commands": "6.10.3",
  "@codemirror/lang-markdown": "6.5.0",
  "@codemirror/language": "6.12.3",
  "@codemirror/language-data": "6.3.1",
  "@codemirror/state": "6.6.0",
  "@codemirror/view": "6.41.0",
  "@lezer/common": "1.5.0",
  "@lezer/highlight": "1.2.3",
  "@lezer/markdown": "1.6.3",
  "@replit/codemirror-vim": "6.2.1",
  "dompurify": "3.3.1"
}
```

**注意**：没有 `y-codemirror.next`。Joplin 不做实时协作。这正是 SwarmNote 需要额外加的那一块。

### 6.2 `createEditor.ts` 主入口

[`packages/editor/CodeMirror/createEditor.ts`](../../../joplin/packages/editor/CodeMirror/createEditor.ts) 是整个编辑器的唯一初始化入口，签名：

```typescript
const createEditor = (
  parentElement: HTMLElement,
  props: EditorProps & CodeMirrorProps,
): CodeMirrorControl => {
  // 1. 读取 settings
  const settings = props.settings;

  // 2. 构建扩展列表
  const extensions = [
    history(),
    drawSelection(),
    highlightSpecialChars(),
    rectangularSelection(),
    dropCursor(),
    // Markdown 相关
    markdownLanguage,
    syntaxHighlighting(classHighlighter),
    decoratorExtension,
    biDirectionalTextExtension,
    searchExtension,
    // 快捷键
    keymap.of([...standardKeymap, ...historyKeymap, ...searchKeymap]),
    // 自定义命令
    configFromSettings(settings),
  ];

  // 3. 创建 EditorView
  const editorView = new EditorView({
    state: EditorState.create({ doc: initialText, extensions }),
    parent: parentElement,
  });

  // 4. 包装成 CodeMirrorControl
  return new CodeMirrorControl(editorView, callbacks);
};
```

### 6.3 `CodeMirrorControl.ts` 命令式包装

[`packages/editor/CodeMirror/CodeMirrorControl.ts`](../../../joplin/packages/editor/CodeMirror/CodeMirrorControl.ts) 是一个**命令式 API wrapper**，把 CM6 的 declarative state 模型包装成外部易用的方法调用：

```typescript
export default class CodeMirrorControl
  extends CodeMirror5Emulation
  implements EditorControl {

  public constructor(editor: EditorView, callbacks: Callbacks) {
    super(editor, callbacks.onLogMessage);
    this._pluginControl = new PluginLoader(this, callbacks.onLogMessage);
  }

  public supportsCommand(name: string) { /* ... */ }
  public execCommand(name: string, ...args: unknown[]) { /* ... */ }
  public registerCommand(name: string, command: EditorUserCommand) { /* ... */ }
  public undo() { /* ... */ }
  public redo() { /* ... */ }
  public insertText(text: string) { /* ... */ }
  public select(start: number, end: number) { /* ... */ }
  public jumpToHash(hash: string) { /* ... */ }
  // ...
}
```

这个类是**桌面端和移动端调用编辑器的统一入口**，内部把命令名映射到：

- `editorCommands/` 里的 Joplin 自定义命令（toggleBold、insertLineAfter 等）
- 通过 `CodeMirror5Emulation` 父类兼容的 CM5 命令
- 用户通过 plugin 注册的自定义命令

### 6.4 Markdown Live Preview 装饰扩展

Live Preview 是 Obsidian/Joplin 那种"所见即所得"效果的核心。实现在 [`packages/editor/CodeMirror/extensions/markdownDecorationExtension.ts`](../../../joplin/packages/editor/CodeMirror/extensions/markdownDecorationExtension.ts)。

**核心机制**：

```typescript
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';

// 定义一系列装饰
const header1LineDecoration = Decoration.line({
  attributes: { class: 'cm-h1 cm-headerLine cm-header' },
});

const codeBlockDecoration = Decoration.line({
  attributes: { class: 'cm-codeBlock', spellcheck: 'false' },
});

const urlDecoration = Decoration.mark({
  attributes: { class: 'cm-url', spellcheck: 'false' },
});

// ViewPlugin：遍历语法树，根据节点类型加装饰
const decorationPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const tree = ensureSyntaxTree(view.state, view.viewport.to, 100);

    tree?.iterate({
      from: view.viewport.from,
      to: view.viewport.to,
      enter: (node) => {
        // 根据节点类型分发到对应装饰
        if (node.name === 'ATXHeading1') builder.add(..., header1LineDecoration);
        else if (node.name === 'FencedCode') builder.add(..., codeBlockDecoration);
        else if (node.name === 'URL') builder.add(..., urlDecoration);
        // ...
      },
    });

    return builder.finish();
  }
}, { decorations: v => v.decorations });
```

**重点**：它**不是** fork 了一个新的 Markdown 解析器，而是用**装饰层 + CSS**在 CM6 标准体系里实现所见即所得。外层 CSS 负责把 Markdown 标记字符（`##`、`**`、`` ` ``）隐藏或淡化，把被标记的内容样式化。这是最干净、最可维护的路线。

### 6.5 扩展目录全貌

[`packages/editor/CodeMirror/extensions/`](../../../joplin/packages/editor/CodeMirror/extensions/) 下的扩展一览：

| 扩展 | 作用 |
|---|---|
| `markdownDecorationExtension.ts` | **Live Preview 装饰核心** |
| `markdownHighlightExtension.ts` | Markdown 语法高亮 |
| `markdownMathExtension.ts` | KaTeX 数学公式内联渲染 |
| `markdownFrontMatterExtension.ts` | YAML frontmatter 支持 |
| `searchExtension.ts` | 搜索面板 |
| `biDirectionalTextExtension.ts` | BiDi 文本（阿拉伯语等） |
| `overwriteModeExtension.ts` | 覆盖模式 |
| `highlightActiveLineExtension.ts` | 当前行高亮 |
| `modifierKeyCssExtension.ts` | Ctrl/Cmd 按下时的 CSS 状态 |
| `ctrlClickActionExtension.ts` | Ctrl+点击的链接行为 |
| `ctrlClickCheckboxExtension.ts` | Ctrl+点击 checkbox |
| `editorSettingsExtension.ts` | 设置变化响应 |
| `selectedNoteIdExtension.ts` | 当前 note ID 注入 |
| `keyUpHandlerExtension.ts` | 按键事件 |
| `rendering/` | Image / code 的块级渲染（widget） |
| `links/` | 链接相关扩展 |

SwarmNote 初期可以只移植最核心的 3-5 个：`markdownDecoration` + `markdownHighlight` + `searchExtension` + `editorSettingsExtension`。其他按需加。

---

## 7. 移动端 WebView 集成的五个关键模式

Joplin 的移动端 bundle 层位于 [`packages/app-mobile/contentScripts/markdownEditorBundle/`](../../../joplin/packages/app-mobile/contentScripts/markdownEditorBundle/)，只有 4 个文件：

```text
contentScripts/markdownEditorBundle/
├── contentScript.ts       (133 行)  WebView 端入口
├── useWebViewSetup.ts     (202 行)  RN 侧 hook
├── types.ts               ( 42 行)  双向 API 类型
└── utils/useCodeMirrorPlugins.ts
```

加上 `components/NoteEditor/MarkdownEditor.tsx` 作为 React 组件包装。整个移动端 CM6 集成加起来不到 600 行代码。

### 模式 1：contentScript.ts 入口

[`contentScript.ts`](../../../joplin/packages/app-mobile/contentScripts/markdownEditorBundle/contentScript.ts)：

```typescript
import { createEditor } from '@joplin/editor/CodeMirror';
import WebViewToRNMessenger from '../../utils/ipc/WebViewToRNMessenger';
import { EditorProcessApi, EditorProps, MainProcessApi } from './types';

let mainEditor: EditorControl | null = null;

// 1. 建立和 RN 侧的双向 RPC
const messenger = new WebViewToRNMessenger<EditorProcessApi, MainProcessApi>(
  'markdownEditor',
  {
    get mainEditor() { return mainEditor; },
    updateSettings(settings) { mainEditor?.updateSettings(settings); },
    // ... WebView 侧暴露给 RN 的方法
  }
);

// 2. 定义创建编辑器的全局函数
export const createMainEditor = (props: EditorProps) => {
  const parent = document.getElementsByClassName(
    props.parentElementOrClassName,
  )[0] as HTMLElement;

  mainEditor = createEditor(parent, {
    initialText: props.initialText,
    settings: props.settings,
    // 事件回调通过 messenger 发给 RN
    onEvent: (event) => { messenger.remoteApi.onEditorEvent(event); },
    onPasteFile: async (data) => { /* 走 messenger 送回 RN 处理 */ },
    onLogMessage: (msg) => { messenger.remoteApi.logMessage(msg); },
    resolveImageSrc: async (src, counter) => {
      return messenger.remoteApi.onResolveImageSrc(src, counter);
    },
  });

  return mainEditor;
};

// 3. 注册到 window，让 RN 能通过 injectJS 调用
window.createMainEditor = createMainEditor;
```

**精髓**：contentScript.ts 自己**不做任何业务逻辑**。编辑器实例化、事件发射、资源解析全部通过 messenger 异步转发给 RN 侧。这个文件的唯一作用是"把 `@joplin/editor/CodeMirror` 封装成一个可以通过 RPC 控制的远端对象"。

### 模式 2：useWebViewSetup 两次注入 JS

[`useWebViewSetup.ts`](../../../joplin/packages/app-mobile/contentScripts/markdownEditorBundle/useWebViewSetup.ts) 核心逻辑：

```typescript
const useWebViewSetup = ({ editorOptions, webviewRef, ... }): Result => {

  // 【第一次注入】加载 bundle 代码（只做一次）
  const injectedJavaScript = useMemo(() => `
    if (typeof window.markdownEditorBundle === 'undefined') {
      ${shim.injectedJs('markdownEditorBundle')};  // 打包好的 IIFE 字符串
      window.markdownEditorBundle = markdownEditorBundle;
      markdownEditorBundle.setUpLogger();
    }
  `, []);

  // 【第二次注入】在 WebView 加载完成后创建编辑器实例
  const afterLoadFinishedJs = useRef((): string => '');
  afterLoadFinishedJs.current = () => `
    if (!window.cm) {
      window.cm = markdownEditorBundle.createMainEditor(${JSON.stringify(editorOptions)});
      window.onresize = () => { cm.execCommand('scrollSelectionIntoView'); };
    }
  `;

  // 建立 RN 侧 messenger
  const editorMessenger = useMemo(() => {
    const localApi: MainProcessApi = {
      async onEditorEvent(event) { onEditorEventRef.current(event); },
      async onResolveImageSrc(src, reloadCounter) { /* 查本地资源 */ },
      async logMessage(msg) { logger.debug('CodeMirror:', msg); },
      // ...
    };
    return new RNToWebViewMessenger<MainProcessApi, EditorProcessApi>(
      'markdownEditor', webviewRef, localApi,
    );
  }, [webviewRef]);

  return {
    pageSetup: { js: injectedJavaScript, css: '' },
    api: editorMessenger.remoteApi,  // ← 外部通过这个调编辑器命令
    webViewEventHandlers: {
      onLoadEnd: () => {
        webviewRef.current?.injectJS(afterLoadFinishedJs.current());
        editorMessenger.onWebViewLoaded();
      },
      onMessage: (event) => editorMessenger.onWebViewMessage(event),
    },
  };
};
```

**两次注入的巧思**：

1. 第一次（`injectedJavaScript`，WebView 加载时注入）：把打包好的 bundle **代码本身**塞进 WebView，定义 `window.markdownEditorBundle` 全局
2. 第二次（`afterLoadFinishedJs`，`onLoadEnd` 时注入）：调用刚注入的 bundle 里的 `createMainEditor(...)` 函数，把 editorOptions 序列化成 JSON 字符串传进去

这样做的好处：**editorOptions 可以动态变化**（比如更换文档、切换主题），不需要重新加载 WebView。

### 模式 3：类型安全的双向 RPC 契约

[`types.ts`](../../../joplin/packages/app-mobile/contentScripts/markdownEditorBundle/types.ts)：

```typescript
// WebView 端暴露给 RN 调用的 API
export interface EditorProcessApi {
  mainEditor: EditorControl;  // getter
  updateSettings: (settings: EditorSettings) => void;
  updatePlugins: (contentScripts: ContentScriptData[]) => void;
}

// RN 端暴露给 WebView 调用的 API
export interface MainProcessApi {
  onLocalize(text: string): LocalizationResult;
  onEditorEvent(event: EditorEvent): Promise<void>;
  onEditorAdded(): Promise<void>;
  logMessage(message: string): Promise<void>;
  onPasteFile(type: string, dataBase64: string): Promise<void>;
  onResolveImageSrc(src: string, reloadCounter: number): Promise<string | null>;
}
```

**两个 interface 构成双向 API 契约**，messenger 的泛型参数把它们绑定起来，**两端都有类型检查**。一端修改 API 签名，另一端编译就会报错。

### 模式 4：RemoteMessenger 双向 RPC 实现

[`RNToWebViewMessenger.ts`](../../../joplin/packages/app-mobile/utils/ipc/RNToWebViewMessenger.ts)：

```typescript
import RemoteMessenger from '@joplin/lib/utils/ipc/RemoteMessenger';

export default class RNToWebViewMessenger<LocalInterface, RemoteInterface>
  extends RemoteMessenger<LocalInterface, RemoteInterface> {

  public constructor(
    channelId: string,
    private webviewControl: WebViewControl | RefObject<WebViewControl>,
    localApi: LocalInterface,
  ) {
    super(channelId, localApi);
  }

  protected override postMessage(message: SerializableData): void {
    const webview = (this.webviewControl as RefObject<WebViewControl>).current
      ?? (this.webviewControl as WebViewControl);
    if (!webview?.injectJS) return;

    // RN: 用 injectJS 发送到 WebView
    webview.injectJS(`
      window.dispatchEvent(
        new MessageEvent('message', {
          data: ${JSON.stringify(message)},
          origin: 'react-native',
        }),
      );
    `);
  }

  public onWebViewMessage = (event: OnMessageEvent) => {
    if (!this.hasBeenClosed()) {
      void this.onMessage(JSON.parse(event.nativeEvent.data));
    }
  };
}
```

底层的 `RemoteMessenger` 基类（在 `@joplin/lib/utils/ipc/RemoteMessenger`）实现了"远端 proxy"模式——你调用 `messenger.remoteApi.foo(x)` 会自动序列化成一条消息发过去，远端 localApi 的 `foo` 方法执行后结果回传成 Promise。

**这就是类型安全的 async RPC over postMessage/injectJS**。

> 💡 **SwarmNote 推荐用 [Comlink](https://github.com/GoogleChromeLabs/comlink) 替代自写 RemoteMessenger**
>
> Joplin 的 `RemoteMessenger` 是 AGPLv3 代码，不能直接抄到 SwarmNote（MIT）。幸好 Google Chrome Labs 出的 [Comlink](https://github.com/GoogleChromeLabs/comlink)（**Apache 2.0**，与 MIT 兼容）做的事情**完全相同** —— 把 postMessage 包装成类型安全的 async RPC，自带 TypeScript 类型推导：
>
> ```ts
> // WebView 侧 (contentScript.ts)
> import * as Comlink from 'comlink';
>
> const editorApi: EditorProcessApi = {
>   async createMainEditor(opts) { /* ... */ },
>   async applyYjsUpdate(update) { /* ... */ },
>   async setSettings(settings) { /* ... */ },
> };
> Comlink.expose(editorApi);
>
> // RN 侧 (useWebViewSetup.ts)
> const remoteEditor = Comlink.wrap<EditorProcessApi>(webviewEndpoint);
> await remoteEditor.createMainEditor({ initialText, settings });
> // ↑ 类型安全、async、自动序列化
> ```
>
> Comlink 的优势：
>
> - **license 兼容**（Apache 2.0 → MIT 项目可用）
> - **维护活跃**（Google Chrome Labs 出品，Web Worker 生态广泛使用）
> - **代码更少**（比 Joplin 的 `RemoteMessenger` + 子类 + types 三层结构简单一半）
> - **TypeScript 类型推导更好**（直接用 interface，不需要泛型样板）
> - 唯一需要自己写的：`Comlink.windowEndpoint` 在 RN WebView 环境下的适配层（把 `injectedJavaScript` + `onMessage` 包装成 `MessageEventTarget`），约 30-50 行代码
>
> 这一个发现就完整替换掉了 Joplin 移动端 IPC 层的所有代码，**同时彻底规避了这一块的 license 问题**。

### 模式 5：MarkdownEditor.tsx 的 HTML 宿主

[`MarkdownEditor.tsx`](../../../joplin/packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx)：

```tsx
function useHtml(): string {
  return useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <title>${_('Note editor')}</title>
        <style>
          /* 滚动体验 */
          .cm-scroller { overflow: none; }
        </style>
      </head>
      <body>
        <div class="CodeMirror" style="height:100%;" autocapitalize="on"></div>
      </body>
    </html>
  `, []);
}

const MarkdownEditor: React.FC<EditorProps> = (props) => {
  const editorWebViewSetup = useWebViewSetup({
    editorOptions: {
      parentElementOrClassName: 'CodeMirror',
      initialText: props.initialText,
      initialNoteId: props.noteId,
      settings: props.editorSettings,
    },
    webviewRef: props.webviewRef,
    // ...
  });

  props.editorRef.current = editorWebViewSetup.api.mainEditor;

  return (
    <ExtendedWebView
      ref={props.webviewRef}
      html={useHtml()}
      injectedJavaScript={editorWebViewSetup.pageSetup.js}
      css={useCss(props.themeId)}
      onMessage={editorWebViewSetup.webViewEventHandlers.onMessage}
      onLoadEnd={editorWebViewSetup.webViewEventHandlers.onLoadEnd}
    />
  );
};
```

**HTML 超级简单**：只有一个 `<div class="CodeMirror">` 作为挂载点。所有样式、事件、命令都走 messenger。

---

## 8. 关键坑：Android IME 与 EditContext API

这是 Joplin 踩坑后留下的一行救命代码，在 [`createEditor.ts:45-53`](../../../joplin/packages/editor/CodeMirror/createEditor.ts#L45)：

```typescript
// Newer versions of CodeMirror by default use Chrome's EditContext API.
// While this might be stable enough for desktop use, it causes significant
// problems on Android:
// - https://github.com/codemirror/dev/issues/1450
// - https://github.com/codemirror/dev/issues/1451
// For now, CodeMirror allows disabling EditContext to work around these issues:
// https://discuss.codemirror.net/t/experimental-support-for-editcontext/8144/3
type ExtendedEditorView = typeof EditorView & { EDIT_CONTEXT: boolean };
(EditorView as ExtendedEditorView).EDIT_CONTEXT = false;
```

**背景**：CM6 的较新版本默认启用 Chrome 的 EditContext API，在桌面端工作良好，但在 Android WebView 上会导致严重的 IME 问题（中文输入会崩、丢字、composition 状态错乱）。

**结论**：这一行代码必须原样抄到 SwarmNote 的 `createEditor.ts` 里。**不要试图去掉它去搞什么"先验证一下再说"**——Joplin 团队已经验证过了，在 Android 上不禁用 EditContext 就是坏的。

---

## 9. SwarmNote 的特殊需求：yjs 实时协作

Joplin 没有 CRDT 实时协作，这是 SwarmNote 需要在 Joplin 架构之上额外补的一块。

### 9.1 在 createEditor 里加 yCollab 扩展

```typescript
// @swarmnote/editor/src/createEditor.ts（SwarmNote 版）
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

interface EditorProps {
  // ... Joplin 原有的 props
  yjsCollab?: {
    ydoc: Y.Doc;
    fragmentName?: string;  // 默认 'document'
    awareness?: Awareness;  // 可选，用于多人光标
  };
}

const createEditor = (parent: HTMLElement, props: EditorProps) => {
  // 🔑 必须保留 Joplin 的 Android IME workaround
  (EditorView as ExtendedEditorView).EDIT_CONTEXT = false;

  const extensions = [
    // ... Joplin 原有的所有扩展
  ];

  // 🆕 SwarmNote 新增:yjs 协作扩展
  if (props.yjsCollab) {
    const { ydoc, fragmentName = 'document', awareness } = props.yjsCollab;
    const ytext = ydoc.getText(fragmentName);
    extensions.push(yCollab(ytext, awareness ?? null));
  }

  const view = new EditorView({
    state: EditorState.create({
      doc: props.yjsCollab?.ydoc.getText(props.yjsCollab.fragmentName ?? 'document').toString()
           ?? props.initialText,
      extensions,
    }),
    parent,
  });

  return new CodeMirrorControl(view, callbacks);
};
```

**`y-codemirror.next` 自动处理**：

- 拦截 CM6 的 `ChangeSet` → 翻译成 `Y.Text` 操作
- 监听 `Y.Text` 远端更新 → apply 到 CM6（光标位置自动保持）
- 处理 undo/redo（和 yjs 的 `UndoManager` 协作）

**这就是字符级 CRDT 的开箱即用体验**。

### 9.2 双端 yjs 数据流

```text
┌─ 桌面端 ────────────────────────────┐
│                                      │
│  @swarmnote/editor (CM6)             │
│    ↕ y-codemirror.next               │
│  Y.Doc (browser JS yjs)              │
│    ↕ TauriYjsProvider                │
│  Rust 侧 yrs (yjs_state SQLite)      │
│    ↕ libp2p                          │
└────┬─────────────────────────────────┘
     │
     │ P2P yjs update broadcast
     │
┌────┴─────────────────────────────────┐
│  移动端                               │
│                                      │
│  @swarmnote/editor (CM6 in WebView)  │
│    ↕ y-codemirror.next               │
│  Y.Doc (WebView JS yjs)              │
│    ↕ RNYjsProvider (Messenger)       │
│  Rust 侧 yrs (via uniffi)            │
│    ↕ libp2p                          │
└──────────────────────────────────────┘
```

- 双端都有本地 yjs，都通过 y-codemirror.next 和 CM6 绑定
- 双端通过各自的 Provider（桌面 Tauri invoke，移动 uniffi）和 Rust 侧 yrs 同步
- Rust 侧通过 libp2p 跨设备广播 yjs update
- **因为两端都是同一套 yjs schema（单个 Y.Text）**，update 可以直接互传，实现字符级 CRDT 合并

### 9.3 yrs-blocknote crate 的未来

迁移完成后，`crates/yrs-blocknote` 的作用大幅萎缩：

- **不再需要**：BlockNote XML schema ↔ Block IR 的编解码
- **可能保留**：Markdown ↔ Block IR 的解析（用于旧文档数据迁移）
- **可能替换**：直接用 `yrs` 原生 API 操作 `Y.Text`（因为整篇文档就是一个 Y.Text）

建议在迁移阶段**保留 yrs-blocknote 作为数据迁移工具**（旧 BlockNote 文档 → Markdown → 新 YText），迁移完成后可以整个删掉或者重命名为 `yrs-markdown` 作为通用 Markdown ↔ Y.Text 工具。

---

## 10. 分阶段迁移计划

整个迁移分为 6 个阶段，每一阶段都能**独立跑起来、独立验证**，避免"做了一半全都不能跑"的死局。

### 🟢 阶段 0：准备与验证

**目的**：不写代码，先把关键前提确认清楚。

- [ ] 检查 Joplin 的 LICENSE（整个仓库）。**Joplin 是 AGPLv3**，直接复制代码会产生许可兼容问题
- [ ] 检查 SwarmNote 当前的 LICENSE
- [ ] 决定是"clean room 参考 + 独立实现"还是"直接 AGPL fork"
- [ ] 在真机上跑 Joplin mobile，感受 Android 中文输入和 iOS 选区体验，建立 UX 基线
- [ ] 在 swarmnote-mobile 里建一个最小 POC：直接用 `@codemirror/view` + `@codemirror/lang-markdown` + `react-native-webview`，不参考 Joplin 代码，验证"CM6 能在 RN WebView 里跑、中文能输入、键盘能处理"

**产出**：对可行性的直接一手证据，以及 license 方案的决定。

### 🟢 阶段 1：建立 `@swarmnote/editor` 共享包

**目的**：创建和 `@joplin/editor` 等价的平台无关 CM6 封装包。

**位置**（建议）：在 `swarmnote` 主仓库下新建 `packages/editor/`（需要把现有 `swarmnote/` 转成 workspace）。

**内容**：

```text
packages/editor/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # 公开 API: createEditor, EditorControl
│   ├── createEditor.ts          # 抄 Joplin 的 createEditor.ts（包含 EDIT_CONTEXT workaround）
│   ├── EditorControl.ts         # 抄 Joplin 的 CodeMirrorControl.ts（可裁剪）
│   ├── extensions/
│   │   ├── markdownDecoration.ts    # Live Preview 核心,抄 Joplin
│   │   ├── markdownHighlight.ts
│   │   ├── markdownMath.ts          # 可选,KaTeX
│   │   ├── searchExtension.ts
│   │   └── yjsCollab.ts             # 🆕 SwarmNote 新增
│   ├── commands/
│   │   └── markdownCommands.ts      # toggleBold 等,抄 Joplin
│   ├── types.ts
│   └── events.ts
```

**关键决策点**：

- 是否把现有的 `yrs-blocknote` 先不动（仅作为数据迁移工具保留）
- 是否同时创建 `packages/editor-shared-types/` 存放 EditorControl、EditorEvent 等类型，供 Rust 侧 `ts-rs` 或 `uniffi` 生成时复用

**产出**：一个能 `pnpm build` 的 `@swarmnote/editor` 包，单元测试能跑。

### 🟢 阶段 2：移动端 WebView Bundle + RN 集成（不接 yjs）

**目的**：在 swarmnote-mobile 里建一个能跑的 CM6 WebView POC，暂不接 yjs，暂不接 Rust 后端，只验证"编辑器能在 RN WebView 里跑起来、能输入、能保存到 AsyncStorage"。

**新建目录结构**（照抄 Joplin）：

```text
swarmnote-mobile/
├── editor-web/                    # 🆕 独立的 WebView bundle 项目
│   ├── package.json
│   ├── esbuild.config.mjs
│   ├── src/
│   │   ├── contentScript.ts       # WebView 内入口(抄 Joplin)
│   │   └── types.ts               # 双向 API 类型
│   └── dist/
│       └── markdownEditorBundle.js  # IIFE 打包产物
├── src/
│   ├── editor-bundle/             # 🆕 RN 侧 WebView 胶水层
│   │   ├── useWebViewSetup.ts     # 抄 Joplin
│   │   └── messenger/
│   │       ├── RemoteMessenger.ts
│   │       └── RNToWebViewMessenger.ts
│   ├── components/
│   │   └── MarkdownEditor.tsx     # 抄 Joplin
│   └── app/
│       └── (tabs)/editor-test.tsx # 测试页面
```

**构建链**：

1. `editor-web` 用 esbuild 把 `contentScript.ts` + 依赖的 CM6 打包成一个 IIFE 字符串
2. 构建输出 `dist/markdownEditorBundle.js`
3. 运行时 RN 侧读取 bundle 字符串，通过 `injectedJavaScript` 注入 WebView
4. Bundle 字符串的加载方式：
   - 简单方案：放到 `assets/`，用 `expo-asset` 读成字符串
   - 更优方案：构建时生成 `bundles.generated.ts`，export 为字符串常量

**要回答的问题**：

- ✅ CM6 能在 WebView 里初始化吗？
- ✅ 中文 IME 能用吗？（加上 `EDIT_CONTEXT = false`）
- ✅ 虚拟键盘遮挡能处理吗？
- ✅ 选区、复制粘贴在 iOS / Android 正常吗？
- ✅ 文本 round-trip 正确吗？

**产出**：一个能在手机上编辑 Markdown 并保存到本地 AsyncStorage 的 demo。

### 🟡 阶段 3：移动端接入 y-codemirror.next + 本地 yjs

**目的**：在 RN WebView 里跑一个本地的 Y.Doc，让 CM6 和 Y.Text 双向绑定，字符级 CRDT 在单设备上工作。

**做什么**：

1. 在 `editor-web/` 的依赖里加 `yjs` + `y-codemirror.next` + `y-protocols`
2. 修改 `contentScript.ts` 的 `createMainEditor`：

   ```typescript
   import * as Y from 'yjs';
   import { yCollab } from 'y-codemirror.next';
   import { Awareness } from 'y-protocols/awareness';

   const ydoc = new Y.Doc();
   const ytext = ydoc.getText('document');
   const awareness = new Awareness(ydoc);

   const control = createEditor(parentElement, {
     ...opts,
     yjsCollab: { ydoc, ytext, awareness },
   });

   // 把 ydoc 挂到 window 上,供外部注入 update 用
   window.ydoc = ydoc;
   ```

3. 新增 Messenger 方法：
   - `applyYjsUpdate(update: Uint8Array)` —— RN → WebView，应用远端 update
   - `onYjsUpdate(update: Uint8Array)` —— WebView → RN，广播本地产生的 update

4. 在 Y.Doc 上订阅 `ydoc.on('update', ...)`，把 update 通过 messenger 发给 RN

**要回答的问题**：

- ✅ CM6 + y-codemirror.next 在 WebView 里跑得动吗？
- ✅ 打字时能产生 yjs update 吗？
- ✅ 把 update 送回 WebView 能正确合并吗？（模拟远端）
- ✅ 大文档性能如何？（yjs JS 库在 WebView 里的表现）

**产出**：两个 WebView 自己和自己 sync 的 demo（测试 update 互相广播合并）。

### 🟡 阶段 4：桌面端迁移到 CM6

**目的**：在 `swarmnote/` 桌面端把 BlockNote 换掉，改用 `@swarmnote/editor`。

**做什么**：

1. 桌面端 `NoteEditor.tsx` 删掉 BlockNote 相关代码
2. 改成：

   ```tsx
   import { createEditor } from '@swarmnote/editor';
   import * as Y from 'yjs';

   const NoteEditor: FC = () => {
     const editorRef = useRef<HTMLDivElement>(null);
     const [ydoc] = useState(() => new Y.Doc());

     useEffect(() => {
       if (!editorRef.current) return;

       // 从 Rust 后端加载初始 yjs binary
       loadInitialYjsState(ydoc);

       const control = createEditor(editorRef.current, {
         initialText: '',
         yjsCollab: { ydoc, fragmentName: 'document' },
         onEvent: handleEditorEvent,
         settings: editorSettings,
       });

       return () => control.remove();
     }, []);

     return <div ref={editorRef} className="editor-host" />;
   };
   ```

3. 保留现有的 `TauriYjsProvider` 逻辑，只是操作的 Y.Doc 是**单 Y.Text**而不是 BlockNote XML fragment

4. **数据迁移脚本**：
   - 现有 DB 里的 `yjs_state` 是 BlockNote schema 的，不能直接用
   - 写一次性迁移：用 `yrs_blocknote::doc_to_markdown()` 把旧 Y.Doc 转成 Markdown → 新的 Y.Doc（YText）装回去 → 覆盖 yjs_state
   - CRDT 历史会被重置（可接受，格式升级）

**要回答的问题**：

- ✅ 桌面端能正常编辑、保存、渲染 Markdown 吗？
- ✅ 所有旧文档能成功迁移吗？
- ✅ 自定义 image block 如何用 CM6 widget 重新实现？（工作量大头）

**产出**：桌面端切到 CM6，旧文档无损迁移，视觉体验接近 Obsidian Live Preview。

### 🟠 阶段 5：移动端接 Rust 后端（uniffi）

**目的**：用 `uniffi-bindgen-react-native` 把 Rust 的 yjs + P2P + 持久化暴露给 RN，让移动端编辑能真正在 P2P 网络里同步。

**做什么**：

1. 在桌面端 Rust 侧 `app-core` 新增 uniffi 导出的 API：

   ```rust
   #[uniffi::export]
   impl DocumentManager {
       pub fn load_doc(&self, id: String) -> Vec<u8>;  // 返回 yjs binary
       pub fn apply_local_update(&self, id: String, update: Vec<u8>) -> Result<()>;
       pub fn subscribe(&self, id: String, observer: Arc<dyn UpdateObserver>);
   }

   #[uniffi::export(callback_interface)]
   pub trait UpdateObserver: Send + Sync {
       fn on_remote_update(&self, doc_id: String, update: Vec<u8>);
   }
   ```

2. RN 侧在 `useWebViewSetup` 的 `localApi` 里实现：
   - `onLocalUpdate(update)` → 转发到 Rust: `documentManager.applyLocalUpdate(...)`
   - Rust 订阅回调 → 转发到 WebView: `messenger.remoteApi.applyYjsUpdate(update)`

**产出**：完整端到端的"移动端编辑 → 本地 yjs → Rust → P2P → 桌面端"协作链路。

### 🟠 阶段 6：移动端 UX polish

集中处理 Joplin 已经解决过的所有移动端细节：

- [ ] 虚拟键盘遮挡（Joplin 的方案）
- [ ] iOS 长按选区气泡
- [ ] 格式化工具栏（键盘上方浮动，原生 RN 组件实现）
- [ ] 滚动保持、回到光标
- [ ] 粘贴文件 / 粘贴图片处理
- [ ] 暗色主题切换
- [ ] 搜索面板

---

## 11. 需要立即决策的问题

在开始阶段 0 之前，以下问题需要先有答案：

### Q1：License 问题(已决策:选项 C)

**事实核对**：

- **SwarmNote 当前实际没有 LICENSE 文件**(无论桌面还是移动端),`package.json` 也没有 `"license"` 字段。在法律上属于"无许可"状态(默认 all rights reserved)。需要在正式发布前补一份 MIT LICENSE。
- **Joplin 是 AGPL-3.0-or-later**(根仓库 LICENSE 明确声明),`@joplin/editor` 和 `app-mobile/contentScripts/markdownEditorBundle/` 子目录**没有**单独的 LICENSE 文件,所以都继承默认 AGPLv3。

**License 冲突的本质**:AGPLv3 是强 copyleft,SwarmNote 作为 MIT 项目**不能复制任何一行 Joplin 代码**(包括"改了变量名"的代码)。否则:

1. SwarmNote 整体被强制变成 AGPLv3
2. 任何用 SwarmNote 搭建的网络服务必须公开源码给所有用户
3. SwarmNote 永远不能再变回 MIT(AGPL 是 one-way)
4. 和你已有的 MIT 生态(swarmbook、swarm-p2p、swarmdrop 等)产生 license 不一致

**三个选项**:

- **A**:SwarmNote 改成 AGPL,直接 copy Joplin 代码。最快但破坏整个 swarm* 生态的 license 一致性
- **B**:严格 clean room 重写(只看文档不看代码)。对个人项目过于严格,不可行
- **C**:架构参考 + MIT 兼容代码起点。读 Joplin 源码理解架构,但具体代码从 MIT 兼容来源起步,不复制 Joplin 代码

**决策:选项 C**。SwarmNote 保持 MIT,通过以下三个原则保证 license 干净:

1. **可以做的**:读 Joplin 代码理解架构、模仿设计模式、使用相同的 API shape 和命名(架构和 API 不受 copyright 保护)
2. **不能做的**:复制任何 Joplin 源文件中的代码、逐行翻译、复制注释
3. **代码从 MIT 兼容来源起步**:使用下面表格中列出的所有替代品

**MIT 兼容的代码起点清单**:

| Joplin 部件 | MIT/Apache 兼容替代 | License | 备注 |
| --- | --- | --- | --- |
| `createEditor.ts` 主入口 | [CodeMirror 6 官方 examples](https://codemirror.net/examples/) | MIT | 直接照官方教程 |
| Markdown Live Preview 装饰 | [simple-markdown-editor](https://github.com/CTRL-Neo-Studios/simple-markdown-editor) | 待确认(需 audit) | 明确以"复刻 Obsidian Live Preview"为目标 |
| Lezer Markdown 解析 | [@lezer/markdown](https://github.com/lezer-parser/markdown) | MIT | CM6 标配 |
| Obsidian flavored Markdown 解析 | [lezer-markdown-obsidian](https://github.com/erykwalder/lezer-markdown-obsidian) | MIT | wikilinks / embeds / frontmatter 等 |
| yjs ↔ CM6 绑定 | [y-codemirror.next](https://github.com/yjs/y-codemirror.next) | MIT | yjs 作者维护,即插即用 |
| `RemoteMessenger` IPC 层 | **[Comlink](https://github.com/GoogleChromeLabs/comlink)** | **Apache 2.0** | **Google 出品,完全替代 Joplin 的 RemoteMessenger,见第 7 章模式 4 的 callout** |
| React + CM6 集成 | [@uiw/react-codemirror](https://github.com/uiwjs/react-codemirror) | MIT | 1.8M+ 周下载 |
| 基础命令(toggleBold 等) | [@codemirror/commands](https://github.com/codemirror/commands) | MIT | CM6 官方包,有现成实现 |
| Android IME workaround | [CodeMirror discuss 论坛原帖](https://discuss.codemirror.net/t/experimental-support-for-editcontext/8144/3) | 公开技术信息 | Joplin 注释里也是引用这个公开帖子 |
| `<div>` HTML 宿主 | (太基础,自己写) | n/a | 一行 HTML |
| 双端共享包结构 | (架构思想,自由借鉴) | n/a | 不受 copyright 保护 |

**核心发现:Comlink 替代 Joplin 整套 IPC 层**

Joplin 的 `RemoteMessenger` + `RNToWebViewMessenger` + `WebViewToRNMessenger` 三层结构(约 300-400 行代码)是 SwarmNote 之前最担心的"license 不能抄又不好自己写"的部分。但 Google Chrome Labs 出的 [Comlink](https://github.com/GoogleChromeLabs/comlink) 完全替代了这一整层:

- 同样的 async RPC 模型
- 同样的类型安全
- Apache 2.0 license,与 MIT 完全兼容
- SwarmNote 只需要写一个约 30-50 行的"WebView endpoint adapter",把 `injectedJavaScript` + `onMessage` 包装成 Comlink 期望的 `MessageEventTarget` 接口

**这一个发现就把"参考 Joplin 但保持 MIT"从"理论可行但麻烦"变成了"工程上 straightforward"**。

**工程纪律(执行 C 时务必遵守)**:

1. **物理分离**:在写 SwarmNote 代码时**关掉 Joplin 源码的 tab**,只打开 CM6 官方文档、Comlink 文档、其他 MIT 参考项目
2. **不剪贴板接**:如果一定要查 Joplin 实现,**只读不复制**,理解后凭记忆写
3. **注释标注来源**:在每个关键设计点的注释里写明灵感来源,例如:

   ```ts
   // Android WebView 上 EditContext API 会破坏 IME,需要禁用
   // 公开 issue: https://github.com/codemirror/dev/issues/1450
   // 解决方案讨论: https://discuss.codemirror.net/t/experimental-support-for-editcontext/8144/3
   (EditorView as any).EDIT_CONTEXT = false;
   ```

4. **避免相似度风险点**:对于"很像 Joplin 但又不是直接抄的"代码片段,主动做不一样的设计选择(比如 Comlink 的 API 形状本来就和 Joplin 的 RemoteMessenger 不同,自然就避开了)
5. **Audit 时能说清楚**:每一段代码都能指出"它的灵感来源是 X(MIT 兼容)",而不是"我从 Joplin 借鉴的"

**预计工作量影响**:相比"直接抄 Joplin",选项 C 大概多 3-5 天工作量(主要在自己写 IPC adapter 和 Markdown 装饰扩展上)。换来的是 SwarmNote 永久的 license 自由。

### Q2：桌面端的自定义 React block 迁移

BlockNote 的 `CustomReactImageBlock` / `CustomReactVideoBlock` 是 React 组件，CM6 的 widget decoration 只能用 DOM API。迁移成本：

- 轻量：CM6 Widget 直接用 `<img>` / `<video>` 标签
- 重量：要支持编辑操作（改大小、加 caption 等）需要自己管理 DOM 事件

**建议**：Phase 1 先只支持只读渲染，Phase 2 再补交互。

### Q3：Markdown 方言

SwarmNote 保持什么 Markdown 方言？

- **GFM**（GitHub Flavored Markdown）—— 最稳妥，和 `yrs-blocknote` 现在的选择一致
- **CommonMark** —— 最简单
- **Obsidian Flavored**（frontmatter、wikilinks、embeds、callouts）—— 最功能丰富，但需要自己实现

**建议**：Phase 1 先支持 GFM，未来按需加 Obsidian 特性（用 `lezer-markdown-obsidian` 作为参考）。

### Q4：monorepo 改造

SwarmNote 桌面端当前是单一项目，不是 monorepo。要做 `@swarmnote/editor` 共享包需要转成 workspace。影响：

- package.json 要改
- 现有的 `pnpm install` / `pnpm build` 脚本要改
- tsconfig 要重新组织

**建议**：做好心理准备，这是一次小型的项目结构重构。

---

## 12. 参考资料

### Joplin 源码（本地）

- [`packages/editor/`](../../../joplin/packages/editor/) — `@joplin/editor` 共享包
- [`packages/editor/CodeMirror/createEditor.ts`](../../../joplin/packages/editor/CodeMirror/createEditor.ts) — 主入口
- [`packages/editor/CodeMirror/CodeMirrorControl.ts`](../../../joplin/packages/editor/CodeMirror/CodeMirrorControl.ts) — 命令式 API
- [`packages/editor/CodeMirror/extensions/markdownDecorationExtension.ts`](../../../joplin/packages/editor/CodeMirror/extensions/markdownDecorationExtension.ts) — Live Preview 装饰核心
- [`packages/app-mobile/contentScripts/markdownEditorBundle/`](../../../joplin/packages/app-mobile/contentScripts/markdownEditorBundle/) — 移动端 bundle 层
- [`packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx`](../../../joplin/packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx) — RN 组件包装
- [`packages/app-mobile/utils/ipc/`](../../../joplin/packages/app-mobile/utils/ipc/) — Messenger 实现

### 相关开源项目

#### CodeMirror 生态(MIT)

- [CodeMirror 6 官方](https://codemirror.net/) — 编辑器核心,MIT
- [CodeMirror 6 examples](https://codemirror.net/examples/) — 官方教程,SwarmNote createEditor 的代码起点
- [@lezer/markdown](https://github.com/lezer-parser/markdown) — CM6 用的 Markdown AST 解析器,MIT
- [@uiw/react-codemirror](https://github.com/uiwjs/react-codemirror) — 事实标准的 CM6 React wrapper,MIT,1.8M+ 周下载
- [@codemirror/commands](https://github.com/codemirror/commands) — CM6 官方命令包(toggleBold 等)

#### yjs 生态(MIT)

- [y-codemirror.next](https://github.com/yjs/y-codemirror.next) — yjs 官方 CM6 绑定,作者 Kevin Jahns

#### IPC / RPC(Apache 2.0,MIT 兼容)

- **[Comlink](https://github.com/GoogleChromeLabs/comlink)** — Google Chrome Labs 出品的 postMessage RPC 库,**SwarmNote 用它替代 Joplin 的 RemoteMessenger 整层(见第 7 章模式 4)**

#### Markdown Live Preview 参考

- [HyperMD](https://github.com/laobubu/HyperMD) — Obsidian Live Preview 的灵感来源
- [simple-markdown-editor](https://github.com/CTRL-Neo-Studios/simple-markdown-editor) — 用 CM6 复刻 Obsidian 的开源项目(license 待 audit)
- [lezer-markdown-obsidian](https://github.com/erykwalder/lezer-markdown-obsidian) — Obsidian flavored Markdown 的 Lezer 解析器,MIT
- [Obsidian CodeMirror Options](https://github.com/nothingislost/obsidian-codemirror-options) — Obsidian Live Preview 的第三方实现

### 相关讨论

- [Obsidian 选择 CM6 的理由（官方论坛）](https://forum.obsidian.md/t/how-to-configure-codemirror-to-work-like-live-preview/43047)
- [Lexical React Native 现状](https://github.com/facebook/lexical/discussions/2410)
- [CodeMirror EditContext on Android 问题](https://github.com/codemirror/dev/issues/1450)

### SwarmNote 内部参考

- [CLAUDE.md](../../CLAUDE.md) — 项目整体指南
- [uniffi-bindgen-react-native 指南](./uniffi-bindgen-react-native-guide.md) — Rust 桥接层
- [dev-notes/rust-integration/](../rust-integration/) — Rust 集成文档

---

## 附录：迁移前后对比

| 维度 | 迁移前（BlockNote） | 迁移后（CM6） |
|---|---|---|
| **产品定位** | Notion 式 block 笔记 | Obsidian 式 Markdown 笔记 |
| **桌面编辑器** | `@blocknote/react` | `@swarmnote/editor` (CM6) |
| **移动编辑器** | ❌ 没有 | `@swarmnote/editor` in WebView |
| **数据模型** | BlockNote Block 树（XML schema） | Markdown 文本（单个 Y.Text） |
| **yjs schema** | `<blockGroup>/<blockContainer>/<paragraph>` XML | 单个 Y.Text |
| **Rust crate** | `yrs-blocknote`（400+ 行 XML 转换） | `yrs` 原生 API（`yrs-blocknote` 保留作数据迁移工具） |
| **block 拖拽重排** | ✅ | ❌ |
| **slash menu** | ✅ | ❌（可选自实现） |
| **自定义 React block** | ✅ | ❌（改用 CM6 widget） |
| **字符级 CRDT** | ✅ 桌面端 | ✅ **双端** |
| **双端代码复用率** | 0% | ~80%（`@swarmnote/editor` 共享） |
| **Markdown Live Preview** | ❌ | ✅ |
| **键盘流畅度（长文）** | 中等 | 高 |
| **移动端中文 IME** | 未验证 | ✅ Joplin 生产验证 |
