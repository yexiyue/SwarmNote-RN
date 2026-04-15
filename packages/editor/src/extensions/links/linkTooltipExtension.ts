/**
 * Link Tooltip Extension
 *
 * Hover 到 URL 节点时显示链接地址的 tooltip。
 */
import type { Extension } from '@codemirror/state';
import { EditorView, hoverTooltip, type Tooltip } from '@codemirror/view';
import { findLinkAtPosition } from './linkUtils';

const linkTooltipTheme = EditorView.theme({
  '.cm-link-tooltip': {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.85em',
    maxWidth: '400px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
});

function getLinkTooltip(
  view: EditorView,
  pos: number,
): Tooltip | null {
  const link = findLinkAtPosition(pos, view.state);
  if (!link) return null;

  return {
    pos: link.from,
    end: link.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-link-tooltip';
      dom.textContent = link.url;
      return { dom };
    },
  };
}

export function createLinkTooltipExtension(): Extension {
  return [
    linkTooltipTheme,
    hoverTooltip((view, pos) => getLinkTooltip(view, pos), {
      hideOnChange: true,
    }),
  ];
}
