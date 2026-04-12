import type { EditorView } from '@codemirror/view';

export interface EditorSettings {
  readonly: boolean;
  lineWrapping: boolean;
  indentWithTabs: boolean;
  tabSize: number;
}

export interface EditorProps {
  initialText: string;
  settings: EditorSettings;
  yjsCollab?: YjsCollabOptions;
  onEvent?: (event: EditorEvent) => void;
}

export interface YjsCollabOptions {
  ydoc: unknown; // Y.Doc — typed as unknown to avoid forcing yjs import on consumers
  fragmentName?: string;
}

export type EditorEventKind =
  | 'change'
  | 'selectionChange'
  | 'focus'
  | 'blur';

export interface EditorEvent {
  kind: EditorEventKind;
  // Extensible payload
  [key: string]: unknown;
}

export interface EditorControl {
  // Content
  getText(): string;
  setText(text: string): void;
  insertText(text: string): void;

  // Selection
  getSelection(): { from: number; to: number };
  select(from: number, to?: number): void;

  // Commands
  execCommand(name: string, ...args: unknown[]): unknown;

  // Formatting
  toggleBold(): void;
  toggleItalic(): void;
  toggleCode(): void;
  toggleHeading(level?: number): void;

  // Lifecycle
  focus(): void;
  blur(): void;
  destroy(): void;

  // Underlying view (escape hatch)
  readonly view: EditorView;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
};
