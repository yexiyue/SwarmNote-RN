import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export function insertCodeBlock(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const insert = `\`\`\`\n${selected}\n\`\`\``;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
    });
  } else {
    const insert = '```\n\n```';
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + 4),
    });
  }
}

export function insertHorizontalRule(view: EditorView): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.length > 0 ? '\n' : '';
  const insert = `${prefix}---\n`;

  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
  });
}

export function insertTable(view: EditorView): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.length > 0 ? '\n' : '';
  const table = `${prefix}| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n`;

  view.dispatch({
    changes: { from: line.to, to: line.to, insert: table },
    selection: EditorSelection.cursor(line.to + prefix.length + 2),
  });
}
