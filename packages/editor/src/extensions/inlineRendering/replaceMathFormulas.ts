/**
 * Math Formula Rendering
 *
 * 使用 KaTeX 渲染 InlineMath ($...$) 和 BlockMath ($$...$$) 节点。
 */
import type { EditorState } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import type { InlineRenderingSpec, RevealStrategy } from './types';

let katexModule: typeof import('katex') | null = null;

async function loadKaTeX() {
  if (!katexModule) {
    katexModule = await import('katex');
  }
  return katexModule.default ?? katexModule;
}

class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly displayMode: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return this.tex === other.tex && this.displayMode === other.displayMode;
  }

  toDOM() {
    const container = document.createElement(this.displayMode ? 'div' : 'span');
    container.className = this.displayMode ? 'cm-math-block' : 'cm-math-inline';

    void loadKaTeX().then((katex) => {
      if (!container.isConnected) return;
      try {
        katex.render(this.tex, container, {
          displayMode: this.displayMode,
          throwOnError: false,
        });
      } catch {
        container.textContent = this.tex;
        container.classList.add('cm-math-error');
      }
    });

    // Placeholder while loading
    container.textContent = this.tex;

    return container;
  }

  ignoreEvent() {
    return true;
  }
}

function extractMathContent(node: SyntaxNodeRef, state: EditorState): { tex: string; displayMode: boolean } | null {
  const text = state.sliceDoc(node.from, node.to);

  if (node.name === 'BlockMath') {
    // Strip $$ delimiters
    const inner = text.replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
    return { tex: inner, displayMode: true };
  }

  if (node.name === 'InlineMath') {
    // Strip $ delimiters
    const inner = text.slice(1, -1);
    return { tex: inner, displayMode: false };
  }

  return null;
}

export const mathTheme = EditorView.theme({
  '.cm-math-inline': {
    padding: '0 2px',
  },
  '.cm-math-block': {
    padding: '8px 0',
    textAlign: 'center',
  },
  '.cm-math-error': {
    color: 'rgba(200, 60, 60, 0.8)',
    fontStyle: 'italic',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
});

export const replaceMathFormulas: InlineRenderingSpec = {
  nodeNames: ['InlineMath', 'BlockMath'],
  extension: {
    createDecoration(node: SyntaxNodeRef, state: EditorState) {
      const result = extractMathContent(node, state);
      if (!result || !result.tex.trim()) return null;
      return new MathWidget(result.tex, result.displayMode);
    },
    getRevealStrategy(node): RevealStrategy {
      return node.name === 'BlockMath' ? 'line' : 'active';
    },
  },
};
