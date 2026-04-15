import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const lineDecorations: Record<string, Decoration> = {
  Blockquote: Decoration.line({ attributes: { class: 'cm-blockQuote' } }),
  OrderedList: Decoration.line({ attributes: { class: 'cm-orderedList' } }),
  BulletList: Decoration.line({ attributes: { class: 'cm-unorderedList' } }),
  ListItem: Decoration.line({ attributes: { class: 'cm-listItem' } }),
  FencedCode: Decoration.line({ attributes: { class: 'cm-codeBlock' } }),
  CodeBlock: Decoration.line({ attributes: { class: 'cm-codeBlock' } }),
  SetextHeading1: Decoration.line({ attributes: { class: 'cm-h1 cm-headerLine cm-header' } }),
  ATXHeading1: Decoration.line({ attributes: { class: 'cm-h1 cm-headerLine cm-header' } }),
  SetextHeading2: Decoration.line({ attributes: { class: 'cm-h2 cm-headerLine cm-header' } }),
  ATXHeading2: Decoration.line({ attributes: { class: 'cm-h2 cm-headerLine cm-header' } }),
  ATXHeading3: Decoration.line({ attributes: { class: 'cm-h3 cm-headerLine cm-header' } }),
  ATXHeading4: Decoration.line({ attributes: { class: 'cm-h4 cm-headerLine cm-header' } }),
  ATXHeading5: Decoration.line({ attributes: { class: 'cm-h5 cm-headerLine cm-header' } }),
  ATXHeading6: Decoration.line({ attributes: { class: 'cm-h6 cm-headerLine cm-header' } }),
};

const markDecorations: Record<string, Decoration> = {
  InlineCode: Decoration.mark({ attributes: { class: 'cm-inlineCode', spellcheck: 'false' } }),
  URL: Decoration.mark({ attributes: { class: 'cm-url', spellcheck: 'false' } }),
  TaskMarker: Decoration.mark({ attributes: { class: 'cm-taskMarker' } }),
  HorizontalRule: Decoration.mark({ attributes: { class: 'cm-hr' } }),
  Highlight: Decoration.mark({ attributes: { class: 'cm-highlighted' } }),
};

const markdownTheme = EditorView.theme({
  '.cm-headerLine': {
    fontWeight: '700',
  },
  '.cm-h1': {
    fontSize: '1.6em',
  },
  '.cm-h2': {
    fontSize: '1.4em',
  },
  '.cm-h3': {
    fontSize: '1.25em',
  },
  '.cm-h4, .cm-h5, .cm-h6': {
    fontSize: '1.1em',
  },
  '.cm-inlineCode': {
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  '.cm-codeBlock': {
    backgroundColor: 'rgba(127, 127, 127, 0.08)',
  },
  '.cm-blockQuote': {
    borderLeft: '3px solid rgba(127, 127, 127, 0.35)',
    color: 'rgba(127, 127, 127, 0.95)',
    paddingLeft: '12px',
  },
  '.cm-url': {
    textDecoration: 'underline',
  },
  '.cm-taskMarker': {
    fontWeight: '700',
  },
  '.cm-highlighted': {
    backgroundColor: 'rgba(255, 214, 10, 0.35)',
    borderRadius: '2px',
  },
});

type DecorationDescription = {
  from: number;
  to: number;
  decoration: Decoration;
};

function pushLineDecorations(
  decorations: DecorationDescription[],
  view: EditorView,
  from: number,
  to: number,
  decoration: Decoration,
) {
  let position = from;
  while (position <= to) {
    const line = view.state.doc.lineAt(position);
    decorations.push({
      from: line.from,
      to: line.from,
      decoration,
    });
    position = line.to + 1;
  }
}

function computeDecorations(view: EditorView): DecorationSet {
  const decorations: DecorationDescription[] = [];

  for (const { from, to } of view.visibleRanges) {
    ensureSyntaxTree(view.state, to)?.iterate({
      from,
      to,
      enter(node) {
        const visibleFrom = Math.max(from, node.from);
        const visibleTo = Math.min(to, node.to);

        const lineDecoration = lineDecorations[node.name];
        if (lineDecoration) {
          pushLineDecorations(decorations, view, visibleFrom, visibleTo, lineDecoration);
        }

        const markDecoration = markDecorations[node.name];
        if (markDecoration && visibleFrom < visibleTo) {
          decorations.push({
            from: visibleFrom,
            to: visibleTo,
            decoration: markDecoration,
          });
        }
      },
    });
  }

  decorations.sort((left, right) => {
    const fromDiff = left.from - right.from;
    if (fromDiff !== 0) {
      return fromDiff;
    }

    return left.to - right.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const decoration of decorations) {
    builder.add(decoration.from, decoration.to, decoration.decoration);
  }

  return builder.finish();
}

const markdownDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = computeDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

export function createMarkdownDecorationExtension(): Extension {
  return [markdownTheme, markdownDecorationPlugin];
}
