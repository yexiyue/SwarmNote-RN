import { Alert } from "react-native";
import { create } from "zustand";
import { getActiveWorkspaceOrNull } from "@/core/workspace-manager";

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
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("打开笔记失败", msg);
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

  reset: () => {
    openSeq++;
    set({ docUuid: null, relPath: null, initialState: null, openState: "idle" });
  },
}));
