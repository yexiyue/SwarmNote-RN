import type { InlineRenderingSpec } from './types';
import { CheckboxWidget } from './widgets/CheckboxWidget';

export const replaceCheckboxes: InlineRenderingSpec = {
  nodeNames: ['TaskMarker'],
  extension: {
    createDecoration(node, state) {
      const text = state.sliceDoc(node.from, node.to);
      const checked = /\[[xX]\]/.test(text);
      return new CheckboxWidget(checked, node.from);
    },
    getRevealStrategy() {
      return 'active';
    },
  },
};
