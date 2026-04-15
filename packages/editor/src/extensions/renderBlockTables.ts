/**
 * Block Table Rendering
 *
 * 将 Markdown 表格渲染为 HTML <table> 元素。
 * 光标在表格行范围内时显示原始 Markdown。
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
import type { SyntaxNode } from '@lezer/common';

type Alignment = 'left' | 'center' | 'right';

interface ParsedTable {
  headers: string[];
  alignments: Alignment[];
  rows: string[][];
}

function parseAlignment(delimiterText: string): Alignment[] {
  return delimiterText
    .split('|')
    .filter((s) => s.trim())
    .map((cell) => {
      const trimmed = cell.trim();
      const left = trimmed.startsWith(':');
      const right = trimmed.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    });
}

function extractCells(node: SyntaxNode, doc: string): string[] {
  const cells: string[] = [];
  let child = node.firstChild;
  while (child) {
    if (child.name === 'TableCell') {
      cells.push(doc.slice(child.from, child.to).trim());
    }
    child = child.nextSibling;
  }
  return cells;
}

function parseTable(tableNode: SyntaxNode, doc: string): ParsedTable | null {
  let headers: string[] = [];
  let alignments: Alignment[] = [];
  const rows: string[][] = [];

  let child = tableNode.firstChild;
  while (child) {
    if (child.name === 'TableHeader') {
      headers = extractCells(child, doc);
    } else if (child.name === 'TableDelimiter' && alignments.length === 0) {
      const text = doc.slice(child.from, child.to);
      alignments = parseAlignment(text);
    } else if (child.name === 'TableRow') {
      rows.push(extractCells(child, doc));
    }
    child = child.nextSibling;
  }

  if (headers.length === 0) return null;

  // Pad alignments to match header count
  while (alignments.length < headers.length) {
    alignments.push('left');
  }

  return { headers, alignments, rows };
}

class TableWidget extends WidgetType {
  constructor(private readonly table: ParsedTable) {
    super();
  }

  eq(other: TableWidget) {
    return (
      JSON.stringify(this.table.headers) === JSON.stringify(other.table.headers) &&
      JSON.stringify(this.table.rows) === JSON.stringify(other.table.rows)
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.className = 'cm-table-widget';

    const table = document.createElement('table');

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let i = 0; i < this.table.headers.length; i++) {
      const th = document.createElement('th');
      th.textContent = this.table.headers[i];
      th.style.textAlign = this.table.alignments[i] ?? 'left';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const row of this.table.rows) {
      const tr = document.createElement('tr');
      for (let i = 0; i < this.table.headers.length; i++) {
        const td = document.createElement('td');
        td.textContent = row[i] ?? '';
        td.style.textAlign = this.table.alignments[i] ?? 'left';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    container.appendChild(table);

    // Click → position cursor at table start
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

  ignoreEvent() {
    return true;
  }
}

const blockTableTheme = EditorView.theme({
  '.cm-table-widget': {
    padding: '4px 0',
    overflowX: 'auto',
  },
  '.cm-table-widget table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.95em',
  },
  '.cm-table-widget th, .cm-table-widget td': {
    border: '1px solid rgba(127, 127, 127, 0.3)',
    padding: '6px 12px',
  },
  '.cm-table-widget th': {
    fontWeight: '700',
    backgroundColor: 'rgba(127, 127, 127, 0.08)',
  },
  '.cm-table-widget tr:nth-child(even)': {
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
  },
});

interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
}

function buildDecorations(view: EditorView): DecorationSet {
  const entries: DecorationEntry[] = [];
  const doc = view.state.doc;
  const cursorLine = doc.lineAt(view.state.selection.main.head).number;

  for (const { from, to } of view.visibleRanges) {
    ensureSyntaxTree(view.state, to)?.iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Table') return;

        const tableFrom = doc.lineAt(node.from);
        const tableTo = doc.lineAt(node.to);

        // Reveal when cursor is inside the table
        if (cursorLine >= tableFrom.number && cursorLine <= tableTo.number) return;

        const parsed = parseTable(node.node, doc.toString());
        if (!parsed) return;

        entries.push({
          from: tableFrom.from,
          to: tableTo.to,
          decoration: Decoration.replace({
            widget: new TableWidget(parsed),
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

const blockTablePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private lastCursorLine = -1;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      this.lastCursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.lastCursorLine = update.state.doc.lineAt(
          update.state.selection.main.head,
        ).number;
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const newLine = update.state.doc.lineAt(
          update.state.selection.main.head,
        ).number;
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

export function createBlockTableExtension(): Extension {
  return [blockTableTheme, blockTablePlugin];
}
