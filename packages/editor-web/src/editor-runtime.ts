/**
 * Editor Runtime
 *
 * 管理 CodeMirror 编辑器生命周期、Yjs 协作绑定，
 * 实现 EditorApi 供 RN 宿主通过 Comlink 调用。
 */
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import {
  createEditor,
  DEFAULT_SETTINGS,
  EditorEventType,
  type EditorControl,
  type EditorEvent,
  type EditorSettingsUpdate,
} from '@swarmnote/editor-core';
import { debugLog } from './comlink-endpoint';
import type {
  AwarenessUserState,
  EditorApi,
  HostApi,
  RuntimeCreateEditorOptions,
} from './types';

const REMOTE_COLLABORATION_ORIGIN = 'remote';
const REMOTE_AWARENESS_ORIGIN = 'remote-awareness';
const LOCAL_AWARENESS_ORIGIN = 'local-awareness';

interface RuntimeState {
  editor: EditorControl | null;
  ydoc: Y.Doc | null;
  awareness: Awareness | null;
  collaborationUpdateListener:
    | ((update: Uint8Array, origin: unknown) => void)
    | null;
  awarenessUpdateListener:
    | ((
        changed: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => void)
    | null;
  presenceChangeListener: (() => void) | null;
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
    awareness: null,
    collaborationUpdateListener: null,
    awarenessUpdateListener: null,
    presenceChangeListener: null,
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

    if (state.awareness) {
      // setLocalState(null) must precede off('update') so the synthetic
      // "removed" event reaches the listener and triggers the broadcast —
      // see dev-notes/knowledge/editor.md "destroy 顺序敏感".
      state.awareness.setLocalState(null);

      if (state.awarenessUpdateListener) {
        state.awareness.off('update', state.awarenessUpdateListener);
      }
      if (state.presenceChangeListener) {
        state.awareness.off('change', state.presenceChangeListener);
      }
      state.awareness.destroy();
    }
    state.awareness = null;
    state.awarenessUpdateListener = null;
    state.presenceChangeListener = null;
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

    // Awareness lives on the same Y.Doc; runtime owns its lifecycle.
    const awareness = new Awareness(ydoc);

    const awarenessListener = (
      changed: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === REMOTE_AWARENESS_ORIGIN) return;
      const changedClients = [
        ...changed.added,
        ...changed.updated,
        ...changed.removed,
      ];
      if (changedClients.length === 0) return;
      const payload = encodeAwarenessUpdate(awareness, changedClients);
      host.onAwarenessUpdate(payload);
    };

    state.awareness = awareness;
    state.awarenessUpdateListener = awarenessListener;
    awareness.on('update', awarenessListener);

    // Mirror remote-only presence snapshots to host so RN PresenceAvatars
    // can render without directly accessing the in-WebView Awareness.
    // Multiple clientIDs sharing the same `user.deviceId` (transient
    // stale-while-new-arrived during doc switches / packet loss) are folded
    // into a single entry — RN PresenceAvatars uses `deviceId` as React key.
    const presenceListener = () => {
      const localId = awareness.clientID;
      const byDevice = new Map<string, AwarenessUserState>();
      for (const [clientId, raw] of awareness.getStates()) {
        if (clientId === localId) continue;
        const u = (raw as { user?: AwarenessUserState }).user;
        if (
          u &&
          typeof u.name === 'string' &&
          typeof u.deviceId === 'string' &&
          typeof u.color === 'string' &&
          (u.platform === 'desktop' || u.platform === 'mobile') &&
          !byDevice.has(u.deviceId)
        ) {
          byDevice.set(u.deviceId, u);
        }
      }
      host.onPresenceChange([...byDevice.values()]);
    };
    awareness.on('change', presenceListener);
    state.presenceChangeListener = presenceListener;

    return {
      ...options.collaboration,
      remoteOrigin,
      ydoc,
      awareness,
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

    applyRemoteAwarenessUpdate(update: Uint8Array) {
      if (!state.awareness) return;
      // REMOTE_AWARENESS_ORIGIN is checked by the local listener to skip
      // re-broadcasting; identical to the y-protocols loop guard pattern.
      applyAwarenessUpdate(state.awareness, update, REMOTE_AWARENESS_ORIGIN);
    },

    setLocalUserState(userState: AwarenessUserState) {
      if (!state.awareness) return;
      state.awareness.setLocalStateField('user', userState);
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

    setScrollBottomMargin(px: number) {
      state.editor?.setScrollBottomMargin(px);
    },

    setSearchState(state_, source) {
      state.editor?.setSearchState(state_, source);
    },
  };

  return api;
}
