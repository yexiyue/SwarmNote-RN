import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { InlineRenderingSpec, ReplacementExtension } from './types';
import { shouldReveal } from './revealStrategy';

interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
}

export function makeInlineReplaceExtension(
  specs: InlineRenderingSpec[],
): Extension {
  const specMap = new Map<string, ReplacementExtension>();
  for (const spec of specs) {
    for (const name of spec.nodeNames) {
      specMap.set(name, spec.extension);
    }
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const entries: DecorationEntry[] = [];
        const parentTags = new Map<string, number>();

        for (const { from, to } of view.visibleRanges) {
          ensureSyntaxTree(view.state, to)?.iterate({
            from,
            to,
            enter(node) {
              const currentDepth = parentTags.get(node.name) ?? 0;
              parentTags.set(node.name, currentDepth + 1);

              const spec = specMap.get(node.name);
              if (!spec) return;

              const strategy = spec.getRevealStrategy?.(node, view.state) ?? 'line';
              const hideOnSelection = spec.hideWhenContainsSelection ?? true;

              const rangeOverride = spec.getDecorationRange?.(node, view.state);
              let decoFrom: number;
              let decoTo: number;

              if (rangeOverride) {
                decoFrom = rangeOverride[0];
                decoTo = rangeOverride.length === 2 ? rangeOverride[1] : rangeOverride[0];
              } else {
                decoFrom = node.from;
                decoTo = node.to;
              }

              if (hideOnSelection && shouldReveal(view.state, decoFrom, decoTo, strategy)) {
                return;
              }

              const result = spec.createDecoration(node, view.state, parentTags);
              if (!result) return;

              let decoration: Decoration;
              if (result instanceof WidgetType) {
                if (decoFrom === decoTo) {
                  decoration = Decoration.widget({ widget: result, side: 1 });
                } else {
                  decoration = Decoration.replace({ widget: result });
                }
              } else {
                decoration = result;
              }

              entries.push({ from: decoFrom, to: decoTo, decoration });
            },
            leave(node) {
              const depth = parentTags.get(node.name);
              if (depth !== undefined) {
                if (depth <= 1) {
                  parentTags.delete(node.name);
                } else {
                  parentTags.set(node.name, depth - 1);
                }
              }
            },
          });
        }

        entries.sort((a, b) => a.from - b.from || a.to - b.to);

        const builder = new RangeSetBuilder<Decoration>();
        for (const entry of entries) {
          builder.add(entry.from, entry.to, entry.decoration);
        }
        return builder.finish();
      }
    },
    {
      decorations: (value) => value.decorations,
    },
  );
}
