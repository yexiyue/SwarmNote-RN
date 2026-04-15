import type { Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import type { EditorCollaborationConfig } from '../types';

export function createCollaborationExtension(
  collaboration?: EditorCollaborationConfig,
): Extension[] {
  if (!collaboration) {
    return [];
  }

  const ydoc = collaboration.ydoc as Y.Doc;
  const ytext = ydoc.getText(collaboration.fragmentName ?? 'document');

  return [yCollab(ytext, null)];
}
