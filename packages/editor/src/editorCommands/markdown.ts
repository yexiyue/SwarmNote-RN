import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * 在选中文本两边包裹/取消 marker（如 ** 或 * 或 `）。
 */
function toggleInlineMarker(view: EditorView, marker: string): void {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);
  const markerLen = marker.length;

  const before = view.state.sliceDoc(Math.max(0, from - markerLen), from);
  const after = view.state.sliceDoc(to, to + markerLen);

  if (before === marker && after === marker) {
    view.dispatch({
      changes: [
        { from: from - markerLen, to: from, insert: '' },
        { from: to, to: to + markerLen, insert: '' },
      ],
      selection: EditorSelection.single(from - markerLen, to - markerLen),
    });
    return;
  }

  const insert = `${marker}${selectedText}${marker}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.single(
      from + markerLen,
      from + markerLen + selectedText.length,
    ),
  });
}

export function toggleBold(view: EditorView): void {
  toggleInlineMarker(view, '**');
}

export function toggleItalic(view: EditorView): void {
  toggleInlineMarker(view, '*');
}

export function toggleCode(view: EditorView): void {
  toggleInlineMarker(view, '`');
}

export function toggleHeading(view: EditorView, level = 2): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = `${'#'.repeat(level)} `;

  if (line.text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    });
    return;
  }

  const existingMatch = line.text.match(/^#{1,6}\s/);
  const removeLen = existingMatch ? existingMatch[0].length : 0;
  view.dispatch({
    changes: { from: line.from, to: line.from + removeLen, insert: prefix },
  });
}
