import type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorFeatureToggles,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
  SelectionFormatting,
} from '@swarmnote/editor-core';

export type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorFeatureToggles,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
  SelectionFormatting,
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
  autofocus: false,
  spellcheck: false,
  editable: true,
  showLineNumbers: false,
  features: {
    markdownHighlight: true,
    markdownDecorations: true,
    inlineRendering: true,
    blockImageRendering: true,
    rawHtmlRendering: true,
    codeBlockMode: 'inline',
    mathRendering: true,
    mermaidRendering: true,
    search: true,
    collaboration: true,
    smartPaste: true,
    admonition: true,
  },
  theme: { appearance: 'light' },
};

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

export const EditorEventType = {
  Change: 'change',
  SelectionChange: 'selectionChange',
  SelectionFormattingChange: 'selectionFormattingChange',
  Focus: 'focus',
  Blur: 'blur',
  SearchStateChange: 'searchStateChange',
  CollaborationUpdate: 'collaborationUpdate',
  LinkOpen: 'linkOpen',
  Remove: 'remove',
  TableContextMenu: 'tableContextMenu',
  MermaidZoomRequest: 'mermaidZoomRequest',
} as const;
