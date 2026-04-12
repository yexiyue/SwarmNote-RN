import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

/**
 * 在选中文本两边包裹/取消 marker（如 ** 或 * 或 `）。
 */
function toggleInlineMarker(view: EditorView, marker: string): void {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);
  const markerLen = marker.length;

  // 检查选中文本是否已经被 marker 包裹
  const before = view.state.sliceDoc(
    Math.max(0, from - markerLen),
    from,
  );
  const after = view.state.sliceDoc(to, to + markerLen);

  if (before === marker && after === marker) {
    // 取消包裹：删除两边的 marker
    view.dispatch({
      changes: [
        { from: from - markerLen, to: from, insert: '' },
        { from: to, to: to + markerLen, insert: '' },
      ],
      selection: EditorSelection.single(from - markerLen, to - markerLen),
    });
  } else {
    // 添加包裹
    const insert = `${marker}${selectedText}${marker}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.single(from + markerLen, from + markerLen + selectedText.length),
    });
  }
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
  const lineText = line.text;

  const prefix = '#'.repeat(level) + ' ';

  if (lineText.startsWith(prefix)) {
    // 已经是这个级别的标题，取消
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    });
  } else {
    // 去掉已有的 # 前缀（如果有），加上新的
    const existingMatch = lineText.match(/^#{1,6}\s/);
    const removeLen = existingMatch ? existingMatch[0].length : 0;
    view.dispatch({
      changes: { from: line.from, to: line.from + removeLen, insert: prefix },
    });
  }
}
