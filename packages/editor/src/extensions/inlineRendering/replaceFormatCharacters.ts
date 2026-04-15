import { Decoration } from '@codemirror/view';
import type { InlineRenderingSpec, RevealStrategy } from './types';

const lineRevealNodes = new Set(['HeaderMark', 'CodeMark', 'QuoteMark']);
const activeRevealNodes = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMarker',
  'LinkMark',
]);

const hiddenDecoration = Decoration.replace({});

export const replaceFormatCharacters: InlineRenderingSpec = {
  nodeNames: [
    'HeaderMark',
    'CodeMark',
    'EmphasisMark',
    'StrikethroughMark',
    'HighlightMarker',
    'QuoteMark',
    'LinkMark',
  ],
  extension: {
    createDecoration() {
      return hiddenDecoration;
    },
    getDecorationRange(node, state) {
      // For HeaderMark, include the trailing space if present
      if (node.name === 'HeaderMark') {
        const afterMark = state.sliceDoc(node.to, node.to + 1);
        if (afterMark === ' ') {
          return [node.from, node.to + 1];
        }
      }
      return null;
    },
    getRevealStrategy(node): RevealStrategy {
      if (lineRevealNodes.has(node.name)) return 'line';
      if (activeRevealNodes.has(node.name)) return 'active';
      return 'line';
    },
  },
};
