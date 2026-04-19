import type { UniffiRecentWorkspace } from "react-native-swarmnote-core";
import { create } from "zustand";
import { getAppCore } from "@/core/app-core";

/** Mirrors the Rust `GlobalConfig.recent_workspaces` list.
 *  `null` means "not yet loaded" (distinct from `[]` = "loaded, empty") so
 *  empty-state UIs can wait for the first `refresh()` instead of flashing
 *  the empty copy during boot. */
interface RecentWorkspacesState {
  items: UniffiRecentWorkspace[] | null;
  loading: boolean;
}

interface RecentWorkspacesActions {
  refresh(): Promise<void>;
  remove(path: string): Promise<void>;
  reset(): void;
}

export const useRecentWorkspacesStore = create<RecentWorkspacesState & RecentWorkspacesActions>()(
  (set, get) => ({
    items: null,
    loading: false,

    refresh: async () => {
      if (get().loading) return;
      set({ loading: true });
      try {
        const items = await getAppCore().recentWorkspaces();
        set({ items, loading: false });
      } catch (err) {
        console.warn("[recent-workspaces] refresh failed:", err);
        set({ loading: false });
      }
    },

    remove: async (path) => {
      await getAppCore().removeRecentWorkspace(path);
      set((s) => ({
        items: s.items ? s.items.filter((w) => w.path !== path) : s.items,
      }));
    },

    reset: () => set({ items: null, loading: false }),
  }),
);
