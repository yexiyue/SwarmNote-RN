/**
 * Block Code Rendering (Obsidian-style)
 *
 * Fence 行（```lang / ```）在光标不在代码块时替换为 Header/Footer Widget。
 * 代码内容行始终保留在 CM6 文档流中，Lezer 语法高亮直接生效。
 * 光标进入代码块时 reveal 原始 fence 行。
 *
 * 使用 StateField 因为 Decoration.replace 影响垂直布局。
 */
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

function extractLanguage(state: EditorState, fenceLineFrom: number, fenceLineTo: number): string {
  const text = state.sliceDoc(fenceLineFrom, fenceLineTo);
  const match = text.match(/^`{3,}\s*(\S+)?/);
  return match?.[1] ?? '';
}

function extractCodeContent(state: EditorState, codeBlockFrom: number, codeBlockTo: number): string {
  const fullText = state.sliceDoc(codeBlockFrom, codeBlockTo);
  const lines = fullText.split('\n');
  // Remove first (opening fence) and last (closing fence) lines
  if (lines.length >= 2) {
    return lines.slice(1, -1).join('\n');
  }
  return '';
}

class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly codeFrom: number,
    private readonly codeTo: number,
  ) {
    super();
  }

  eq(other: CodeBlockHeaderWidget): boolean {
    return this.language === other.language
      && this.codeFrom === other.codeFrom
      && this.codeTo === other.codeTo;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-header';

    if (this.language) {
      const label = document.createElement('span');
      label.className = 'cm-codeblock-lang';
      label.textContent = this.language;
      container.appendChild(label);
    }

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    container.appendChild(spacer);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-codeblock-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.type = 'button';

    const codeFrom = this.codeFrom;
    const codeTo = this.codeTo;
    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = extractCodeContent(view.state, codeFrom, codeTo);
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1500);
      });
    });

    container.appendChild(copyBtn);

    // Click on header → move cursor to first code line
    container.addEventListener('mousedown', (e) => {
      if (e.target === copyBtn) return;
      e.preventDefault();
      const firstCodeLine = view.state.doc.lineAt(codeFrom);
      // Move to the line after the opening fence
      const nextLine = firstCodeLine.number < view.state.doc.lines
        ? view.state.doc.line(firstCodeLine.number + 1)
        : firstCodeLine;
      view.dispatch({
        selection: { anchor: nextLine.from },
        scrollIntoView: true,
      });
      view.focus();
    });

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class CodeBlockFooterWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-footer';
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function isCursorInRange(state: EditorState, from: number, to: number): boolean {
  for (const range of state.selection.ranges) {
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}

function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'FencedCode') return;

      const cursorInside = isCursorInRange(state, node.from, node.to);

      // Find the opening fence line and closing fence line
      const firstLine = state.doc.lineAt(node.from);
      const lastLine = state.doc.lineAt(node.to);

      if (!cursorInside) {
        // Replace opening fence line with header widget
        const language = extractLanguage(state, firstLine.from, firstLine.to);
        decorations.push(
          Decoration.replace({
            widget: new CodeBlockHeaderWidget(language, node.from, node.to),
            block: true,
          }).range(firstLine.from, firstLine.to),
        );

        // Replace closing fence line with footer widget (if it's a separate line)
        if (lastLine.number > firstLine.number) {
          const lastLineText = state.sliceDoc(lastLine.from, lastLine.to);
          if (/^`{3,}\s*$/.test(lastLineText)) {
            decorations.push(
              Decoration.replace({
                widget: new CodeBlockFooterWidget(),
                block: true,
              }).range(lastLine.from, lastLine.to),
            );
          }
        }
      }

      // Add line decoration for all lines in the code block (background)
      for (let pos = firstLine.from; pos <= node.to;) {
        const line = state.doc.lineAt(pos);
        decorations.push(
          Decoration.line({ class: 'cm-codeblock-line' }).range(line.from),
        );
        pos = line.to + 1;
      }
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from), true);
}

const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured || tr.selection) {
      return buildCodeBlockDecorations(tr.state);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const codeBlockTheme = EditorView.theme({
  '.cm-codeblock-line': {
    backgroundColor: 'rgba(127, 127, 127, 0.08)',
  },
  '.cm-codeblock-header': {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px',
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    borderRadius: '6px 6px 0 0',
    fontSize: '0.85em',
    fontFamily: 'monospace',
  },
  '.cm-codeblock-lang': {
    color: 'rgba(127, 127, 127, 0.8)',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  '.cm-codeblock-copy': {
    border: 'none',
    background: 'transparent',
    color: 'rgba(127, 127, 127, 0.6)',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.85em',
    fontFamily: 'inherit',
    '&:hover': {
      backgroundColor: 'rgba(127, 127, 127, 0.15)',
      color: 'rgba(127, 127, 127, 0.9)',
    },
  },
  '.cm-codeblock-footer': {
    height: '4px',
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    borderRadius: '0 0 6px 6px',
  },
});

export function createBlockCodeExtension() {
  return [codeBlockTheme, codeBlockField];
}
