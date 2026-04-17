import type { UniffiWorkspaceInfo } from "react-native-swarmnote-core";
import { create } from "zustand";

/** Serializable projection of the active workspace. The actual
 *  `UniffiWorkspaceCore` handle lives in React Context (see
 *  `providers/workspace-provider.tsx`) because it carries a native pointer. */
interface WorkspaceState {
  info: UniffiWorkspaceInfo | null;
}

interface WorkspaceActions {
  setInfo(info: UniffiWorkspaceInfo | null): void;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()((set) => ({
  info: null,
  setInfo: (info) => set({ info }),
}));
