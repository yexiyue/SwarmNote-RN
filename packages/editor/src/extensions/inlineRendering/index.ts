import type { Extension } from '@codemirror/state';
import { makeInlineReplaceExtension } from './makeInlineReplaceExtension';
import { replaceCheckboxes } from './replaceCheckboxes';
import { replaceBulletLists } from './replaceBulletLists';
import { replaceDividers } from './replaceDividers';
import { replaceFormatCharacters } from './replaceFormatCharacters';
import { inlineRenderingTheme } from './inlineRenderingTheme';

export function createInlineRenderingExtension(): Extension {
  return [
    inlineRenderingTheme,
    makeInlineReplaceExtension([
      replaceCheckboxes,
      replaceBulletLists,
      replaceDividers,
      replaceFormatCharacters,
    ]),
  ];
}

export { makeInlineReplaceExtension } from './makeInlineReplaceExtension';
export type { InlineRenderingSpec, ReplacementExtension, RevealStrategy } from './types';
