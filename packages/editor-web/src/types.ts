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
  log(message: string): void;
}

export interface RuntimeState {
  editorReady: boolean;
  runtimeReady: boolean;
}

export type { EditorEvent };

export type EditorInitOptions = RuntimeInitOptions;
export type HostEventHandler = HostApi['onEditorEvent'];
