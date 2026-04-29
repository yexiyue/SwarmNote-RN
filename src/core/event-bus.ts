import {
  type ForeignEventBus,
  type UniffiAppEvent,
  UniffiAppEvent_Tags,
} from "react-native-swarmnote-core";
import { getActive as getActiveEditorBridge } from "@/core/editor-bridge-registry";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { useNotificationStore } from "@/stores/notification-store";
import { syncKey, useSwarmStore } from "@/stores/swarm-store";
import { useSyncPersistStore } from "@/stores/sync-persist-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** `ForeignEventBus` implementation: switches on `event.tag` and writes
 *  directly into the appropriate Zustand store. `emit` is called from the
 *  Rust runtime thread — MUST return fast, no awaits, no long work.
 *
 *  For events that need a full list refresh (paired devices added/removed,
 *  where the event payload only carries one item), this schedules a
 *  fire-and-forget refresh via `getAppCore().list*()`. */
export class EventBus implements ForeignEventBus {
  emit(event: UniffiAppEvent): void {
    const swarm = useSwarmStore.getState();

    switch (event.tag) {
      case UniffiAppEvent_Tags.DevicesChanged:
        swarm.setDevices(event.inner.devices);
        break;

      case UniffiAppEvent_Tags.NetworkStatusChanged:
        swarm.setNetworkStatus({
          natStatus: event.inner.natStatus,
          publicAddr: event.inner.publicAddr ?? null,
        });
        break;

      case UniffiAppEvent_Tags.NodeStarted:
        swarm.setOnline(true);
        // Rust core populates the paired-devices cache in-memory during
        // start_node, but does NOT replay `PairedDeviceAdded` events for
        // existing pairings. Without this fire-and-forget refresh, a cold
        // start leaves `swarmStore.pairedDevices` as `[]` until the user
        // pairs/unpairs again — see specs/rn-state-stores delta.
        refreshPairedDevices();
        break;

      case UniffiAppEvent_Tags.NodeStopped:
        swarm.resetRuntimeFields();
        break;

      case UniffiAppEvent_Tags.PairingRequestReceived: {
        const { pendingId, peerId, osInfo, method, expiresAt } = event.inner;
        useNotificationStore.getState().push({
          id: `pairing-${pendingId.toString()}-${Date.now()}`,
          type: "pairing-request",
          payload: {
            pendingId,
            peerId,
            deviceName: osInfo.name ?? osInfo.hostname,
            os: osInfo.os,
            platform: osInfo.platform,
            method: method.tag,
            expiresAt,
          },
          timestamp: Date.now(),
        });
        break;
      }

      case UniffiAppEvent_Tags.PairedDeviceAdded:
      case UniffiAppEvent_Tags.PairedDeviceRemoved:
        refreshPairedDevices();
        break;

      case UniffiAppEvent_Tags.HydrateProgress: {
        const { workspaceId, current, total } = event.inner;
        const cur = Number(current);
        const tot = Number(total);
        if (tot > 0 && cur >= tot) {
          swarm.clearHydrateProgress(workspaceId);
        } else {
          swarm.setHydrateProgress(workspaceId, { current: cur, total: tot });
        }
        break;
      }

      case UniffiAppEvent_Tags.SyncStarted: {
        const { workspaceId, peerId } = event.inner;
        swarm.setSyncProgress(syncKey(workspaceId, peerId), { completed: 0, total: 0 });
        break;
      }

      case UniffiAppEvent_Tags.SyncProgress: {
        const { workspaceId, peerId, completed, total } = event.inner;
        swarm.setSyncProgress(syncKey(workspaceId, peerId), { completed, total });
        break;
      }

      case UniffiAppEvent_Tags.SyncCompleted: {
        const { workspaceId, peerId, cancelled } = event.inner;
        // Keep the last-known totals on display briefly by setting a terminal
        // entry with `cancelled`; UI can fade it out on its own cadence.
        swarm.setSyncProgress(syncKey(workspaceId, peerId), {
          completed: 0,
          total: 0,
          cancelled,
        });
        if (!cancelled) {
          useSyncPersistStore.getState().setLastSyncedAt(workspaceId, Date.now());
          // If the finished workspace is the one the user currently has open,
          // pull newly synced docs into the file tree. Non-active workspaces
          // rely on `openWorkspaceAt`'s initial refresh on next switch.
          const active = useWorkspaceStore.getState().info;
          if (active?.id === workspaceId) {
            useFileTreeStore
              .getState()
              .refresh()
              .catch((err: unknown) => {
                console.warn("[event-bus] file tree refresh after SyncCompleted failed:", err);
              });
          }
        }
        break;
      }

      case UniffiAppEvent_Tags.FileTreeChanged:
        // Mobile has no FileWatcher, so this only fires on `move_node` and
        // (future) P2P-driven fs changes. Create/delete via Rust CRUD is
        // handled by the caller refreshing manually — see D8 in design.md.
        useFileTreeStore
          .getState()
          .refresh()
          .catch((err: unknown) => {
            console.warn("[event-bus] FileTreeChanged refresh failed:", err);
          });
        break;

      case UniffiAppEvent_Tags.ExternalUpdate: {
        const active = getActiveEditorBridge();
        if (active === null) break;
        const { docId, update } = event.inner;
        if (active.docUuid !== docId) break;
        active.applyRemoteUpdate(new Uint8Array(update));
        break;
      }

      // Editor-related events still consumed elsewhere (WebView bridge).
      case UniffiAppEvent_Tags.DocFlushed:
      case UniffiAppEvent_Tags.ExternalConflict:
        break;

      default: {
        // Exhaustive: if a new UniffiAppEvent tag lands, force updates here.
        const _exhaustive: never = event;
        console.warn("[event-bus] unhandled event tag", (_exhaustive as { tag: string }).tag);
      }
    }
  }
}

async function refreshPairedDevices(): Promise<void> {
  // Dynamic import breaks the `app-core -> event-bus -> app-core` load-time
  // cycle. Safe because the event can only fire after `initAppCore()` resolved.
  try {
    const { getAppCore } = await import("./app-core");
    const list = await getAppCore().listPairedDevices();
    useSwarmStore.getState().setPairedDevices(list);
  } catch (err) {
    console.warn("[event-bus] listPairedDevices failed:", err);
  }
}
