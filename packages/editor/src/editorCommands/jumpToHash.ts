import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * 跳转到文档中匹配 hash 的标题。
 * hash 是标题文本经 slug 化后的结果。
 */
export function jumpToHash(view: EditorView, hash: string): boolean {
  const { state } = view;
  let targetPos: number | undefined;

  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  if (!tree) return false;

  tree.iterate({
    enter(node) {
      if (targetPos !== undefined) return false;

      if (node.name.startsWith('SetextHeading') || node.name.startsWith('ATXHeading')) {
        const text = state
          .sliceDoc(node.from, node.to)
          .replace(/^#+\s/, '')
          .replace(/\n-+$/, '');

        if (hash === slugify(text)) {
          targetPos = node.to;
          return false;
        }
      }
    },
  });

  if (targetPos !== undefined) {
    view.dispatch({
      selection: EditorSelection.cursor(targetPos),
      effects: [EditorView.scrollIntoView(targetPos, { y: 'start' })],
    });
    return true;
  }

  return false;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
