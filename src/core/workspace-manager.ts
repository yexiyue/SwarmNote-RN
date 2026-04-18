import { Directory, Paths } from "expo-file-system";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { getAppCore } from "./app-core";

const DEFAULT_WORKSPACE_DIRNAME = "default";

let activeWorkspace: UniffiWorkspaceCoreLike | null = null;

/** Ensure the default workspace directory exists on disk. The Rust core's
 *  `open_workspace` rejects missing paths with `InvalidPath`, so this must
 *  run before the first `openWorkspace` call on a fresh install. Rust side
 *  then strips the leading `file://` via `strip_file_uri`. */
function ensureDefaultWorkspaceDir(): string {
  const dir = new Directory(Paths.document, DEFAULT_WORKSPACE_DIRNAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir.uri;
}

/** Open (or return the cached handle for) the default workspace at
 *  `${Paths.document.uri}/default`. First call triggers `workspace.hydrate()`
 *  so every document's yjs_state is valid before the UI queries them.
 *
 *  Obeys the mobile contract: at most one active `UniffiWorkspaceCore`. */
export async function openDefaultWorkspace(): Promise<UniffiWorkspaceCoreLike> {
  if (activeWorkspace !== null) return activeWorkspace;

  const core = getAppCore();
  const ws = await core.openWorkspace(ensureDefaultWorkspaceDir());
  activeWorkspace = ws;
  useWorkspaceStore.getState().setInfo(ws.info());

  // Fire-and-forget: hydrate streams progress events through the event bus,
  // which swarmStore.hydrateProgress picks up. Errors are surfaced via event
  // bus + returned HydrateResult's `failed` counter — not thrown.
  ws.hydrate().catch((err: unknown) => {
    console.warn("[workspace] hydrate failed:", err);
  });

  return ws;
}

/** Close the active workspace handle and drop the cached reference.
 *  Must be called before the app unmounts (or before switching to another
 *  workspace in the future) to flush dirty docs. */
export async function closeWorkspace(): Promise<void> {
  if (activeWorkspace === null) return;
  const ws = activeWorkspace;
  activeWorkspace = null;
  useWorkspaceStore.getState().setInfo(null);
  try {
    await ws.close();
    await getAppCore().closeWorkspace(ws.id());
  } finally {
    (ws as { uniffiDestroy?: () => void }).uniffiDestroy?.();
  }
}

/** Multi-workspace UI isn't in scope for v1 — stub kept so future changes
 *  can slot in without breaking the public surface. */
export async function switchWorkspace(_path: string): Promise<UniffiWorkspaceCoreLike> {
  throw new Error("switchWorkspace not implemented (single-workspace MVP)");
}

/** Synchronous accessor for the active handle; throws if not open. */
export function getActiveWorkspace(): UniffiWorkspaceCoreLike {
  if (activeWorkspace === null) {
    throw new Error("No workspace open — call openDefaultWorkspace() first");
  }
  return activeWorkspace;
}

/** Nullable accessor (loading screens, onboarding). */
export function getActiveWorkspaceOrNull(): UniffiWorkspaceCoreLike | null {
  return activeWorkspace;
}
