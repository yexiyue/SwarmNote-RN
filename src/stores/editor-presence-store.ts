import type { AwarenessUserState } from "@swarmnote/editor-react-native/contracts";
import { create } from "zustand";

/** Remote-only presence snapshot for the active doc — recomputed on every
 *  awareness change inside the WebView and pushed up through the editor
 *  Comlink bridge. The active editor is the only writer; switching docs
 *  resets the list automatically because MarkdownEditor unmounts and
 *  the next mount writes a fresh empty list. */
interface EditorPresenceState {
  presence: AwarenessUserState[];
  setPresence: (presence: AwarenessUserState[]) => void;
  clear: () => void;
}

export const useEditorPresenceStore = create<EditorPresenceState>((set) => ({
  presence: [],
  setPresence: (presence) => set({ presence }),
  clear: () => set({ presence: [] }),
}));
