/**
 * Editor Theme Factory
 *
 * 根据 EditorThemeConfig 生成 CM6 EditorView.theme()。
 * 深色/浅色各有一套默认配色（蜂巢纸笺品牌色），可被 colors 覆盖。
 */
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorThemeConfig } from '../types';

// 蜂巢纸笺品牌配色 — 与 global.css 保持一致
const lightDefaults = {
  background: 'hsl(40, 18%, 99%)',
  foreground: 'hsl(28, 10%, 14%)',
  selection: 'hsl(40, 72%, 46%, 0.2)',
  activeLine: 'hsl(40, 18%, 96%)',
  border: 'hsl(30, 10%, 87%)',
  codeBackground: 'hsl(33, 10%, 92%)',
  heading: 'hsl(28, 10%, 14%)',
  link: 'hsl(40, 72%, 46%)',
  // Code syntax — VS Code Light+ style
  comment: '#008000',
  keyword: '#0000FF',
  string: '#A31515',
  number: '#098658',
  bool: '#0000FF',
  variableName: '#001080',
  definition: '#795E26',
  typeName: '#267F99',
  className: '#267F99',
  propertyName: '#001080',
  operator: '#000000',
  punctuation: '#000000',
  meta: '#795E26',
  atom: '#0000FF',
  namespace: '#267F99',
};

const darkDefaults = {
  background: 'hsl(25, 6%, 10%)',
  foreground: 'hsl(36, 10%, 93%)',
  selection: 'hsl(40, 72%, 52%, 0.25)',
  activeLine: 'hsl(24, 5%, 14%)',
  border: 'hsl(25, 4%, 22%)',
  codeBackground: 'hsl(25, 4%, 17%)',
  heading: 'hsl(36, 10%, 93%)',
  link: 'hsl(40, 72%, 52%)',
  // Code syntax — VS Code Dark+ style
  comment: '#6A9955',
  keyword: '#569CD6',
  string: '#CE9178',
  number: '#B5CEA8',
  bool: '#569CD6',
  variableName: '#9CDCFE',
  definition: '#DCDCAA',
  typeName: '#4EC9B0',
  className: '#4EC9B0',
  propertyName: '#9CDCFE',
  operator: '#D4D4D4',
  punctuation: '#D4D4D4',
  meta: '#DCDCAA',
  atom: '#569CD6',
  namespace: '#4EC9B0',
};

export function createEditorTheme(config: EditorThemeConfig): Extension {
  const isDark = config.appearance === 'dark';
  const defaults = isDark ? darkDefaults : lightDefaults;
  const c = { ...defaults, ...config.colors };
  const fontFamily = config.fontFamily ?? 'system-ui, sans-serif';
  const fontSize = config.fontSize ?? 16;

  return EditorView.theme(
    {
      '&': {
        color: c.foreground,
        backgroundColor: c.background,
        fontFamily,
        fontSize: `${fontSize}px`,
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-content': {
        caretColor: c.foreground,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: c.foreground,
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: c.selection,
      },
      '.cm-activeLine': {
        backgroundColor: c.activeLine,
      },
      '.cm-gutters': {
        backgroundColor: c.background,
        color: c.comment,
        borderRight: `1px solid ${c.border}`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: c.activeLine,
      },
      // Markdown decorations
      '.cm-headerLine': {
        color: c.heading,
      },
      '.cm-inlineCode': {
        backgroundColor: c.codeBackground,
      },
      '.cm-codeBlock': {
        backgroundColor: c.codeBackground,
      },
      '.cm-url': {
        color: c.link,
      },
      '.cm-blockQuote': {
        borderLeftColor: c.border,
      },
      // Syntax highlighting overrides
      '.tok-keyword': { color: c.keyword },
      '.tok-string, .tok-string2': { color: c.string },
      '.tok-comment': { color: c.comment },
      '.tok-link': { color: c.link },
      '.tok-number': { color: c.number },
      '.tok-bool': { color: c.bool },
      '.tok-variableName': { color: c.variableName },
      '.tok-definition': { color: c.definition },
      '.tok-typeName': { color: c.typeName },
      '.tok-className': { color: c.className },
      '.tok-propertyName': { color: c.propertyName },
      '.tok-operator': { color: c.operator },
      '.tok-punctuation': { color: c.punctuation },
      '.tok-meta': { color: c.meta },
      '.tok-atom': { color: c.atom },
      '.tok-namespace': { color: c.namespace },
    },
    { dark: isDark },
  );
}
