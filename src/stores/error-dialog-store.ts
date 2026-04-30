import { create } from "zustand";

/** Tiny global slot for "error that needs user acknowledgement" — used when a
 *  failure happens in a non-React context (store action, event-bus handler)
 *  and we still want a blocking dialog instead of a transient toast. The host
 *  component (`ErrorDialogHost`) subscribes and renders RNR `<AlertDialog>`.
 *
 *  Single-slot by design: a second `show()` overwrites the previous one. If
 *  the queue ever needs to grow, mirror the queue pattern in
 *  `notification-store.ts`. */
interface ErrorDialogState {
  open: boolean;
  title: string;
  description: string;
}

interface ErrorDialogActions {
  show(title: string, description: string): void;
  dismiss(): void;
}

export const useErrorDialogStore = create<ErrorDialogState & ErrorDialogActions>()((set) => ({
  open: false,
  title: "",
  description: "",
  show: (title, description) => set({ open: true, title, description }),
  dismiss: () => set({ open: false }),
}));
