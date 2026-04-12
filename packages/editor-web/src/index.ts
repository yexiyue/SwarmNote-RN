import * as Comlink from 'comlink';
import * as Y from 'yjs';
import { createEditor, DEFAULT_SETTINGS } from '@swarmnote/editor';
import type { EditorControl } from '@swarmnote/editor';
import type { EditorApi, EditorInitOptions } from './types';

// WebView 侧的 Comlink endpoint:
// - postMessage → ReactNativeWebView.postMessage (发给 RN)
// - addEventListener('message') → 监听 RN 通过 injectJavaScript 发来的 MessageEvent
function createWebViewEndpoint(): Comlink.Endpoint {
  return {
    postMessage(msg: unknown) {
      const rn = (globalThis as unknown as { ReactNativeWebView?: { postMessage(s: string): void } }).ReactNativeWebView;
      if (rn) {
        rn.postMessage(JSON.stringify(msg));
      }
    },
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      globalThis.addEventListener(type, handler as EventListener);
    },
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      globalThis.removeEventListener(type, handler as EventListener);
    },
  };
}

let editor: EditorControl | null = null;
let ydoc: Y.Doc | null = null;

// HostApi: WebView → RN 的回调通道
// TODO: 后续用 Comlink 的反向 expose 实现,当前先用 postMessage 直接发
function notifyHost(method: string, ...args: unknown[]) {
  const rn = (globalThis as unknown as { ReactNativeWebView?: { postMessage(s: string): void } }).ReactNativeWebView;
  if (rn) {
    rn.postMessage(JSON.stringify({ type: 'hostCall', method, args }));
  }
}

const editorApi: EditorApi = {
  init(options: EditorInitOptions) {
    const parent = document.getElementById('editor-root');
    if (!parent) {
      throw new Error('Cannot find #editor-root element');
    }

    // 初始化 yjs（如果启用）
    if (options.enableYjs) {
      ydoc = new Y.Doc();

      // 监听本地 update → 发给 RN
      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') {
          notifyHost('onYjsUpdate', update);
        }
      });
    }

    editor = createEditor(parent, {
      initialText: options.initialText,
      settings: { ...DEFAULT_SETTINGS, ...options.settings },
      yjsCollab: ydoc ? { ydoc, fragmentName: 'document' } : undefined,
      onEvent(event) {
        if (event.kind === 'change') {
          notifyHost('onDocChange');
        }
        if (event.kind === 'focus' || event.kind === 'blur') {
          notifyHost('onFocusChange', event.kind === 'focus');
        }
      },
    });
  },

  getText() {
    if (!editor) throw new Error('Editor not initialized');
    return editor.getText();
  },

  setText(text: string) {
    if (!editor) throw new Error('Editor not initialized');
    editor.setText(text);
  },

  execCommand(name: string, ...args: unknown[]) {
    if (!editor) throw new Error('Editor not initialized');
    editor.execCommand(name, ...args);
  },

  updateSettings(_settings: Partial<unknown>) {
    // TODO: 动态更新 settings（需要 CM6 Compartment 机制）
  },

  applyYjsUpdate(update: Uint8Array) {
    if (!ydoc) return;
    Y.applyUpdate(ydoc, update, 'remote');
  },

  select(from: number, to?: number) {
    if (!editor) return;
    editor.select(from, to);
  },

  focus() {
    if (!editor) return;
    editor.focus();
  },
};

// 暴露 EditorApi 给 RN 侧通过 Comlink 调用
Comlink.expose(editorApi, createWebViewEndpoint());
