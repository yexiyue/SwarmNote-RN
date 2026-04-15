import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

export interface LinkInfo {
  url: string;
  from: number;
  to: number;
}

export function findLinkAtPosition(pos: number, state: EditorState): LinkInfo | null {
  const tree = syntaxTree(state);
  let cursor = tree.resolveStack(pos);

  while (true) {
    if (cursor.node.name === 'Link') {
      const urlNode = cursor.node.getChild('URL');
      if (urlNode) {
        return {
          url: state.sliceDoc(urlNode.from, urlNode.to),
          from: cursor.node.from,
          to: cursor.node.to,
        };
      }
    } else if (cursor.node.name === 'URL') {
      return {
        url: state.sliceDoc(cursor.node.from, cursor.node.to),
        from: cursor.node.from,
        to: cursor.node.to,
      };
    }

    if (!cursor.next) break;
    cursor = cursor.next;
  }

  return null;
}
