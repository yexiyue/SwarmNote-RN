import type { EditorSelectionRange, SearchState, SelectionFormatting } from './types';

export const EditorEventType = {
  Change: 'change',
  SelectionChange: 'selectionChange',
  SelectionFormattingChange: 'selectionFormattingChange',
  Focus: 'focus',
  Blur: 'blur',
  SearchStateChange: 'searchStateChange',
  CollaborationUpdate: 'collaborationUpdate',
  Remove: 'remove',
} as const;

export type EditorEventType = (typeof EditorEventType)[keyof typeof EditorEventType];

export interface EditorChangeEvent {
  kind: typeof EditorEventType.Change;
}

export interface EditorSelectionChangeEvent {
  kind: typeof EditorEventType.SelectionChange;
  selection: EditorSelectionRange;
}

export interface EditorFocusEvent {
  kind: typeof EditorEventType.Focus;
}

export interface EditorBlurEvent {
  kind: typeof EditorEventType.Blur;
}

export interface EditorSearchStateChangeEvent {
  kind: typeof EditorEventType.SearchStateChange;
  search: SearchState | null;
  source?: string;
}

export interface EditorCollaborationUpdateEvent {
  kind: typeof EditorEventType.CollaborationUpdate;
  update: Uint8Array;
}

export interface EditorSelectionFormattingChangeEvent {
  kind: typeof EditorEventType.SelectionFormattingChange;
  formatting: SelectionFormatting;
}

export interface EditorRemoveEvent {
  kind: typeof EditorEventType.Remove;
}

export type EditorEvent =
  | EditorChangeEvent
  | EditorSelectionChangeEvent
  | EditorSelectionFormattingChangeEvent
  | EditorFocusEvent
  | EditorBlurEvent
  | EditorSearchStateChangeEvent
  | EditorCollaborationUpdateEvent
  | EditorRemoveEvent;
