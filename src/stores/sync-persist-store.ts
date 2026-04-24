import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SyncPersistState {
  /** Most recent successful sync timestamp (ms since epoch), keyed by workspace UUID.
   *  Written by `EventBus.emit` on `SyncCompleted { cancelled: false }`. */
  lastSyncedAt: Record<string, number>;
  setLastSyncedAt(workspaceId: string, timestamp: number): void;
  clearLastSyncedAt(workspaceId: string): void;
}

export const useSyncPersistStore = create<SyncPersistState>()(
  persist(
    (set) => ({
      lastSyncedAt: {},
      setLastSyncedAt: (workspaceId, timestamp) =>
        set((s) => {
          if (s.lastSyncedAt[workspaceId] === timestamp) return s;
          return { lastSyncedAt: { ...s.lastSyncedAt, [workspaceId]: timestamp } };
        }),
      clearLastSyncedAt: (workspaceId) =>
        set((s) => {
          const next = { ...s.lastSyncedAt };
          delete next[workspaceId];
          return { lastSyncedAt: next };
        }),
    }),
    {
      name: "swarmnote-sync-persist",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastSyncedAt: state.lastSyncedAt }),
    },
  ),
);
