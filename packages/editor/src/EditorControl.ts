import { copyLineDown, deleteLine, indentLess, indentMore, redo, selectAll, undo } from '@codemirror/commands';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  clearSearch,
  getEditorSettings,
  getEditorSettingsEffects,
  getSearchState,
  setSearchState,
  type EditorSettingsExtensionRuntime,
} from './extensions';
import {
  computeSelectionFormatting,
  insertCodeBlock,
  insertHorizontalRule,
  insertTable,
  toggleBold,
  toggleCode,
  toggleHeading,
  toggleItalic,
  toggleList,
} from './editorCommands';
import { insertLineAfter } from './editorCommands/insertLineAfter';
import { sortSelectedLines } from './editorCommands/sortSelectedLines';
import { jumpToHash } from './editorCommands/jumpToHash';
import type {
  EditorCommandType,
  EditorControl,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
} from './types';
import { createSelectionRange } from './utils';

export class EditorControlImpl implements EditorControl {
  constructor(
    public readonly view: EditorView,
    private readonly options: {
      settingsRuntime: EditorSettingsExtensionRuntime;
      onDestroy?: () => void;
    },
  ) {}

  supportsCommand(name: EditorCommandType | string): boolean {
    switch (name) {
      case 'undo':
      case 'redo':
      case 'toggleBold':
      case 'toggleItalic':
      case 'toggleCode':
      case 'toggleHeading':
      case 'toggleOrderedList':
      case 'toggleUnorderedList':
      case 'toggleCheckList':
      case 'insertCodeBlock':
      case 'insertHorizontalRule':
      case 'insertTable':
      case 'selectAll':
      case 'duplicateLine':
      case 'deleteLine':
      case 'indentMore':
      case 'indentLess':
      case 'insertLineAfter':
      case 'sortSelectedLines':
      case 'jumpToHash':
      case 'focus':
      case 'blur':
      case 'scrollSelectionIntoView':
        return true;
      default:
        return false;
    }
  }

  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown {
    switch (name) {
      case 'undo':
        return undo(this.view);
      case 'redo':
        return redo(this.view);
      case 'toggleBold':
        return toggleBold(this.view);
      case 'toggleItalic':
        return toggleItalic(this.view);
      case 'toggleCode':
        return toggleCode(this.view);
      case 'toggleHeading':
        return toggleHeading(this.view, typeof args[0] === 'number' ? args[0] : 2);
      case 'toggleOrderedList':
        return toggleList(this.view, 'ordered');
      case 'toggleUnorderedList':
        return toggleList(this.view, 'unordered');
      case 'toggleCheckList':
        return toggleList(this.view, 'check');
      case 'insertCodeBlock':
        return insertCodeBlock(this.view);
      case 'insertHorizontalRule':
        return insertHorizontalRule(this.view);
      case 'insertTable':
        return insertTable(this.view);
      case 'selectAll':
        return selectAll(this.view);
      case 'duplicateLine':
        return copyLineDown(this.view);
      case 'deleteLine':
        return deleteLine(this.view);
      case 'indentMore':
        return indentMore(this.view);
      case 'indentLess':
        return indentLess(this.view);
      case 'insertLineAfter':
        return insertLineAfter(this.view);
      case 'sortSelectedLines':
        return sortSelectedLines(this.view);
      case 'jumpToHash':
        return jumpToHash(this.view, typeof args[0] === 'string' ? args[0] : '');
      case 'focus':
        return this.focus();
      case 'blur':
        return this.blur();
      case 'scrollSelectionIntoView':
        return this.view.dispatch({ scrollIntoView: true });
      default:
        return undefined;
    }
  }

  getText(): string {
    return this.view.state.doc.toString();
  }

  setText(text: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  insertText(text: string): void {
    this.replaceSelection(text);
  }

  replaceSelection(text: string): void {
    const selection = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text },
      selection: EditorSelection.cursor(selection.from + text.length),
    });
  }

  getSelection() {
    const selection = this.view.state.selection.main;
    return createSelectionRange(selection.anchor, selection.head);
  }

  select(anchor: number, head?: number): void {
    const resolvedHead = head ?? anchor;
    this.view.dispatch({
      selection: EditorSelection.single(anchor, resolvedHead),
    });
    this.view.focus();
  }

  getSettings(): EditorSettings {
    return getEditorSettings(this.view.state, this.options.settingsRuntime);
  }

  updateSettings(settings: EditorSettingsUpdate): void {
    this.view.dispatch({
      effects: getEditorSettingsEffects(
        this.view.state,
        this.options.settingsRuntime,
        settings,
      ),
    });
  }

  getSearchState(): SearchState | null {
    return getSearchState(this.view.state);
  }

  setSearchState(state: SearchState | null, source?: string): void {
    setSearchState(this.view, state, source);
  }

  clearSearch(source?: string): void {
    clearSearch(this.view, source);
  }

  getSelectionFormatting() {
    return computeSelectionFormatting(this.view.state);
  }

  focus(): void {
    this.view.focus();
  }

  blur(): void {
    this.view.contentDOM.blur();
  }

  destroy(): void {
    this.options.onDestroy?.();
    this.view.destroy();
  }
}
