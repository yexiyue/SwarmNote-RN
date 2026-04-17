import { create } from "zustand";

/** Payload for an inbound pairing request dialog. Mirrors
 *  `UniffiAppEvent.PairingRequestReceived` except `pendingId` is kept as
 *  `bigint` (uniffi u64 on the TS side). */
export interface PairingRequestPayload {
  pendingId: bigint;
  peerId: string;
  deviceName: string;
  os: string;
  platform: string;
  /** `method.tag` from `UniffiPairingMethod` — either `"PinCode"` or `"Manual"`. */
  method: string;
  expiresAt: Date;
}

interface PairingRequestNotification {
  id: string;
  type: "pairing-request";
  payload: PairingRequestPayload;
  timestamp: number;
}

/** Extensible union kept narrow for now; add new variants when new
 *  modal-requiring event types land. */
export type ActionNotification = PairingRequestNotification;

interface NotificationState {
  current: ActionNotification | null;
  queue: ActionNotification[];
}

interface NotificationActions {
  push(notification: ActionNotification): void;
  /** Dequeue the acknowledged notification and promote the next one. */
  respond(id: string): void;
  dismiss(id: string): void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  (set, get) => ({
    current: null,
    queue: [],

    push(notification) {
      const { current } = get();
      if (current === null) {
        set({ current: notification });
      } else {
        set((s) => ({ queue: [...s.queue, notification] }));
      }
    },

    respond(id) {
      const { current, queue } = get();
      if (current?.id === id) {
        const [next, ...rest] = queue;
        set({ current: next ?? null, queue: rest });
      }
    },

    dismiss(id) {
      get().respond(id);
    },
  }),
);
