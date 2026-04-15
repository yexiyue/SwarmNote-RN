import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export function sortSelectedLines(view: EditorView): boolean {
  const { state } = view;
  const { doc } = state;

  const transaction = state.changeByRange((range) => {
    const startLine = doc.lineAt(range.from);
    const endLine = doc.lineAt(range.to);

    const lines: string[] = [];
    for (let j = startLine.number; j <= endLine.number; j++) {
      lines.push(doc.line(j).text);
    }

    const sortedText = lines.sort().join('\n');

    return {
      range: EditorSelection.cursor(startLine.from + sortedText.length),
      changes: [{ from: startLine.from, to: endLine.to, insert: sortedText }],
    };
  });

  view.dispatch(transaction);
  return true;
}
