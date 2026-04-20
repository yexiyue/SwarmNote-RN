import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { create } from "zustand";
import { getActiveWorkspaceOrNull } from "@/core/workspace-manager";

/** Mirrors `workspace.scan_tree("")` output. `null` means "not yet loaded"
 *  (distinct from `[]` = "loaded, empty") so empty-state UIs can wait for
 *  the first refresh instead of flashing the empty copy during boot. */
interface FileTreeState {
  tree: UniffiFileTreeNode[] | null;
  loading: boolean;
}

interface FileTreeActions {
  refresh(): Promise<void>;
  reset(): void;
}

export const useFileTreeStore = create<FileTreeState & FileTreeActions>()((set, get) => ({
  tree: null,
  loading: false,

  refresh: async () => {
    if (get().loading) return;
    const ws = getActiveWorkspaceOrNull();
    if (ws === null) {
      set({ tree: null, loading: false });
      return;
    }
    set({ loading: true });
    try {
      const tree = await ws.scanTree("");
      set({ tree, loading: false });
    } catch (err) {
      console.warn("[file-tree] refresh failed:", err);
      set({ loading: false });
    }
  },

  reset: () => set({ tree: null, loading: false }),
}));
