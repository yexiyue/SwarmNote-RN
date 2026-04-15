/**
 * Line-Aware Clipboard Extension
 *
 * 无选区时 copy/cut 操作整行（含换行符），
 * 与 VS Code、Joplin 行为一致。
 */
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function createLineAwareClipboardExtension(): Extension {
  return EditorView.domEventHandlers({
    copy(event, view) {
      const sel = view.state.selection.main;
      if (!sel.empty) return false;

      const line = view.state.doc.lineAt(sel.anchor);
      event.preventDefault();
      event.clipboardData?.setData('text/plain', `${line.text}\n`);
      return true;
    },
    cut(event, view) {
      const sel = view.state.selection.main;
      if (!sel.empty) return false;

      const line = view.state.doc.lineAt(sel.anchor);
      event.preventDefault();
      event.clipboardData?.setData('text/plain', `${line.text}\n`);

      view.dispatch({
        changes: {
          from: line.from,
          to: Math.min(line.to + 1, view.state.doc.length),
          insert: '',
        },
        userEvent: 'delete.cut',
      });
      return true;
    },
  });
}
