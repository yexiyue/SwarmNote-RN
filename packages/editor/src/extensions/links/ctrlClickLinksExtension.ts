/**
 * Link Click Extension
 *
 * Ctrl/Cmd+Click 打开链接，长按也触发（移动端适配）。
 * 参考 Joplin ctrlClickLinksExtension.ts，简化版本。
 */
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { findLinkAtPosition } from './linkUtils';

const modifierKeyCssExtension = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key === 'Control' || event.key === 'Meta') {
      view.dom.classList.add('-ctrl-or-cmd-pressed');
    }
  },
  keyup(event, view) {
    if (event.key === 'Control' || event.key === 'Meta') {
      view.dom.classList.remove('-ctrl-or-cmd-pressed');
    }
  },
  blur(_event, view) {
    view.dom.classList.remove('-ctrl-or-cmd-pressed');
  },
});

const linkClickTheme = EditorView.theme({
  '&.-ctrl-or-cmd-pressed .cm-url': {
    cursor: 'pointer',
  },
});

export type OnLinkOpen = (url: string) => void;

export function createCtrlClickLinksExtension(
  onLinkOpen: OnLinkOpen,
): Extension {
  return [
    modifierKeyCssExtension,
    linkClickTheme,

    // Ctrl/Cmd+Click
    EditorView.domEventHandlers({
      click(event, view) {
        if (!event.ctrlKey && !event.metaKey) return false;

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        const link = findLinkAtPosition(pos, view.state);
        if (link) {
          event.preventDefault();
          onLinkOpen(link.url);
          return true;
        }
        return false;
      },
    }),

    // Long press (mobile) — 500ms threshold
    EditorView.domEventHandlers({
      touchstart(event, view) {
        if (event.touches.length !== 1) return false;

        const touch = event.touches[0];
        const startX = touch.clientX;
        const startY = touch.clientY;

        const controller = new AbortController();
        const { signal } = controller;

        const timer = setTimeout(() => {
          controller.abort();
          const pos = view.posAtCoords({ x: startX, y: startY });
          if (pos === null) return;

          const link = findLinkAtPosition(pos, view.state);
          if (link) {
            event.preventDefault();
            onLinkOpen(link.url);
          }
        }, 500);

        view.dom.addEventListener('touchend', () => { clearTimeout(timer); controller.abort(); }, { once: true, signal });
        view.dom.addEventListener('touchmove', () => { clearTimeout(timer); controller.abort(); }, { once: true, signal });

        return false;
      },
    }),
  ];
}
