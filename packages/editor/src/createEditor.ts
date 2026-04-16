import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { history, historyKeymap, indentWithTab, standardKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { languages as codeLanguages } from '@codemirror/language-data';
import { syntaxHighlighting } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { EditorView, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

import { EditorControlImpl } from './EditorControl';
import { EditorEventType } from './events';
import { computeSelectionFormatting } from './editorCommands';
import {
  createCollaborationExtension,
  createEditorSettingsExtension,
  createInlineRenderingExtension,
  createMarkdownDecorationExtension,
  createSearchExtension,
  markdownHighlightExtension,
} from './extensions';
import { createBlockCodeExtension } from './extensions/renderBlockCode';
import { createBlockImageExtension } from './extensions/renderBlockImages';
import { createBlockTableExtension } from './extensions/renderBlockTables';
import { createCtrlClickLinksExtension } from './extensions/links/ctrlClickLinksExtension';
import { createLinkTooltipExtension } from './extensions/links/linkTooltipExtension';
import { insertNewlineContinueMarkup } from './editorCommands/insertNewlineContinueMarkup';
import { markdownMathExtension } from './extensions/markdownMathExtension';
import { markdownFrontMatterExtension } from './extensions/markdownFrontMatterExtension';
import { createLineAwareClipboardExtension } from './extensions/lineAwareClipboardExtension';
import type { EditorControl, EditorProps } from './types';
import { createSelectionRange } from './utils/selection';

(EditorView as unknown as { EDIT_CONTEXT: boolean }).EDIT_CONTEXT = false;

export function createEditor(
  parent: HTMLElement,
  props: EditorProps,
): EditorControl {
  const {
    initialText,
    initialSelection,
    settings,
    initialSearchState,
    collaboration,
    onEvent,
  } = props;

  const settingsRuntime = createEditorSettingsExtension(settings);
  const markdownExtensions = [
    ...GFM,
    ...(settings.features.markdownHighlight ? [markdownHighlightExtension] : []),
    ...(settings.features.mathRendering ? [markdownMathExtension] : []),
    markdownFrontMatterExtension,
  ];

  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    closeBrackets(),
    markdown({
      base: markdownLanguage,
      extensions: markdownExtensions,
      codeLanguages,
    }),
    syntaxHighlighting(classHighlighter),
    settingsRuntime.extension,
    ...(settings.features.markdownDecorations
      ? [createMarkdownDecorationExtension()]
      : []),
    ...(settings.features.inlineRendering
      ? [createInlineRenderingExtension({
          mathRendering: settings.features.mathRendering,
        })]
      : []),
    ...(settings.features.blockImageRendering
      ? [createBlockImageExtension(), createBlockTableExtension()]
      : []),
    ...(settings.features.codeBlockWidget
      ? [createBlockCodeExtension()]
      : []),
    ...(onEvent
      ? [
          createCtrlClickLinksExtension((url) => {
            onEvent({ kind: EditorEventType.LinkOpen, url });
          }),
        ]
      : []),
    createLinkTooltipExtension(),
    createLineAwareClipboardExtension(),
    ...(settings.features.collaboration
      ? createCollaborationExtension(collaboration)
      : []),
    ...(settings.features.search
      ? [
          createSearchExtension({
            onSearchStateChange(search, source) {
              onEvent?.({
                kind: EditorEventType.SearchStateChange,
                search,
                source,
              });
            },
          }),
        ]
      : []),
    keymap.of([
      ...closeBracketsKeymap,
      { key: 'Enter', run: insertNewlineContinueMarkup },
      indentWithTab,
      ...standardKeymap,
      ...historyKeymap,
      ...(settings.features.search ? searchKeymap : []),
    ]),
  ];

  if (onEvent) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onEvent({
            kind: EditorEventType.Change,
          });
        }

        if (update.selectionSet) {
          const selection = update.state.selection.main;
          onEvent({
            kind: EditorEventType.SelectionChange,
            selection: createSelectionRange(selection.anchor, selection.head),
          });
          onEvent({
            kind: EditorEventType.SelectionFormattingChange,
            formatting: computeSelectionFormatting(update.state),
          });
        }

        if (update.focusChanged) {
          onEvent({
            kind: update.view.hasFocus ? EditorEventType.Focus : EditorEventType.Blur,
          });
        }
      }),
    );
  }

  const selection = initialSelection
    ? {
        anchor: initialSelection.anchor,
        head: initialSelection.head,
      }
    : undefined;

  const view = new EditorView({
    state: EditorState.create({
      doc: collaboration ? '' : initialText,
      selection,
      extensions,
    }),
    parent,
  });

  const control = new EditorControlImpl(view, {
    settingsRuntime,
    onDestroy: onEvent
      ? () => {
          onEvent({ kind: EditorEventType.Remove });
        }
      : undefined,
  });

  if (initialSearchState && settings.features.search) {
    control.setSearchState(initialSearchState, 'initialSearchState');
  }

  if (settings.autofocus || props.autofocus) {
    view.focus();
  }

  return control;
}

