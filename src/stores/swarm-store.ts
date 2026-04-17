import type { UniffiDevice, UniffiPairedDeviceInfo } from "react-native-swarmnote-core";
import { create } from "zustand";

type SyncKey = `${string}:${string}`;

type SyncEntry = {
  completed: number;
  total: number;
  /** Set by `SyncCompleted`; absent while running. */
  cancelled?: boolean;
};

type HydrateEntry = {
  current: number;
  total: number;
};

interface SwarmState {
  online: boolean;
  natStatus: string | null;
  publicAddr: string | null;
  devices: UniffiDevice[];
  pairedDevices: UniffiPairedDeviceInfo[];
  /** Keyed by `${workspaceId}:${peerId}`. */
  syncProgress: Record<SyncKey, SyncEntry>;
  /** Keyed by workspaceId. */
  hydrateProgress: Record<string, HydrateEntry>;
  /** True when keychain failed and we fell back to an ephemeral keypair —
   *  UI should render a warning banner (peer id will change on next launch). */
  keychainEphemeral: boolean;
}

interface SwarmActions {
  setOnline(v: boolean): void;
  setNetworkStatus(nat: { natStatus: string | null; publicAddr: string | null }): void;
  setDevices(d: UniffiDevice[]): void;
  setPairedDevices(d: UniffiPairedDeviceInfo[]): void;
  setSyncProgress(key: SyncKey, entry: SyncEntry): void;
  clearSyncProgress(key: SyncKey): void;
  setHydrateProgress(workspaceId: string, entry: HydrateEntry): void;
  clearHydrateProgress(workspaceId: string): void;
  setKeychainEphemeral(v: boolean): void;
  /** Collapse every field that is only meaningful while P2P is running.
   *  Called on `NodeStopped`. */
  resetRuntimeFields(): void;
}

export const syncKey = (workspaceId: string, peerId: string): SyncKey =>
  `${workspaceId}:${peerId}` as SyncKey;

export const useSwarmStore = create<SwarmState & SwarmActions>()((set, get) => ({
  online: false,
  natStatus: null,
  publicAddr: null,
  devices: [],
  pairedDevices: [],
  syncProgress: {},
  hydrateProgress: {},
  keychainEphemeral: false,

  setOnline: (online) => set({ online }),
  setNetworkStatus: ({ natStatus, publicAddr }) => {
    const s = get();
    if (s.natStatus === natStatus && s.publicAddr === publicAddr) return;
    set({ natStatus, publicAddr });
  },
  setDevices: (devices) => set({ devices }),
  setPairedDevices: (pairedDevices) => set({ pairedDevices }),

  setSyncProgress: (key, entry) => {
    const cur = get().syncProgress[key];
    if (
      cur !== undefined &&
      cur.completed === entry.completed &&
      cur.total === entry.total &&
      cur.cancelled === entry.cancelled
    ) {
      return;
    }
    set((s) => ({ syncProgress: { ...s.syncProgress, [key]: entry } }));
  },
  clearSyncProgress: (key) =>
    set((s) => {
      const next = { ...s.syncProgress };
      delete next[key];
      return { syncProgress: next };
    }),

  setHydrateProgress: (workspaceId, entry) =>
    set((s) => ({ hydrateProgress: { ...s.hydrateProgress, [workspaceId]: entry } })),
  clearHydrateProgress: (workspaceId) =>
    set((s) => {
      const next = { ...s.hydrateProgress };
      delete next[workspaceId];
      return { hydrateProgress: next };
    }),

  setKeychainEphemeral: (keychainEphemeral) => set({ keychainEphemeral }),

  resetRuntimeFields: () =>
    set({
      online: false,
      natStatus: null,
      publicAddr: null,
      devices: [],
      syncProgress: {},
    }),
}));
