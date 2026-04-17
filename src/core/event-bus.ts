import {
  type ForeignEventBus,
  type UniffiAppEvent,
  UniffiAppEvent_Tags,
} from "react-native-swarmnote-core";
import { useNotificationStore } from "@/stores/notification-store";
import { syncKey, useSwarmStore } from "@/stores/swarm-store";
import { getAppCore } from "./app-core";

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
        break;
      }

      // Editor / fs events are consumed elsewhere (WebView bridge, workspace
      // file-tree hook) — no store dispatch here for now.
      case UniffiAppEvent_Tags.DocFlushed:
      case UniffiAppEvent_Tags.ExternalUpdate:
      case UniffiAppEvent_Tags.ExternalConflict:
      case UniffiAppEvent_Tags.FileTreeChanged:
        break;

      default: {
        // Exhaustive: if a new UniffiAppEvent tag lands, force updates here.
        const _exhaustive: never = event;
        console.warn("[event-bus] unhandled event tag", (_exhaustive as { tag: string }).tag);
      }
    }
  }
}

function refreshPairedDevices(): void {
  getAppCore()
    .listPairedDevices()
    .then((list) => {
      useSwarmStore.getState().setPairedDevices(list);
    })
    .catch((err) => {
      console.warn("[event-bus] listPairedDevices failed:", err);
    });
}
