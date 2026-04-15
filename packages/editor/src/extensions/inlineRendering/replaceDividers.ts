import type { InlineRenderingSpec } from './types';
import { DividerWidget } from './widgets/DividerWidget';

export const replaceDividers: InlineRenderingSpec = {
  nodeNames: ['HorizontalRule'],
  extension: {
    createDecoration() {
      return new DividerWidget();
    },
    getRevealStrategy() {
      return 'line';
    },
  },
};
