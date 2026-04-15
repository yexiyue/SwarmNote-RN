import { ensureSyntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { DEFAULT_SELECTION_FORMATTING, type SelectionFormatting } from '../types';

/**
 * Walk the syntax tree at the cursor to determine active formatting.
 * Resolves the deepest node at the cursor, then walks up through parents.
 */
export function computeSelectionFormatting(state: EditorState): SelectionFormatting {
  const result = { ...DEFAULT_SELECTION_FORMATTING };
  const pos = state.selection.main.from;

  const tree = ensureSyntaxTree(state, pos);
  if (!tree) return result;

  let cursor: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, -1);

  while (cursor) {
    switch (cursor.name) {
      case 'StrongEmphasis':
        result.bold = true;
        break;
      case 'Emphasis':
        result.italic = true;
        break;
      case 'InlineCode':
        result.code = true;
        break;
      case 'Strikethrough':
        result.strikethrough = true;
        break;
      case 'Highlight':
        result.highlight = true;
        break;
      case 'ATXHeading1':
      case 'SetextHeading1':
        result.heading = 1;
        break;
      case 'ATXHeading2':
      case 'SetextHeading2':
        result.heading = 2;
        break;
      case 'ATXHeading3':
        result.heading = 3;
        break;
      case 'ATXHeading4':
        result.heading = 4;
        break;
      case 'ATXHeading5':
        result.heading = 5;
        break;
      case 'ATXHeading6':
        result.heading = 6;
        break;
      case 'BulletList':
        if (!result.listType) {
          result.listType = 'unordered';
        }
        result.listLevel++;
        break;
      case 'OrderedList':
        if (!result.listType) {
          result.listType = 'ordered';
        }
        result.listLevel++;
        break;
      case 'Task':
        result.listType = 'check';
        break;
      case 'Blockquote':
        result.inBlockquote = true;
        break;
      case 'FencedCode':
      case 'CodeBlock':
        result.inCodeBlock = true;
        break;
    }

    cursor = cursor.parent;
  }

  return result;
}
