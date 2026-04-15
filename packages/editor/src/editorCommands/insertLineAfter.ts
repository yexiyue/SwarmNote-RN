import { insertNewlineAndIndent } from '@codemirror/commands';
import { EditorSelection, type SelectionRange } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { insertNewlineContinueMarkup } from './insertNewlineContinueMarkup';

export function insertLineAfter(view: EditorView): boolean {
  const { state } = view;

  // Move cursor to end of current line
  view.dispatch(
    state.changeByRange((sel: SelectionRange) => {
      const line = state.doc.lineAt(sel.anchor);
      return { range: EditorSelection.cursor(line.to) };
    }),
  );

  // Try markdown-aware newline first, fall back to plain
  if (!insertNewlineContinueMarkup(view)) {
    insertNewlineAndIndent(view);
  }

  return true;
}
