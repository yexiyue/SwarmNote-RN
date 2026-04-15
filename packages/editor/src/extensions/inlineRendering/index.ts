import type { Extension } from '@codemirror/state';
import { makeInlineReplaceExtension } from './makeInlineReplaceExtension';
import { replaceCheckboxes } from './replaceCheckboxes';
import { replaceBulletLists } from './replaceBulletLists';
import { replaceDividers } from './replaceDividers';
import { replaceFormatCharacters } from './replaceFormatCharacters';
import { replaceBackslashEscapes } from './replaceBackslashEscapes';
import { inlineHtmlTheme, replaceInlineHtml, styleInlineHtmlContent } from './replaceInlineHtml';
import { addFormattingClasses, formattingClassesTheme } from './addFormattingClasses';
import { mathTheme, replaceMathFormulas } from './replaceMathFormulas';
import { inlineRenderingTheme } from './inlineRenderingTheme';

export interface InlineRenderingOptions {
  mathRendering?: boolean;
}

export function createInlineRenderingExtension(
  options: InlineRenderingOptions = {},
): Extension {
  const specs = [
    replaceCheckboxes,
    replaceBulletLists,
    replaceDividers,
    replaceFormatCharacters,
    replaceBackslashEscapes,
    replaceInlineHtml,
    styleInlineHtmlContent,
    addFormattingClasses,
    ...(options.mathRendering ? [replaceMathFormulas] : []),
  ];

  return [
    inlineRenderingTheme,
    inlineHtmlTheme,
    formattingClassesTheme,
    ...(options.mathRendering ? [mathTheme] : []),
    makeInlineReplaceExtension(specs),
  ];
}

export { makeInlineReplaceExtension } from './makeInlineReplaceExtension';
export type { InlineRenderingSpec, ReplacementExtension, RevealStrategy } from './types';
