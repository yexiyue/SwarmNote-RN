import type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
} from './contracts';

export interface RuntimeInitOptions {
  initialText: string;
  initialSelection?: EditorSelectionRange;
  settings: EditorSettings;
  initialSearchState?: SearchState | null;
  autofocus?: boolean;
  collaboration?: EditorCollaborationConfig;
  /**
   * Local filesystem path of the active workspace. When set, the runtime
   * resolves workspace-relative image src `![](images/foo.png)` into
   * `file://<workspacePath>/images/foo.png` so the WebView can load them.
   * Absolute schemes (http/https/data/blob/asset/file/tauri) pass through.
   */
  workspacePath?: string;
}

export interface RuntimeCreateEditorOptions extends RuntimeInitOptions {}

/**
 * Identity fields written into the local awareness state under `user`.
 * `y-codemirror.next` reads `user.name` / `user.color` to render remote
 * caret labels; the other fields are consumed by PresenceAvatars UI.
 */
export interface AwarenessUserState {
  name: string;
  platform: 'desktop' | 'mobile';
  deviceId: string;
  color: string;
}

export interface EditorApi {
  createEditor(options: RuntimeCreateEditorOptions): void;
  destroyEditor(): void;
  getText(): string;
  setText(text: string): void;
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;
  updateSettings(settings: EditorSettingsUpdate): void;
  applyRemoteCollaborationUpdate(update: Uint8Array): void;
  /** Apply a remote `y-protocols/awareness` update (encodeAwarenessUpdate
   *  bytes from another peer). Top-level Uint8Array — see HostApi note. */
  applyRemoteAwarenessUpdate(update: Uint8Array): void;
  /** Write the local user identity into awareness state. Call once after
   *  createEditor in collab mode; the runtime publishes the resulting
   *  awareness diff via `host.onAwarenessUpdate`. */
  setLocalUserState(state: AwarenessUserState): void;
  select(selection: EditorSelectionRange): void;
  focus(): void;
  blur(): void;
  /** Set the bottom scroll margin in pixels — host calls this with the height
   *  of any UI overlaying the editor (keyboard + toolbar / floating bar) so
   *  CodeMirror keeps the cursor above the overlay during scrollIntoView. */
  setScrollBottomMargin(px: number): void;
  setSearchState(state: SearchState | null, source?: string): void;
}

export interface HostApi {
  onRuntimeReady(): void;
  onEditorEvent(event: EditorEvent): void;
  /** Dedicated channel for Y.Doc updates. Lives outside `onEditorEvent`
   *  because Comlink's transferHandler only fires on top-level RPC
   *  arguments — when the binary is nested inside an event object the
   *  custom JSON envelope strips its `Uint8Array` type, leaving the host
   *  with `{"0":N,"1":N,...}` and an undefined `byteLength`. Passing the
   *  update as a top-level argument keeps the `uint8array` transferHandler
   *  effective. */
  onCollaborationUpdate(update: Uint8Array): void;
  /** Awareness updates from local edits. Same top-level-Uint8Array rule. */
  onAwarenessUpdate(update: Uint8Array): void;
  /** Remote-only presence snapshot, recomputed every awareness change.
   *  RN cannot inspect the in-WebView Awareness instance directly, so this
   *  is the channel for PresenceAvatars / online-list UI. JSON-serializable
   *  by design, no Uint8Array — safe inside event objects. */
  onPresenceChange(users: AwarenessUserState[]): void;
  log(message: string): void;
}

export interface RuntimeState {
  editorReady: boolean;
  runtimeReady: boolean;
}

export type { EditorEvent };

export type EditorInitOptions = RuntimeInitOptions;
export type HostEventHandler = HostApi['onEditorEvent'];
