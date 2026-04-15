import type { InlineRenderingSpec } from './types';
import { BulletWidget } from './widgets/BulletWidget';

export const replaceBulletLists: InlineRenderingSpec = {
  nodeNames: ['ListMark'],
  extension: {
    createDecoration(node, state, parentTags) {
      const bulletListDepth = parentTags.get('BulletList') ?? 0;
      if (bulletListDepth === 0) return null;

      // Skip if this is a checklist item (TaskMarker follows ListMark)
      const lineText = state.doc.lineAt(node.from).text;
      if (/^\s*[-*]\s\[[ xX]\]/.test(lineText)) return null;

      return new BulletWidget(bulletListDepth - 1);
    },
    getRevealStrategy() {
      return 'line';
    },
  },
};
