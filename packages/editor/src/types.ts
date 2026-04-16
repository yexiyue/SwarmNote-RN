import type { EditorView } from '@codemirror/view';
import type { EditorEvent } from './events';

export enum EditorCommandType {
  Undo = 'undo',
  Redo = 'redo',
  ToggleBold = 'toggleBold',
  ToggleItalic = 'toggleItalic',
  ToggleCode = 'toggleCode',
  ToggleHeading = 'toggleHeading',
  ToggleOrderedList = 'toggleOrderedList',
  ToggleUnorderedList = 'toggleUnorderedList',
  ToggleCheckList = 'toggleCheckList',
  InsertCodeBlock = 'insertCodeBlock',
  InsertHorizontalRule = 'insertHorizontalRule',
  InsertTable = 'insertTable',
  SelectAll = 'selectAll',
  DuplicateLine = 'duplicateLine',
  DeleteLine = 'deleteLine',
  IndentMore = 'indentMore',
  IndentLess = 'indentLess',
  InsertLineAfter = 'insertLineAfter',
  SortSelectedLines = 'sortSelectedLines',
  JumpToHash = 'jumpToHash',
  Focus = 'focus',
  Blur = 'blur',
  ScrollSelectionIntoView = 'scrollSelectionIntoView',
}

export interface EditorSelectionRange {
  anchor: number;
  head: number;
  from: number;
  to: number;
}

export interface EditorFeatureToggles {
  markdownHighlight: boolean;
  markdownDecorations: boolean;
  inlineRendering: boolean;
  blockImageRendering: boolean;
  codeBlockWidget: boolean;
  mathRendering: boolean;
  search: boolean;
  collaboration: boolean;
}

export type EditorAppearance = 'light' | 'dark';

export interface EditorThemeConfig {
  appearance: EditorAppearance;
  fontFamily?: string;
  fontSize?: number;
  colors?: {
    background?: string;
    foreground?: string;
    selection?: string;
    activeLine?: string;
    border?: string;
    codeBackground?: string;
    heading?: string;
    link?: string;
    comment?: string;
    keyword?: string;
    string?: string;
  };
}

export interface EditorSettings {
  readonly: boolean;
  lineWrapping: boolean;
  indentWithTabs: boolean;
  tabSize: number;
  autofocus: boolean;
  spellcheck: boolean;
  editable: boolean;
  showLineNumbers: boolean;
  features: EditorFeatureToggles;
  theme: EditorThemeConfig;
}

export interface EditorSettingsUpdate
  extends Partial<Omit<EditorSettings, 'features' | 'theme'>> {
  features?: Partial<EditorFeatureToggles>;
  theme?: Partial<EditorThemeConfig>;
}

export interface SearchState {
  query: string;
  replaceQuery: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  isOpen: boolean;
  activeMatchIndex: number | null;
  totalMatches: number;
}

export interface EditorCollaborationConfig {
  ydoc: unknown;
  fragmentName?: string;
  localOrigin?: string;
  remoteOrigin?: string;
}

export interface EditorProps {
  initialText: string;
  initialSelection?: EditorSelectionRange;
  settings: EditorSettings;
  initialSearchState?: SearchState | null;
  autofocus?: boolean;
  collaboration?: EditorCollaborationConfig;
  onEvent?: (event: EditorEvent) => void;
}

export interface EditorControl {
  readonly view: EditorView;

  supportsCommand(name: EditorCommandType | string): boolean;
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;

  getText(): string;
  setText(text: string): void;
  insertText(text: string): void;
  replaceSelection(text: string): void;

  getSelection(): EditorSelectionRange;
  select(anchor: number, head?: number): void;

  getSettings(): EditorSettings;
  updateSettings(settings: EditorSettingsUpdate): void;

  getSearchState(): SearchState | null;
  setSearchState(state: SearchState | null, source?: string): void;
  clearSearch(source?: string): void;

  getSelectionFormatting(): SelectionFormatting;

  focus(): void;
  blur(): void;
  destroy(): void;
}

export type ListType = 'ordered' | 'unordered' | 'check';

export interface SelectionFormatting {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strikethrough: boolean;
  highlight: boolean;
  heading: number;
  listType: ListType | null;
  listLevel: number;
  inBlockquote: boolean;
  inCodeBlock: boolean;
}

export const DEFAULT_SELECTION_FORMATTING: SelectionFormatting = {
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  highlight: false,
  heading: 0,
  listType: null,
  listLevel: 0,
  inBlockquote: false,
  inCodeBlock: false,
};

export const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  replaceQuery: '',
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
  isOpen: false,
  activeMatchIndex: null,
  totalMatches: 0,
};

export const DEFAULT_THEME: EditorThemeConfig = {
  appearance: 'light',
};

export const DEFAULT_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
  autofocus: false,
  spellcheck: false,
  editable: true,
  showLineNumbers: false,
  theme: DEFAULT_THEME,
  features: {
    markdownHighlight: true,
    markdownDecorations: true,
    inlineRendering: true,
    blockImageRendering: true,
    codeBlockWidget: true,
    mathRendering: true,
    search: true,
    collaboration: true,
  },
};
