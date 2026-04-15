import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { ListType } from '../types';

const bulletedRegex = /^(\s*)([-*])\s(?!\[[ xX]+\]\s)/;
const checklistRegex = /^(\s*)([-*])\s\[[ xX]+\]\s/;
const numberedRegex = /^(\s*)(\d+)\.\s/;

type AnyListMatch = RegExpMatchArray & { index: number };

interface DetectedList {
  type: ListType;
  indent: string;
  fullMatch: string;
}

function detectListType(lineText: string): DetectedList | null {
  let m: AnyListMatch | null;

  m = lineText.match(checklistRegex) as AnyListMatch | null;
  if (m) return { type: 'check', indent: m[1], fullMatch: m[0] };

  m = lineText.match(bulletedRegex) as AnyListMatch | null;
  if (m) return { type: 'unordered', indent: m[1], fullMatch: m[0] };

  m = lineText.match(numberedRegex) as AnyListMatch | null;
  if (m) return { type: 'ordered', indent: m[1], fullMatch: m[0] };

  return null;
}

function makePrefix(type: ListType, lineIndex: number): string {
  switch (type) {
    case 'unordered':
      return '- ';
    case 'check':
      return '- [ ] ';
    case 'ordered':
      return `${lineIndex + 1}. `;
  }
}

export function toggleList(view: EditorView, targetType: ListType): void {
  const { from, to } = view.state.selection.main;
  const fromLine = view.state.doc.lineAt(from);
  const toLine = view.state.doc.lineAt(to);

  const changes: { from: number; to: number; insert: string }[] = [];
  let lineIndex = 0;
  let totalDelta = 0;

  for (let pos = fromLine.from; pos <= toLine.to; ) {
    const line = view.state.doc.lineAt(pos);
    const detected = detectListType(line.text);

    if (detected && detected.type === targetType) {
      // Same type: remove list marker
      changes.push({
        from: line.from + detected.indent.length,
        to: line.from + detected.fullMatch.length,
        insert: '',
      });
      totalDelta -= detected.fullMatch.length - detected.indent.length;
    } else if (detected) {
      // Different list type: switch
      const prefix = makePrefix(targetType, lineIndex);
      changes.push({
        from: line.from + detected.indent.length,
        to: line.from + detected.fullMatch.length,
        insert: prefix,
      });
      totalDelta += prefix.length - (detected.fullMatch.length - detected.indent.length);
    } else {
      // Not a list: add marker
      const indentMatch = line.text.match(/^(\s*)/);
      const indentLen = indentMatch ? indentMatch[1].length : 0;
      const prefix = makePrefix(targetType, lineIndex);
      changes.push({
        from: line.from + indentLen,
        to: line.from + indentLen,
        insert: prefix,
      });
      totalDelta += prefix.length;
    }

    lineIndex++;
    pos = line.to + 1;
  }

  const newFrom = Math.max(fromLine.from, from + (changes[0] ? changes[0].insert.length - (changes[0].to - changes[0].from) : 0));
  view.dispatch({
    changes,
    selection: EditorSelection.cursor(Math.min(from + totalDelta, view.state.doc.length + totalDelta)),
  });
}
