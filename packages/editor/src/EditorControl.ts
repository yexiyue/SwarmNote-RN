import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';
import type { EditorControl } from './types';
import { toggleBold, toggleItalic, toggleCode, toggleHeading } from './commands/markdown';

export class EditorControlImpl implements EditorControl {
  constructor(public readonly view: EditorView) {}

  getText(): string {
    return this.view.state.doc.toString();
  }

  setText(text: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  insertText(text: string): void {
    const { from } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, insert: text },
      selection: EditorSelection.cursor(from + text.length),
    });
  }

  getSelection(): { from: number; to: number } {
    const { from, to } = this.view.state.selection.main;
    return { from, to };
  }

  select(from: number, to?: number): void {
    this.view.dispatch({
      selection: EditorSelection.single(from, to ?? from),
    });
    this.view.focus();
  }

  execCommand(name: string, ...args: unknown[]): unknown {
    switch (name) {
      case 'undo':
        return undo(this.view);
      case 'redo':
        return redo(this.view);
      case 'toggleBold':
        return this.toggleBold();
      case 'toggleItalic':
        return this.toggleItalic();
      case 'toggleCode':
        return this.toggleCode();
      case 'scrollSelectionIntoView':
        return this.view.dispatch({ scrollIntoView: true });
      default:
        console.warn(`Unknown command: ${name}`);
        return undefined;
    }
  }

  toggleBold(): void {
    toggleBold(this.view);
  }

  toggleItalic(): void {
    toggleItalic(this.view);
  }

  toggleCode(): void {
    toggleCode(this.view);
  }

  toggleHeading(level = 2): void {
    toggleHeading(this.view, level);
  }

  focus(): void {
    this.view.focus();
  }

  blur(): void {
    this.view.contentDOM.blur();
  }

  destroy(): void {
    this.view.destroy();
  }
}
