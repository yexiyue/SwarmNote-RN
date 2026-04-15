import { EditorView } from '@codemirror/view';

export const inlineRenderingTheme = EditorView.theme({
  '.cm-checkbox-widget': {
    cursor: 'pointer',
    verticalAlign: 'middle',
    marginRight: '4px',
    width: '16px',
    height: '16px',
  },
  '.cm-bullet-widget': {
    display: 'inline-block',
    width: '1.2em',
    textAlign: 'center',
    color: 'inherit',
    userSelect: 'none',
    fontSize: '0.7em',
    verticalAlign: 'middle',
  },
  '.cm-divider-widget': {
    border: 'none',
    borderTop: '1px solid rgba(127, 127, 127, 0.4)',
    margin: '8px 0',
  },
});
