/**
 * Block Image Rendering
 *
 * 将独占一行的 `![alt](url)` 渲染为实际的 <img> 元素。
 * 当光标在图片所在行时，显示原始 Markdown 文本。
 *
 * 参考 Joplin renderBlockImages.ts，简化为只处理标准 Markdown 图像。
 */
import { ensureSyntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';

const imageClassName = 'cm-md-image';


class ImageHeightCache {
  private readonly cache = new Map<string, number>();
  private readonly maxEntries = 500;

  get(key: string): number | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, height: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, height);
  }
}

const heightCache = new ImageHeightCache();


class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt;
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.classList.add(imageClassName);

    const cached = heightCache.get(this.src);
    if (cached) {
      container.style.minHeight = `${cached}px`;
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;

    img.onload = () => {
      if (container.isConnected) {
        heightCache.set(this.src, container.offsetHeight);
      }
      container.style.minHeight = '';
    };

    img.onerror = () => {
      container.style.minHeight = '';
      img.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.className = `${imageClassName}-fallback`;
      fallback.textContent = this.alt || 'Image failed to load';
      container.appendChild(fallback);
    };

    container.appendChild(img);

    // Click → move cursor to image line
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pos = Math.min(view.posAtDOM(container), view.state.doc.length);
      view.dispatch({
        selection: { anchor: view.state.doc.lineAt(pos).from },
        scrollIntoView: false,
      });
    });

    return container;
  }

  get estimatedHeight() {
    return heightCache.get(this.src) ?? -1;
  }

  ignoreEvent() {
    return true;
  }
}


const blockImageTheme = EditorView.theme({
  [`& .${imageClassName}`]: {
    padding: '4px 0',
  },
  [`& .${imageClassName} > img`]: {
    maxWidth: '100%',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    borderRadius: '4px',
  },
  [`& .${imageClassName}-fallback`]: {
    display: 'block',
    padding: '8px 12px',
    color: 'rgba(127, 127, 127, 0.8)',
    fontStyle: 'italic',
    fontSize: '0.9em',
  },
});


interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
}

function buildDecorations(view: EditorView): DecorationSet {
  const entries: DecorationEntry[] = [];
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

  for (const { from, to } of view.visibleRanges) {
    ensureSyntaxTree(view.state, to)?.iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Image') return;

        const lineFrom = view.state.doc.lineAt(node.from);
        const lineTo = view.state.doc.lineAt(node.to);

        // Only render block-level images (alone on a line)
        const textBefore = view.state.sliceDoc(lineFrom.from, node.from);
        const textAfter = view.state.sliceDoc(node.to, lineTo.to);
        if (textBefore.trim() !== '' || textAfter.trim() !== '') return;

        // Reveal when cursor is on this line
        if (cursorLine >= lineFrom.number && cursorLine <= lineTo.number) return;

        // Parse ![alt](url)
        const nodeText = view.state.sliceDoc(node.from, node.to);
        const match = nodeText.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (!match) return;

        const alt = match[1];
        const src = match[2];

        entries.push({
          from: lineFrom.from,
          to: lineTo.to,
          decoration: Decoration.replace({
            widget: new ImageWidget(src, alt),
            block: true,
          }),
        });
      },
    });
  }

  entries.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.decoration);
  }
  return builder.finish();
}

const blockImagePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private lastCursorLine = -1;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      this.lastCursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.lastCursorLine = update.state.doc.lineAt(update.state.selection.main.head).number;
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const newLine = update.state.doc.lineAt(update.state.selection.main.head).number;
        if (newLine !== this.lastCursorLine) {
          this.lastCursorLine = newLine;
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);


export function createBlockImageExtension(): Extension {
  return [blockImageTheme, blockImagePlugin];
}
