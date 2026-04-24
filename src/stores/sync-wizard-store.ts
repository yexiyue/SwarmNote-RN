import type { UniffiRemoteWorkspaceInfo } from "react-native-swarmnote-core";
import { create } from "zustand";

export type WizardItemStatus = "pending" | "syncing" | "done" | "error";

export interface WizardItem {
  ws: UniffiRemoteWorkspaceInfo;
  status: WizardItemStatus;
  /** Populated after `createWorkspaceForSync` returns the local path (done/error). */
  localPath?: string;
  /** Human-readable error string set when status="error". */
  error?: string;
}

interface SyncWizardState {
  /** Selected workspaces when transitioning select → syncing. */
  items: WizardItem[];
  setItems(items: WizardItem[]): void;
  updateItem(index: number, patch: Partial<WizardItem>): void;
  reset(): void;
}

export const useSyncWizardStore = create<SyncWizardState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  updateItem: (index, patch) =>
    set((s) => {
      const next = s.items.slice();
      if (next[index] !== undefined) {
        next[index] = { ...next[index], ...patch };
      }
      return { items: next };
    }),
  reset: () => set({ items: [] }),
}));
