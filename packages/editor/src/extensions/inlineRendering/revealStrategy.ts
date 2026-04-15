import type { EditorState } from '@codemirror/state';
import type { RevealStrategy } from './types';

/**
 * Determine if a decoration at [from, to] should be revealed (hidden),
 * showing the raw Markdown instead of the widget.
 */
export function shouldReveal(
  state: EditorState,
  from: number,
  to: number,
  strategy: RevealStrategy | boolean,
): boolean {
  if (typeof strategy === 'boolean') return strategy;

  const selection = state.selection.main;

  switch (strategy) {
    case 'line': {
      const cursorLine = state.doc.lineAt(selection.head).number;
      const fromLine = state.doc.lineAt(from).number;
      const toLine = state.doc.lineAt(to).number;
      return cursorLine >= fromLine && cursorLine <= toLine;
    }
    case 'select':
      return selection.from < to && selection.to > from;
    case 'active':
      return selection.head >= from && selection.head <= to;
  }
}
