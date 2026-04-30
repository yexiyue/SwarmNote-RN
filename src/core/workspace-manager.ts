import { msg } from "@lingui/core/macro";
import { Directory, Paths } from "expo-file-system";
import type { UniffiWorkspaceCoreLike } from "react-native-swarmnote-core";
import { i18n } from "@/i18n/lingui";
import { toast } from "@/lib/toast";
import { validateWorkspaceName, workspaceNameToDirUri } from "@/lib/workspace-naming";
import { useCurrentDocStore } from "@/stores/current-doc-store";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { useFilesUiStore } from "@/stores/files-ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { getAppCore } from "./app-core";

/** Legacy default workspace location from the pre-multi-workspace era. Kept
 *  only for migration: if the user has `${document}/default/` on disk but no
 *  entry in the MRU list (first launch after this change), we transparently
 *  open it and let core auto-touch seed the MRU. */
const LEGACY_DEFAULT_DIRNAME = "default";

let activeWorkspace: UniffiWorkspaceCoreLike | null = null;

/** Open a workspace at the given absolute path and mark it active.
 *  Strips `file://` prefix on the Rust side; caller can pass Expo URIs
 *  directly. If the same workspace is already active (by path), returns
 *  the cached handle without re-opening. */
export async function openWorkspaceAt(path: string): Promise<UniffiWorkspaceCoreLike> {
  if (activeWorkspace !== null) {
    const currentInfo = activeWorkspace.info();
    if (currentInfo.path === path.replace(/^file:\/\//, "")) {
      return activeWorkspace;
    }
    // Different workspace requested — close the old one first to honor the
    // "at most one active workspace" contract on mobile.
    await closeWorkspace();
  }

  const core = getAppCore();
  const ws = await core.openWorkspace(path);
  activeWorkspace = ws;
  useWorkspaceStore.getState().setInfo(ws.info());

  // Fire-and-forget hydrate: progress streams through the event bus to
  // swarmStore.hydrateProgress, failures surface as event bus entries +
  // returned HydrateResult.failed. Never throws here.
  ws.hydrate().catch((err: unknown) => {
    console.warn("[workspace] hydrate failed:", err);
    toast.error(i18n._(msg`工作区加载失败`), err);
  });

  return ws;
}

/** Boot-time entry point. Tries (in order):
 *  1. Most-recently-used workspace from MRU list
 *  2. Legacy `${document}/default/` directory (pre-multi-workspace install)
 *  3. Returns `null` — caller shows the "no workspace" empty shell
 *
 *  Does not throw; any open error just falls through to the next option. */
export async function openLastOrDefault(): Promise<UniffiWorkspaceCoreLike | null> {
  const core = getAppCore();

  try {
    const recent = await core.recentWorkspaces();
    if (recent.length > 0) {
      try {
        return await openWorkspaceAt(recent[0].path);
      } catch (err) {
        console.warn("[workspace] open recent[0] failed, will try legacy default:", err);
      }
    }
  } catch (err) {
    console.warn("[workspace] recentWorkspaces() failed:", err);
  }

  const legacyDir = new Directory(Paths.document, LEGACY_DEFAULT_DIRNAME);
  if (legacyDir.exists) {
    try {
      return await openWorkspaceAt(legacyDir.uri);
    } catch (err) {
      console.warn("[workspace] legacy default open failed:", err);
    }
  }

  return null;
}

/** Create a new workspace directory under the app sandbox and open it.
 *  Rolls back the mkdir if `openWorkspace` fails, so a failed create never
 *  leaves an orphan empty directory that would shadow a later retry with
 *  the same name. */
export async function createWorkspace(name: string): Promise<UniffiWorkspaceCoreLike> {
  const validation = validateWorkspaceName(name);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const uri = workspaceNameToDirUri(name);
  const dir = new Directory(uri);
  if (dir.exists) {
    throw new Error("同名工作区已存在");
  }

  dir.create({ intermediates: true, idempotent: false });

  try {
    return await openWorkspaceAt(uri);
  } catch (err) {
    try {
      dir.delete();
    } catch (cleanupErr) {
      console.warn("[workspace] rollback delete failed:", cleanupErr);
    }
    throw err;
  }
}

/** Switch the active workspace to a different path. Closes the current one
 *  (flushing dirty docs) and opens the target. If opening the target fails,
 *  the active workspace ends up as `null` — callers should route to the
 *  no-workspace shell rather than auto-reopening the old one (which may
 *  itself be broken). */
export async function switchWorkspace(path: string): Promise<UniffiWorkspaceCoreLike> {
  return openWorkspaceAt(path);
}

/** Close the active workspace handle and drop the cached reference.
 *  Must be called before the app unmounts (or before switching to another
 *  workspace) to flush dirty docs. Also tears down workspace-scoped UI
 *  state (file tree, current open doc, selection/expand/draft) so a
 *  subsequent open starts clean — nothing leaks across workspaces. */
export async function closeWorkspace(): Promise<void> {
  if (activeWorkspace === null) return;
  const ws = activeWorkspace;
  activeWorkspace = null;
  useWorkspaceStore.getState().setInfo(null);
  // Reset stores BEFORE Rust close so any stale subscriber can't query a
  // dead handle mid-teardown.
  useCurrentDocStore.getState().reset();
  useFileTreeStore.getState().reset();
  useFilesUiStore.getState().reset();
  try {
    await ws.close();
    await getAppCore().closeWorkspace(ws.id());
  } finally {
    (ws as { uniffiDestroy?: () => void }).uniffiDestroy?.();
  }
}

export function getActiveWorkspace(): UniffiWorkspaceCoreLike {
  if (activeWorkspace === null) {
    throw new Error("No workspace open — call openLastOrDefault() first");
  }
  return activeWorkspace;
}

export function getActiveWorkspaceOrNull(): UniffiWorkspaceCoreLike | null {
  return activeWorkspace;
}
