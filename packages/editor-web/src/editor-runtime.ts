/**
 * Editor Runtime
 *
 * 管理 CodeMirror 编辑器生命周期、Yjs 协作绑定，
 * 实现 EditorApi 供 RN 宿主通过 Comlink 调用。
 */
import * as Y from 'yjs';
import {
  createEditor,
  DEFAULT_SETTINGS,
  EditorEventType,
  type EditorControl,
  type EditorEvent,
  type EditorSettingsUpdate,
} from '@swarmnote/editor';
import { debugLog } from './comlink-endpoint';
import type {
  EditorApi,
  HostApi,
  RuntimeCreateEditorOptions,
} from './types';

const REMOTE_COLLABORATION_ORIGIN = 'remote';

interface RuntimeState {
  editor: EditorControl | null;
  ydoc: Y.Doc | null;
  collaborationUpdateListener:
    | ((update: Uint8Array, origin: unknown) => void)
    | null;
}

function getEditorRoot(): HTMLElement {
  const parent = document.getElementById('editor-root');
  if (!parent) {
    throw new Error('Cannot find #editor-root element');
  }
  return parent;
}

const ABSOLUTE_URL_RE = /^(https?:|data:|blob:|file:|asset:|tauri:)/i;

/**
 * Map workspace-relative image src into a `file://` URL the WebView can load.
 * Mirrors the desktop `convertFileSrc(wsPath + url)` strategy but using plain
 * file:// (RN WebView is configured with allowFileAccessFromFileURLs).
 *
 * Absolute schemes are returned as-is so external https / data URLs continue
 * to flow through unchanged.
 */
function createWorkspaceImageResolver(
  workspacePath: string | undefined,
): ((src: string) => string) | undefined {
  if (!workspacePath) return undefined;
  // Strip trailing slashes so we don't produce `file:///path//foo.png`.
  const base = workspacePath.replace(/\/+$/, '');
  return (src: string): string => {
    if (!src) return src;
    if (ABSOLUTE_URL_RE.test(src)) return src;
    // Strip leading `./` or `/` so relative paths normalize cleanly.
    const cleaned = src.replace(/^(\.\/|\/)+/, '');
    return `file://${base}/${cleaned}`;
  };
}

/**
 * 创建 Editor Runtime，返回 EditorApi 实现。
 * host 是通过 Comlink.wrap 获得的 RN 侧 HostApi 代理。
 */
export function createEditorRuntime(host: HostApi): EditorApi {
  const state: RuntimeState = {
    editor: null,
    ydoc: null,
    collaborationUpdateListener: null,
  };

  function emitEditorEvent(event: EditorEvent): void {
    host.onEditorEvent(event);
  }

  function resetCollaborationBinding(): void {
    if (state.ydoc && state.collaborationUpdateListener) {
      state.ydoc.off('update', state.collaborationUpdateListener);
    }
    state.collaborationUpdateListener = null;
    state.ydoc = null;
  }

  function resetEditor(): void {
    state.editor?.destroy();
    state.editor = null;
    resetCollaborationBinding();
  }

  function createCollaborationConfig(
    options: RuntimeCreateEditorOptions,
  ): RuntimeCreateEditorOptions['collaboration'] {
    if (!options.collaboration) {
      resetCollaborationBinding();
      return undefined;
    }

    resetCollaborationBinding();

    const ydoc =
      options.collaboration.ydoc instanceof Y.Doc
        ? options.collaboration.ydoc
        : new Y.Doc();

    const remoteOrigin =
      options.collaboration.remoteOrigin ?? REMOTE_COLLABORATION_ORIGIN;

    const listener = (update: Uint8Array, origin: unknown) => {
      if (origin === remoteOrigin) return;
      // Use the dedicated host method, NOT onEditorEvent — Comlink's
      // transferHandler only fires for top-level RPC arguments, so a
      // Uint8Array nested inside an event object loses its type during
      // JSON envelope serialization (RN side sees byteLength=undefined).
      host.onCollaborationUpdate(update);
    };

    state.ydoc = ydoc;
    state.collaborationUpdateListener = listener;
    ydoc.on('update', listener);

    return {
      ...options.collaboration,
      remoteOrigin,
      ydoc,
    };
  }

  const api: EditorApi = {
    createEditor(options) {
      resetEditor();

      const root = getEditorRoot();
      debugLog(
        `createEditor: root=${root?.id}, textLen=${options.initialText?.length}`,
      );

      try {
        state.editor = createEditor(root, {
          initialText: options.initialText,
          initialSelection: options.initialSelection,
          settings: { ...DEFAULT_SETTINGS, ...options.settings },
          initialSearchState: options.initialSearchState,
          autofocus: options.autofocus,
          collaboration: createCollaborationConfig(options),
          imageResolver: createWorkspaceImageResolver(options.workspacePath),
          onEvent(event) {
            emitEditorEvent(event);
          },
        });

        debugLog('createEditor success');
      } catch (err) {
        debugLog(`createEditor FAILED: ${(err as Error).message}`);
        root.innerText = 'Editor Error: ' + (err as Error).message;
      }
    },

    destroyEditor() {
      if (!state.editor) {
        return;
      }
      resetEditor();
    },

    getText() {
      if (!state.editor) {
        throw new Error('Editor not initialized');
      }
      return state.editor.getText();
    },

    setText(text: string) {
      state.editor?.setText(text);
    },

    execCommand(name, ...args) {
      return state.editor?.execCommand(name, ...args);
    },

    updateSettings(settings: EditorSettingsUpdate) {
      state.editor?.updateSettings(settings);
    },

    applyRemoteCollaborationUpdate(update: Uint8Array) {
      if (!state.ydoc) {
        return;
      }
      Y.applyUpdate(state.ydoc, update, REMOTE_COLLABORATION_ORIGIN);
    },

    select(selection) {
      state.editor?.select(selection.anchor, selection.head);
    },

    focus() {
      state.editor?.focus();
    },

    blur() {
      state.editor?.blur();
    },

    setSearchState(state_, source) {
      state.editor?.setSearchState(state_, source);
    },
  };

  return api;
}
