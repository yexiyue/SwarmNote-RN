import { msg } from "@lingui/core/macro";
import { create } from "zustand";
import { getActiveWorkspaceOrNull } from "@/core/workspace-manager";
import { i18n } from "@/i18n/lingui";
import { useErrorDialogStore } from "./error-dialog-store";

/** The lifecycle of the editor host on the main screen:
 *  - `idle`: no doc open, render empty state
 *  - `opening`: `open(node)` in flight, can show spinner
 *  - `open`: `docUuid + initialState` ready, render `<MarkdownEditor>`
 *  - `closing`: close-doc in flight (rarely user-visible) */
type OpenState = "idle" | "opening" | "open" | "closing";

interface CurrentDocState {
  docUuid: string | null;
  relPath: string | null;
  initialState: Uint8Array | null;
  openState: OpenState;
}

interface CurrentDocActions {
  open(relPath: string): Promise<void>;
  close(): Promise<void>;
  /** Update the tracked `relPath` without reopening the doc. Used when the
   *  current doc is renamed/moved on disk — the `docUuid` and Y.Doc handle
   *  stay valid, only the path changed. Caller is responsible for the
   *  underlying FFI rename (e.g. `moveNode`). No-op if `relPath` is null. */
  rebindRelPath(newRelPath: string): void;
  /** Hard reset, called on workspace switch. Does NOT call close_doc — the
   *  workspace close is expected to drop all in-memory docs on the Rust side. */
  reset(): void;
}

/** Monotonic guard: every `open()` bumps this; when the async `openDoc`
 *  resolves, it compares against the current value and bails if superseded
 *  by a newer request. Protects against fast successive clicks. */
let openSeq = 0;

export const useCurrentDocStore = create<CurrentDocState & CurrentDocActions>()((set, get) => ({
  docUuid: null,
  relPath: null,
  initialState: null,
  openState: "idle",

  open: async (relPath) => {
    const current = get();
    if (current.relPath === relPath && current.openState === "open") return;

    const seq = ++openSeq;
    const ws = getActiveWorkspaceOrNull();
    if (ws === null) {
      console.warn("[current-doc] open() called with no active workspace");
      return;
    }

    if (current.docUuid !== null) {
      try {
        await ws.closeDoc(current.docUuid);
      } catch (err) {
        console.warn("[current-doc] closeDoc of previous failed:", err);
      }
    }
    if (seq !== openSeq) return;

    set({
      docUuid: null,
      relPath,
      initialState: null,
      openState: "opening",
    });

    try {
      const result = await ws.openDoc(relPath);
      if (seq !== openSeq) {
        ws.closeDoc(result.docUuid).catch((err: unknown) => {
          console.warn("[current-doc] stale doc close failed:", err);
        });
        return;
      }
      set({
        docUuid: result.docUuid,
        relPath,
        initialState: new Uint8Array(result.yjsState),
        openState: "open",
      });
    } catch (err) {
      if (seq !== openSeq) return;
      const detail = err instanceof Error ? err.message : String(err);
      // User is actively waiting for the note to open; surface as a blocking
      // RNR AlertDialog via the global error-dialog host so the failure can't
      // be missed mid-route-transition (toast is too transient here).
      useErrorDialogStore.getState().show(i18n._(msg`打开笔记失败`), detail);
      set({ docUuid: null, relPath: null, initialState: null, openState: "idle" });
    }
  },

  close: async () => {
    const { docUuid } = get();
    if (docUuid === null) return;
    const ws = getActiveWorkspaceOrNull();
    openSeq++;
    set({ openState: "closing" });
    try {
      if (ws !== null) await ws.closeDoc(docUuid);
    } catch (err) {
      console.warn("[current-doc] closeDoc failed:", err);
    } finally {
      set({ docUuid: null, relPath: null, initialState: null, openState: "idle" });
    }
  },

  rebindRelPath: (newRelPath) => {
    const { relPath } = get();
    if (relPath === null) return;
    set({ relPath: newRelPath });
  },

  reset: () => {
    openSeq++;
    set({ docUuid: null, relPath: null, initialState: null, openState: "idle" });
  },
}));
