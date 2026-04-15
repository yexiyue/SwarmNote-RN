/**
 * Markdown Math Extension
 *
 * Lezer 语法扩展，识别 $...$ (inline) 和 $$...$$ (block) 数学公式。
 * 生成 InlineMath / BlockMath 语法节点，供渲染层使用。
 * 使用 @codemirror/legacy-modes/mode/stex 对公式内容做 LaTeX 语法高亮。
 *
 * 基于 Joplin markdownMathExtension.ts。
 */
import { Tag, tags } from '@lezer/highlight';
import {
  parseMixed,
  type SyntaxNodeRef,
  type Input,
  type NestedParse,
  type ParseWrapper,
} from '@lezer/common';
import type {
  MarkdownConfig,
  InlineContext,
  BlockContext,
  Line,
  LeafBlock,
  MarkdownExtension,
} from '@lezer/markdown';
import { StreamLanguage } from '@codemirror/language';
import { stexMath } from '@codemirror/legacy-modes/mode/stex';

const dollarSignCharcode = 36;
const backslashCharcode = 92;

const mathBlockStartRegex = /^(?:\s*[>]\s*)?\$\$/;
const mathBlockEndRegex = /\$\$\s*$/;

const texLanguage = StreamLanguage.define(stexMath);

export const inlineMathTagName = 'InlineMath';
export const inlineMathContentTagName = 'InlineMathContent';
export const blockMathTagName = 'BlockMath';
export const blockMathContentTagName = 'BlockMathContent';
export const mathTag = Tag.define(tags.monospace);

const wrappedTexParser = (nodeTag: string): ParseWrapper => {
  return parseMixed((node: SyntaxNodeRef, _input: Input): NestedParse | null => {
    if (node.name !== nodeTag) return null;
    return { parser: texLanguage.parser };
  });
};

const inlineMathConfig: MarkdownConfig = {
  defineNodes: [
    { name: inlineMathTagName, style: mathTag },
    { name: inlineMathContentTagName },
  ],
  parseInline: [
    {
      name: inlineMathTagName,
      after: 'InlineCode',

      parse(cx: InlineContext, current: number, pos: number): number {
        const nextCharCode = cx.char(pos + 1);
        if (
          current !== dollarSignCharcode ||
          cx.char(pos - 1) === dollarSignCharcode ||
          nextCharCode === dollarSignCharcode
        ) {
          return -1;
        }

        // No space directly after $
        if (/\s/.test(String.fromCharCode(nextCharCode))) return -1;

        const start = pos;
        const end = cx.end;
        let escaped = false;
        pos++;

        for (; pos < end && (escaped || cx.char(pos) !== dollarSignCharcode); pos++) {
          escaped = !escaped && cx.char(pos) === backslashCharcode;
        }

        // No space before closing $
        if (/\s/.test(String.fromCharCode(cx.char(pos - 1)))) return -1;

        // No closing $
        if (pos === end) return -1;

        pos++;
        const contentElem = cx.elt(inlineMathContentTagName, start + 1, pos - 1);
        cx.addElement(cx.elt(inlineMathTagName, start, pos, [contentElem]));
        return pos;
      },
    },
  ],
  wrap: wrappedTexParser(inlineMathContentTagName),
};

const blockMathConfig: MarkdownConfig = {
  defineNodes: [
    { name: blockMathTagName, style: mathTag },
    { name: blockMathContentTagName },
  ],
  parseBlock: [
    {
      name: blockMathTagName,
      before: 'Blockquote',
      parse(cx: BlockContext, line: Line): boolean {
        const startMatch = mathBlockStartRegex.exec(line.text);
        if (!startMatch) return false;

        const delimLen = 2;
        const start = cx.lineStart + startMatch[0].length;

        const sameLineEnd = mathBlockEndRegex.exec(
          line.text.substring(startMatch[0].length),
        );

        let stop: number;
        if (sameLineEnd) {
          stop = cx.lineStart + line.text.length - sameLineEnd[0].length;
        } else {
          let hadNextLine = false;
          let endMatch: RegExpExecArray | null = null;
          do {
            hadNextLine = cx.nextLine();
            endMatch = hadNextLine ? mathBlockEndRegex.exec(line.text) : null;
          } while (hadNextLine && !endMatch);

          stop =
            hadNextLine && endMatch
              ? cx.lineStart + line.text.length - endMatch[0].length
              : cx.lineStart;
        }

        const lineEnd = cx.lineStart + line.text.length;
        const contentElem = cx.elt(blockMathContentTagName, start, stop);
        cx.addElement(
          cx.elt(blockMathTagName, start - delimLen, Math.min(lineEnd, stop + delimLen), [
            contentElem,
          ]),
        );
        cx.nextLine();
        return true;
      },
      endLeaf(_cx: BlockContext, line: Line, _leaf: LeafBlock): boolean {
        return mathBlockStartRegex.test(line.text);
      },
    },
  ],
  wrap: wrappedTexParser(blockMathContentTagName),
};

export const markdownMathExtension: MarkdownExtension = [
  inlineMathConfig,
  blockMathConfig,
];
