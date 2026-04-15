/**
 * Markdown Front Matter Extension
 *
 * Lezer 语法扩展，识别文档开头的 YAML front matter：
 * ---
 * title: My Document
 * ---
 *
 * 使用 @codemirror/legacy-modes/mode/yaml 对内容区域做 YAML 语法高亮。
 * 参考 Joplin markdownFrontMatterExtension.ts。
 */
import { Tag } from '@lezer/highlight';
import { parseMixed, type SyntaxNodeRef, type Input, type NestedParse, type ParseWrapper } from '@lezer/common';
import type {
  MarkdownConfig,
  BlockContext,
  Line,
  LeafBlock,
  MarkdownExtension,
} from '@lezer/markdown';
import { StreamLanguage } from '@codemirror/language';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';

export const frontMatterTagName = 'FrontMatter';
export const frontMatterContentTagName = 'FrontMatterContent';
export const frontMatterMarkerTagName = 'FrontMatterMarker';

export const frontMatterTag = Tag.define();

const yamlLanguage = StreamLanguage.define(yaml);

const wrappedYamlParser = (nodeTag: string): ParseWrapper => {
  return parseMixed((node: SyntaxNodeRef, _input: Input): NestedParse | null => {
    if (node.name !== nodeTag) return null;
    return { parser: yamlLanguage.parser };
  });
};

const frontMatterDelimiterRegex = /^---\s*$/;

const frontMatterConfig: MarkdownConfig = {
  defineNodes: [
    { name: frontMatterTagName, style: frontMatterTag },
    { name: frontMatterContentTagName },
    { name: frontMatterMarkerTagName, style: frontMatterTag },
  ],
  parseBlock: [
    {
      name: frontMatterTagName,
      before: 'HorizontalRule',
      parse(cx: BlockContext, line: Line): boolean {
        if (cx.lineStart !== 0) return false;
        if (!frontMatterDelimiterRegex.test(line.text)) return false;

        const openingMarkerStart = cx.lineStart;
        const openingMarkerEnd = cx.lineStart + line.text.length;
        const contentStart = openingMarkerEnd + 1;

        let foundEnd = false;
        while (cx.nextLine()) {
          if (frontMatterDelimiterRegex.test(line.text)) {
            foundEnd = true;
            break;
          }
        }

        const contentEnd = cx.lineStart;
        const openingMarkerElem = cx.elt(frontMatterMarkerTagName, openingMarkerStart, openingMarkerEnd);
        const contentElem = cx.elt(frontMatterContentTagName, contentStart, contentEnd);

        if (foundEnd) {
          const closingMarkerEnd = cx.lineStart + line.text.length;
          const closingMarkerElem = cx.elt(frontMatterMarkerTagName, cx.lineStart, closingMarkerEnd);
          cx.addElement(
            cx.elt(frontMatterTagName, 0, closingMarkerEnd, [
              openingMarkerElem,
              contentElem,
              closingMarkerElem,
            ]),
          );
          cx.nextLine();
        } else {
          cx.addElement(
            cx.elt(frontMatterTagName, 0, contentEnd, [openingMarkerElem, contentElem]),
          );
        }

        return true;
      },
      endLeaf(_cx: BlockContext, line: Line, _leaf: LeafBlock): boolean {
        return frontMatterDelimiterRegex.test(line.text);
      },
    },
  ],
  wrap: wrappedYamlParser(frontMatterContentTagName),
};

export const markdownFrontMatterExtension: MarkdownExtension = [frontMatterConfig];
