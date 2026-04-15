/**
 * Formatting Classes
 *
 * 给 Strikethrough 和 Link/URL 节点添加 CSS class，
 * 实现删除线和链接下划线视觉样式。
 * 参考 Joplin addFormattingClasses.ts。
 */
import { Decoration, EditorView } from '@codemirror/view';
import type { InlineRenderingSpec, RevealStrategy } from './types';

const linkDecoration = Decoration.mark({ class: 'cm-ext-link' });
const strikethroughDecoration = Decoration.mark({ class: 'cm-ext-strikethrough' });

export const formattingClassesTheme = EditorView.theme({
  '.cm-ext-link, .cm-ext-link span': {
    textDecoration: 'underline',
  },
  '.cm-ext-strikethrough, .cm-ext-strikethrough span': {
    textDecoration: 'line-through',
  },
});

export const addFormattingClasses: InlineRenderingSpec = {
  nodeNames: ['Link', 'URL', 'Strikethrough'],
  extension: {
    createDecoration(node) {
      if (node.name === 'URL' || node.name === 'Link') {
        return linkDecoration;
      }
      if (node.name === 'Strikethrough') {
        return strikethroughDecoration;
      }
      return null;
    },
    getRevealStrategy(node): RevealStrategy {
      if (node.name === 'URL' || node.name === 'Link') return 'select';
      return 'active';
    },
  },
};
