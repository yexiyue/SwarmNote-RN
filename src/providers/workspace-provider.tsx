import { createContext, type ReactNode, useContext } from "react";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";

/** React Context for the currently-active `UniffiWorkspaceCoreLike` handle.
 *
 *  Kept out of Zustand because the handle owns a native pointer that
 *  must never be serialized / persisted — Context is a better fit for
 *  "lives for the component subtree's lifetime" semantics. */
const WorkspaceContext = createContext<UniffiWorkspaceCoreLike | null>(null);

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: UniffiWorkspaceCoreLike | null;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

/** Get the active `UniffiWorkspaceCoreLike`, throwing if none is mounted.
 *  Call sites are always inside `(tabs)/...` routes where the layout
 *  guarantees a workspace is open — if this throws, it's a routing bug. */
export function useWorkspace(): UniffiWorkspaceCoreLike {
  const ws = useContext(WorkspaceContext);
  if (ws === null) {
    throw new Error("useWorkspace() called outside of WorkspaceProvider");
  }
  return ws;
}

/** Non-throwing variant for components that might render before the
 *  workspace is ready (onboarding, loading screens). */
export function useOptionalWorkspace(): UniffiWorkspaceCoreLike | null {
  return useContext(WorkspaceContext);
}
