import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { create } from "zustand";

/** UI-only state for the left FilesPanel. Lifetime = workspace. Not
 *  persisted across workspace switches — `reset()` is called on switch. */

export type DraftKind = "document" | "folder";

export interface Draft {
  kind: DraftKind;
  /** Parent folder's tree id (= its relPath). `null` means root. */
  parentRelPath: string | null;
  name: string;
  submitting: boolean;
  error: string | null;
  /** When set, this draft is a rename of the given node rather than a new
   *  node creation. Submit path dispatches to `renameNode(target, name)`
   *  instead of `createNoteAt/createFolderAt`. */
  renameTarget: UniffiFileTreeNode | null;
}

interface FilesUiState {
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  draft: Draft | null;
}

interface FilesUiActions {
  select(nodeId: string | null): void;
  toggleExpand(folderId: string): void;
  setExpanded(folderId: string, expanded: boolean): void;
  collapseAll(): void;
  startDraft(input: {
    kind: DraftKind;
    parentRelPath: string | null;
    name?: string;
    renameTarget?: UniffiFileTreeNode | null;
  }): void;
  setDraftName(name: string): void;
  setDraftSubmitting(submitting: boolean): void;
  setDraftError(error: string | null): void;
  cancelDraft(): void;
  reset(): void;
}

export const useFilesUiStore = create<FilesUiState & FilesUiActions>()((set, get) => ({
  selectedNodeId: null,
  expandedFolderIds: new Set<string>(),
  draft: null,

  select: (nodeId) => set({ selectedNodeId: nodeId }),

  toggleExpand: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),

  setExpanded: (folderId, expanded) =>
    set((s) => {
      if (s.expandedFolderIds.has(folderId) === expanded) return s;
      const next = new Set(s.expandedFolderIds);
      if (expanded) next.add(folderId);
      else next.delete(folderId);
      return { expandedFolderIds: next };
    }),

  collapseAll: () => set({ expandedFolderIds: new Set<string>() }),

  startDraft: ({ kind, parentRelPath, name = "", renameTarget = null }) => {
    // Auto-expand the parent so the inline input is visible.
    if (parentRelPath !== null) {
      const next = new Set(get().expandedFolderIds);
      next.add(parentRelPath);
      set({ expandedFolderIds: next });
    }
    set({
      draft: { kind, parentRelPath, name, submitting: false, error: null, renameTarget },
    });
  },

  setDraftName: (name) => {
    const draft = get().draft;
    if (draft === null) return;
    if (draft.name === name && draft.error === null) return;
    set({ draft: { ...draft, name, error: null } });
  },

  setDraftSubmitting: (submitting) => {
    const draft = get().draft;
    if (draft === null) return;
    set({ draft: { ...draft, submitting } });
  },

  setDraftError: (error) => {
    const draft = get().draft;
    if (draft === null) return;
    set({ draft: { ...draft, error, submitting: false } });
  },

  cancelDraft: () => set({ draft: null }),

  reset: () =>
    set({
      selectedNodeId: null,
      expandedFolderIds: new Set<string>(),
      draft: null,
    }),
}));
