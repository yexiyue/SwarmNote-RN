import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, dropCursor, keymap, lineNumbers } from '@codemirror/view';
import { history, historyKeymap, standardKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import { searchKeymap } from '@codemirror/search';

import type { EditorProps } from './types';
import { EditorControlImpl } from './EditorControl';
import type { EditorControl } from './types';

// Android WebView 上 EditContext API 会破坏 IME，需要禁用
// 公开 issue: https://github.com/codemirror/dev/issues/1450
// 解决方案讨论: https://discuss.codemirror.net/t/experimental-support-for-editcontext/8144/3
(EditorView as unknown as { EDIT_CONTEXT: boolean }).EDIT_CONTEXT = false;

/**
 * 创建一个 CodeMirror 6 编辑器实例。
 *
 * 平台无关：桌面端直接调用，移动端在 WebView 内调用。
 */
export function createEditor(
  parent: HTMLElement,
  props: EditorProps,
): EditorControl {
  const { initialText, settings, yjsCollab, onEvent } = props;

  const extensions: Extension[] = [
    // 基础
    history(),
    drawSelection(),
    dropCursor(),

    // Markdown
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(classHighlighter),

    // 行为
    EditorView.lineWrapping,
    EditorState.tabSize.of(settings.tabSize),
    EditorState.readOnly.of(settings.readonly),

    // 快捷键
    keymap.of([...standardKeymap, ...historyKeymap, ...searchKeymap]),
  ];

  // yjs 协作扩展（可选）
  if (yjsCollab) {
    // 动态 import 避免不用 yjs 时增加 bundle 体积
    // 调用方需要确保 yjsCollab.ydoc 是一个 Y.Doc 实例
    const { yCollab } = require('y-codemirror.next') as typeof import('y-codemirror.next');
    const Y = require('yjs') as typeof import('yjs');
    const ydoc = yjsCollab.ydoc as InstanceType<typeof Y.Doc>;
    const ytext = ydoc.getText(yjsCollab.fragmentName ?? 'document');
    extensions.push(yCollab(ytext, null));
  }

  // 事件回调
  if (onEvent) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onEvent({ kind: 'change' });
        }
        if (update.selectionSet) {
          onEvent({ kind: 'selectionChange' });
        }
        if (update.focusChanged) {
          onEvent({ kind: update.view.hasFocus ? 'focus' : 'blur' });
        }
      }),
    );
  }

  const view = new EditorView({
    state: EditorState.create({
      doc: yjsCollab ? '' : initialText, // yjs 模式下由 yCollab 管理初始内容
      extensions,
    }),
    parent,
  });

  return new EditorControlImpl(view);
}
