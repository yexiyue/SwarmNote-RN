import type { EditorState } from '@codemirror/state';
import type { Decoration, WidgetType } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';

export type RevealStrategy = 'line' | 'select' | 'active';

export interface ReplacementExtension {
  createDecoration(
    node: SyntaxNodeRef,
    state: EditorState,
    parentTags: ReadonlyMap<string, number>,
  ): Decoration | WidgetType | null;

  getDecorationRange?(
    node: SyntaxNodeRef,
    state: EditorState,
  ): [number] | [number, number] | null;

  /** Default: true — hide decoration when selection intersects */
  hideWhenContainsSelection?: boolean;

  /** Default: 'line' */
  getRevealStrategy?(
    node: SyntaxNodeRef,
    state: EditorState,
  ): RevealStrategy | boolean;
}

export interface InlineRenderingSpec {
  nodeNames: string[];
  extension: ReplacementExtension;
}
