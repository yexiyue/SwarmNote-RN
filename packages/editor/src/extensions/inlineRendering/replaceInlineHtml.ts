/**
 * Inline HTML 渲染
 *
 * 隐藏简单 HTML 标签（<mark>, <kbd>, <sup>, <sub>），
 * 用 Decoration.mark 给内容应用对应样式。
 */
import type { EditorState } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import type { InlineRenderingSpec, RevealStrategy } from './types';

const hiddenDecoration = Decoration.replace({});

const supportedTags: Record<
  string,
  { attributes: Record<string, string> }
> = {
  mark: {
    attributes: { class: 'cm-html-mark' },
  },
  kbd: {
    attributes: { class: 'cm-html-kbd' },
  },
  sup: {
    attributes: { class: 'cm-html-sup' },
  },
  sub: {
    attributes: { class: 'cm-html-sub' },
  },
};

// Match <tag> or </tag> — returns [tagName, isClosing]
function parseHtmlTag(
  text: string,
): [string, boolean] | null {
  const match = text.match(/^<(\/?)([a-zA-Z]+)\s*\/?>$/);
  if (!match) return null;
  const tagName = match[2].toLowerCase();
  if (!(tagName in supportedTags)) return null;
  return [tagName, match[1] === '/'];
}

export const inlineHtmlTheme = EditorView.theme({
  '.cm-html-mark': {
    backgroundColor: 'rgba(255, 214, 10, 0.35)',
    borderRadius: '2px',
    padding: '0 2px',
  },
  '.cm-html-kbd': {
    backgroundColor: 'rgba(127, 127, 127, 0.15)',
    border: '1px solid rgba(127, 127, 127, 0.3)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
  '.cm-html-sup': {
    verticalAlign: 'super',
    fontSize: '0.75em',
  },
  '.cm-html-sub': {
    verticalAlign: 'sub',
    fontSize: '0.75em',
  },
});

/**
 * Inline HTML spec — 处理 HTMLTag 节点。
 *
 * 策略：遇到 opening tag 时向后找 closing tag，
 * 隐藏两个标签，对中间内容应用 mark decoration。
 * 这里只生成 hide decoration，content styling 通过
 * 一个独立的 spec 实现。
 */
export const replaceInlineHtml: InlineRenderingSpec = {
  nodeNames: ['HTMLTag'],
  extension: {
    createDecoration(node: SyntaxNodeRef, state: EditorState) {
      const text = state.sliceDoc(node.from, node.to);
      const parsed = parseHtmlTag(text);
      if (!parsed) return null;
      return hiddenDecoration;
    },
    getRevealStrategy(): RevealStrategy {
      return 'active';
    },
  },
};

function findClosingTag(
  node: SyntaxNodeRef,
  tagName: string,
  state: EditorState,
): { from: number; to: number } | null {
  let sibling = node.node.nextSibling;
  while (sibling) {
    if (sibling.name === 'HTMLTag') {
      const sibText = state.sliceDoc(sibling.from, sibling.to);
      const sibParsed = parseHtmlTag(sibText);
      if (sibParsed && sibParsed[0] === tagName && sibParsed[1]) {
        return { from: sibling.from, to: sibling.to };
      }
    }
    sibling = sibling.nextSibling;
  }
  return null;
}

/**
 * Content styling spec — 对 opening tag 后到 closing tag 前的内容应用样式。
 */
export const styleInlineHtmlContent: InlineRenderingSpec = {
  nodeNames: ['HTMLTag'],
  extension: {
    createDecoration(node: SyntaxNodeRef, state: EditorState) {
      const text = state.sliceDoc(node.from, node.to);
      const parsed = parseHtmlTag(text);
      if (!parsed) return null;

      const [tagName, isClosing] = parsed;
      if (isClosing) return null;

      const closer = findClosingTag(node, tagName, state);
      if (!closer || node.to >= closer.from) return null;

      return Decoration.mark(supportedTags[tagName]);
    },
    getDecorationRange(node: SyntaxNodeRef, state: EditorState) {
      const text = state.sliceDoc(node.from, node.to);
      const parsed = parseHtmlTag(text);
      if (!parsed) return null;

      const [tagName, isClosing] = parsed;
      if (isClosing) return null;

      const closer = findClosingTag(node, tagName, state);
      if (!closer) return null;

      return [node.to, closer.from];
    },
    getRevealStrategy(): RevealStrategy {
      return 'active';
    },
    hideWhenContainsSelection: true,
  },
};
