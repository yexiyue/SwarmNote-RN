/**
 * Editable Block Table Rendering
 *
 * 将 Markdown 表格渲染为可直接编辑的 HTML <table>。
 * 单元格使用 contentEditable，编辑内容通过 onInput 实时同步回 Markdown。
 * 支持操作按钮（添加/删除行列、列对齐切换）和 Tab/Escape 键盘导航。
 *
 * 使用 StateField 因为 block widget 影响垂直布局。
 */
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

// ─── Types ──────────────────────────────────────────────────────

type Alignment = 'left' | 'center' | 'right' | null;

interface TableData {
  headers: string[];
  alignments: Alignment[];
  rows: string[][];
}

// ─── Markdown Parsing ───────────────────────────────────────────

function parseRow(line: string): string[] {
  const placeholder = '\x00PIPE\x00';
  const escaped = line.replace(/\\\|/g, placeholder);
  const cells = escaped.split('|');

  if (cells.length > 0 && cells[0].trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();

  return cells.map((cell) => cell.replace(new RegExp(placeholder, 'g'), '|').trim());
}

function parseAlignment(cell: string): Alignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseMarkdownTable(source: string): TableData | null {
  const lines = source.split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;

  const headerCells = parseRow(lines[0]);
  if (headerCells.length === 0) return null;

  const separatorCells = parseRow(lines[1]);
  if (!isSeparatorRow(separatorCells)) return null;
  if (headerCells.length !== separatorCells.length) return null;

  const alignments = separatorCells.map(parseAlignment);

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rowCells = parseRow(lines[i]);
    rows.push(headerCells.map((_, idx) => rowCells[idx] ?? ''));
  }

  return { headers: headerCells, alignments, rows };
}

// ─── Markdown Generation ────────────────────────────────────────

/** CJK characters count as 2 display-width units */
function displayWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    width += str.charCodeAt(i) > 0xFF ? 2 : 1;
  }
  return width;
}

function padCell(content: string, width: number): string {
  const dw = displayWidth(content);
  const padding = Math.max(0, width - dw);
  return content + ' '.repeat(padding);
}

function generateSeparator(alignment: Alignment, width: number): string {
  const innerWidth = Math.max(3, width);
  switch (alignment) {
    case 'left':
      return `:${'-'.repeat(innerWidth - 1)}`;
    case 'right':
      return `${'-'.repeat(innerWidth - 1)}:`;
    case 'center':
      return `:${'-'.repeat(innerWidth - 2)}:`;
    default:
      return '-'.repeat(innerWidth);
  }
}

function generateMarkdownTable(data: TableData): string {
  const colCount = data.headers.length;

  // Calculate column widths
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxW = displayWidth(data.headers[c]);
    for (const row of data.rows) {
      maxW = Math.max(maxW, displayWidth(row[c] ?? ''));
    }
    colWidths.push(Math.max(3, maxW));
  }

  const headerLine = `| ${data.headers.map((h, i) => padCell(h, colWidths[i])).join(' | ')} |`;
  const sepLine = `| ${colWidths.map((w, i) => generateSeparator(data.alignments[i], w)).join(' | ')} |`;
  const dataLines = data.rows.map(
    (row) => `| ${row.map((cell, i) => padCell(cell ?? '', colWidths[i])).join(' | ')} |`,
  );

  return [headerLine, sepLine, ...dataLines].join('\n');
}

// ─── Alignment cycling ──────────────────────────────────────────

const alignmentCycle: (Alignment)[] = ['left', 'center', 'right', null];

function nextAlignment(current: Alignment): Alignment {
  const idx = alignmentCycle.indexOf(current);
  return alignmentCycle[(idx + 1) % alignmentCycle.length];
}

function alignmentLabel(a: Alignment): string {
  switch (a) {
    case 'left': return '←';
    case 'center': return '↔';
    case 'right': return '→';
    default: return '—';
  }
}

// ─── Editable Table Widget ──────────────────────────────────────

class EditableTableWidget extends WidgetType {
  private syncing = false;

  constructor(
    private readonly data: TableData,
    private readonly tableFrom: number,
    private readonly tableTo: number,
  ) {
    super();
  }

  eq(other: EditableTableWidget): boolean {
    if (this.tableFrom !== other.tableFrom || this.tableTo !== other.tableTo) return false;
    if (this.data.headers.length !== other.data.headers.length) return false;
    if (this.data.rows.length !== other.data.rows.length) return false;

    for (let i = 0; i < this.data.headers.length; i++) {
      if (this.data.headers[i] !== other.data.headers[i]) return false;
      if (this.data.alignments[i] !== other.data.alignments[i]) return false;
    }
    for (let i = 0; i < this.data.rows.length; i++) {
      for (let j = 0; j < this.data.headers.length; j++) {
        if (this.data.rows[i][j] !== other.data.rows[i][j]) return false;
      }
    }
    return true;
  }

  updateDOM(dom: HTMLElement, _view: EditorView): boolean {
    // If table structure (row/col count) changed, full rebuild
    const table = dom.querySelector('table');
    if (!table) return false;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return false;

    const existingHeaderCells = thead.querySelectorAll('th');
    if (existingHeaderCells.length !== this.data.headers.length) return false;

    const existingRows = tbody.querySelectorAll('tr');
    if (existingRows.length !== this.data.rows.length) return false;

    // Incremental update: skip the actively focused cell
    const focused = dom.contains(document.activeElement) ? document.activeElement : null;

    existingHeaderCells.forEach((th, idx) => {
      if (th !== focused) {
        th.textContent = this.data.headers[idx];
      }
      const align = this.data.alignments[idx];
      th.style.textAlign = align ?? '';
    });

    existingRows.forEach((tr, rowIdx) => {
      const cells = tr.querySelectorAll('td');
      cells.forEach((td, colIdx) => {
        if (td !== focused) {
          td.textContent = this.data.rows[rowIdx][colIdx] ?? '';
        }
        const align = this.data.alignments[colIdx];
        td.style.textAlign = align ?? '';
      });
    });

    // Update alignment button labels
    const alignBtns = dom.querySelectorAll('.cm-table-align-btn');
    alignBtns.forEach((btn, idx) => {
      if (idx < this.data.alignments.length) {
        btn.textContent = alignmentLabel(this.data.alignments[idx]);
      }
    });

    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-table-widget';

    // ── Toolbar ──
    const toolbar = document.createElement('div');
    toolbar.className = 'cm-table-toolbar';

    const addRowBtn = this.createToolbarButton('+ Row', () => this.addRow(view));
    const delRowBtn = this.createToolbarButton('- Row', () => this.deleteRow(view));
    const addColBtn = this.createToolbarButton('+ Col', () => this.addColumn(view));
    const delColBtn = this.createToolbarButton('- Col', () => this.deleteColumn(view));

    toolbar.append(addRowBtn, delRowBtn, addColBtn, delColBtn);
    container.appendChild(toolbar);

    // ── Alignment row ──
    const alignRow = document.createElement('div');
    alignRow.className = 'cm-table-align-row';
    this.data.alignments.forEach((a, colIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cm-table-align-btn';
      btn.textContent = alignmentLabel(a);
      btn.title = 'Toggle alignment';
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleAlignment(view, colIdx);
      });
      alignRow.appendChild(btn);
    });
    container.appendChild(alignRow);

    // ── Table ──
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this.data.headers.forEach((header, idx) => {
      const th = document.createElement('th');
      th.textContent = header;
      th.contentEditable = 'true';
      th.spellcheck = false;
      const align = this.data.alignments[idx];
      if (align) th.style.textAlign = align;
      this.attachCellListeners(th, view);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of this.data.rows) {
      const tr = document.createElement('tr');
      row.forEach((cell, idx) => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.contentEditable = 'true';
        td.spellcheck = false;
        const align = this.data.alignments[idx];
        if (align) td.style.textAlign = align;
        this.attachCellListeners(td, view);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }

  // ── Cell event listeners ──

  private attachCellListeners(cell: HTMLElement, view: EditorView) {
    cell.addEventListener('input', () => {
      if (this.syncing) return;
      this.syncToMarkdown(cell.closest('.cm-table-widget')!, view);
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.navigateCell(cell, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cell.blur();
        // Focus back to CM6 editor, cursor after table
        view.dispatch({
          selection: { anchor: Math.min(this.tableTo + 1, view.state.doc.length) },
        });
        view.focus();
      }
    });
  }

  private navigateCell(currentCell: HTMLElement, direction: 1 | -1) {
    const container = currentCell.closest('.cm-table-widget');
    if (!container) return;

    const cells = Array.from(container.querySelectorAll<HTMLElement>('th[contenteditable], td[contenteditable]'));
    const idx = cells.indexOf(currentCell);
    if (idx === -1) return;

    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = cells.length - 1;
    if (nextIdx >= cells.length) nextIdx = 0;

    cells[nextIdx].focus();
    // Select all text in the cell for easy replacement
    const range = document.createRange();
    range.selectNodeContents(cells[nextIdx]);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // ── Sync cell edits back to Markdown ──

  private collectTableData(container: HTMLElement): TableData {
    const headers: string[] = [];
    const rows: string[][] = [];

    container.querySelectorAll('thead th').forEach((th) => {
      headers.push(th.textContent ?? '');
    });

    container.querySelectorAll('tbody tr').forEach((tr) => {
      const row: string[] = [];
      tr.querySelectorAll('td').forEach((td) => {
        row.push(td.textContent ?? '');
      });
      rows.push(row);
    });

    return { headers, alignments: [...this.data.alignments], rows };
  }

  private syncToMarkdown(container: HTMLElement, view: EditorView) {
    const newData = this.collectTableData(container);
    const markdown = generateMarkdownTable(newData);

    this.syncing = true;
    view.dispatch({
      changes: { from: this.tableFrom, to: this.tableTo, insert: markdown },
    });
    // Reset guard after microtask to allow StateField update to complete
    queueMicrotask(() => { this.syncing = false; });
  }

  // ── Structural operations ──

  private dispatchStructuralChange(view: EditorView, newData: TableData) {
    const markdown = generateMarkdownTable(newData);
    this.syncing = true;
    view.dispatch({
      changes: { from: this.tableFrom, to: this.tableTo, insert: markdown },
    });
    queueMicrotask(() => { this.syncing = false; });
  }

  private addRow(view: EditorView) {
    const newData: TableData = {
      headers: [...this.data.headers],
      alignments: [...this.data.alignments],
      rows: [...this.data.rows, this.data.headers.map(() => '')],
    };
    this.dispatchStructuralChange(view, newData);
  }

  private deleteRow(view: EditorView) {
    if (this.data.rows.length === 0) return;
    const newData: TableData = {
      headers: [...this.data.headers],
      alignments: [...this.data.alignments],
      rows: this.data.rows.slice(0, -1),
    };
    this.dispatchStructuralChange(view, newData);
  }

  private addColumn(view: EditorView) {
    const newData: TableData = {
      headers: [...this.data.headers, ''],
      alignments: [...this.data.alignments, null],
      rows: this.data.rows.map((row) => [...row, '']),
    };
    this.dispatchStructuralChange(view, newData);
  }

  private deleteColumn(view: EditorView) {
    if (this.data.headers.length <= 1) return;
    const lastIdx = this.data.headers.length - 1;
    const newData: TableData = {
      headers: this.data.headers.slice(0, lastIdx),
      alignments: this.data.alignments.slice(0, lastIdx),
      rows: this.data.rows.map((row) => row.slice(0, lastIdx)),
    };
    this.dispatchStructuralChange(view, newData);
  }

  private toggleAlignment(view: EditorView, colIdx: number) {
    const newAlignments = [...this.data.alignments];
    newAlignments[colIdx] = nextAlignment(newAlignments[colIdx]);
    const newData: TableData = {
      headers: [...this.data.headers],
      alignments: newAlignments,
      rows: this.data.rows.map((row) => [...row]),
    };
    this.dispatchStructuralChange(view, newData);
  }

  // ── Toolbar button helper ──

  private createToolbarButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-table-toolbar-btn';
    btn.textContent = label;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
}

// ─── StateField ─────────────────────────────────────────────────

function buildTableDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return;

      const tableSource = state.doc.sliceString(node.from, node.to);
      const tableData = parseMarkdownTable(tableSource);
      if (!tableData) return;

      decorations.push(
        Decoration.replace({
          widget: new EditableTableWidget(tableData, node.from, node.to),
          block: true,
        }).range(node.from, node.to),
      );
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from), true);
}

const tableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured) {
      return buildTableDecorations(tr.state);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ─── Theme ──────────────────────────────────────────────────────

const blockTableTheme = EditorView.theme({
  '.cm-table-widget': {
    padding: '4px 0',
    overflowX: 'auto',
  },
  '.cm-table-toolbar': {
    display: 'flex',
    gap: '4px',
    padding: '2px 0 4px',
    opacity: '0',
    transition: 'opacity 0.15s',
  },
  '.cm-table-widget:hover .cm-table-toolbar, .cm-table-widget:focus-within .cm-table-toolbar': {
    opacity: '1',
  },
  '.cm-table-toolbar-btn': {
    border: '1px solid rgba(127, 127, 127, 0.25)',
    background: 'rgba(127, 127, 127, 0.06)',
    color: 'rgba(127, 127, 127, 0.8)',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.8em',
    fontFamily: 'inherit',
  },
  '.cm-table-align-row': {
    display: 'flex',
    gap: '0',
  },
  '.cm-table-align-btn': {
    flex: '1',
    border: '1px solid rgba(127, 127, 127, 0.2)',
    borderBottom: 'none',
    background: 'rgba(127, 127, 127, 0.04)',
    color: 'rgba(127, 127, 127, 0.6)',
    cursor: 'pointer',
    padding: '1px 4px',
    fontSize: '0.75em',
    fontFamily: 'inherit',
    textAlign: 'center',
    opacity: '0',
    transition: 'opacity 0.15s',
  },
  '.cm-table-widget:hover .cm-table-align-btn, .cm-table-widget:focus-within .cm-table-align-btn': {
    opacity: '1',
  },
  '.cm-table-widget table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.95em',
  },
  '.cm-table-widget th, .cm-table-widget td': {
    border: '1px solid rgba(127, 127, 127, 0.3)',
    padding: '6px 12px',
    outline: 'none',
    minWidth: '40px',
  },
  '.cm-table-widget th:focus, .cm-table-widget td:focus': {
    boxShadow: 'inset 0 0 0 2px rgba(64, 150, 255, 0.4)',
  },
  '.cm-table-widget th': {
    fontWeight: '700',
    backgroundColor: 'rgba(127, 127, 127, 0.08)',
  },
  '.cm-table-widget tr:nth-child(even)': {
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
  },
});

// ─── Export ─────────────────────────────────────────────────────

export function createBlockTableExtension() {
  return [blockTableTheme, tableField];
}
