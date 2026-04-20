import type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
} from '@swarmnote/editor';

export interface RuntimeInitOptions {
  initialText: string;
  initialSelection?: EditorSelectionRange;
  settings: EditorSettings;
  initialSearchState?: SearchState | null;
  autofocus?: boolean;
  collaboration?: EditorCollaborationConfig;
}

export interface RuntimeCreateEditorOptions extends RuntimeInitOptions {}

export interface EditorApi {
  createEditor(options: RuntimeCreateEditorOptions): void;
  destroyEditor(): void;
  getText(): string;
  setText(text: string): void;
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;
  updateSettings(settings: EditorSettingsUpdate): void;
  applyRemoteCollaborationUpdate(update: Uint8Array): void;
  select(selection: EditorSelectionRange): void;
  focus(): void;
  blur(): void;
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
  log(message: string): void;
}

export interface RuntimeState {
  editorReady: boolean;
  runtimeReady: boolean;
}

export type { EditorEvent };

export type EditorInitOptions = RuntimeInitOptions;
export type HostEventHandler = HostApi['onEditorEvent'];
