import * as Comlink from 'comlink';
import * as Y from 'yjs';
import { createEditor, DEFAULT_SETTINGS } from '@swarmnote/editor';
import type { EditorControl } from '@swarmnote/editor';
import type { EditorApi, EditorInitOptions, HostApi } from './types';

let editor: EditorControl | null = null;
let ydoc: Y.Doc | null = null;

// HostApi proxy — 会在 Comlink 连接建立后被设置
let hostApi: Comlink.Remote<HostApi> | null = null;

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
        // 只广播本地产生的更新（origin 不是 'remote' 的）
        if (origin !== 'remote' && hostApi) {
          hostApi.onYjsUpdate(update);
        }
      });
    }

    editor = createEditor(parent, {
      initialText: options.initialText,
      settings: { ...DEFAULT_SETTINGS, ...options.settings },
      yjsCollab: ydoc ? { ydoc, fragmentName: 'document' } : undefined,
      onEvent(event) {
        if (event.kind === 'change' && hostApi) {
          hostApi.onDocChange();
        }
        if ((event.kind === 'focus' || event.kind === 'blur') && hostApi) {
          hostApi.onFocusChange(event.kind === 'focus');
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
Comlink.expose(editorApi);

// 导出类型供外部使用
export type { EditorApi, HostApi, EditorInitOptions } from './types';
