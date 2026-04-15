import { tags, Tag } from '@lezer/highlight';
import type { MarkdownConfig, InlineContext, MarkdownExtension } from '@lezer/markdown';

const equalsSignCharcode = 61;

export const highlightTagName = 'Highlight';
export const highlightMarkerTagName = 'HighlightMarker';

export const highlightTag = Tag.define();
export const highlightMarkerTag = Tag.define(tags.meta);

const highlightDelimiter = {
  resolve: highlightTagName,
  mark: highlightMarkerTagName,
};

function isWhitespaceOrEmpty(text: string) {
  return /^\s*$/.test(text);
}

function createDoubleCharInlineConfig(): MarkdownConfig {
  return {
    defineNodes: [
      {
        name: highlightTagName,
        style: highlightTag,
      },
      {
        name: highlightMarkerTagName,
        style: highlightMarkerTag,
      },
    ],
    parseInline: [
      {
        name: highlightTagName,
        parse(cx: InlineContext, current: number, pos: number): number {
          const nextCharCode = cx.char(pos + 1);
          const nextNextCharCode = cx.char(pos + 2);
          if (
            current !== equalsSignCharcode ||
            nextCharCode !== equalsSignCharcode ||
            nextNextCharCode === equalsSignCharcode
          ) {
            return -1;
          }

          const before = cx.slice(pos - 1, pos);
          const after = cx.slice(pos + 2, pos + 3);

          const canStart = !isWhitespaceOrEmpty(after);
          const canEnd = !isWhitespaceOrEmpty(before);

          if (!canStart && !canEnd) {
            return -1;
          }

          return cx.addDelimiter(highlightDelimiter, pos, pos + 2, canStart, canEnd);
        },
      },
    ],
  };
}

export const markdownHighlightExtension: MarkdownExtension = [
  createDoubleCharInlineConfig(),
];
