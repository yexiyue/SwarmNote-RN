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
  comment: 'hsl(25, 6%, 46%)',
  keyword: 'hsl(210, 22%, 38%)',
  string: 'hsl(152, 45%, 40%)',
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
  comment: 'hsl(20, 4%, 55%)',
  keyword: 'hsl(210, 40%, 65%)',
  string: 'hsl(152, 40%, 55%)',
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
    },
    { dark: isDark },
  );
}
