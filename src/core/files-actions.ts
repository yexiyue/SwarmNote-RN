import { getActiveWorkspace } from "@/core/workspace-manager";
import { buildRelPath, validateNodeName } from "@/lib/file-naming";
import { useFileTreeStore } from "@/stores/file-tree-store";

/** Commands bridging `files-ui-store` draft intent to Rust workspace APIs.
 *  Lives outside the store because the store contract forbids calling Rust
 *  directly (see `dev-notes/knowledge/rn-state-and-lifecycle.md`).
 *
 *  DB-level `parent_folder_id` / `folder_id` are intentionally left null:
 *  the physical `rel_path` is what drives `scan_tree`, so the DB folder
 *  hierarchy is not load-bearing for navigation. */

export async function createFolderAt(parentRelPath: string | null, name: string): Promise<void> {
  const validation = validateNodeName(name);
  if (!validation.ok) throw new Error(validation.reason);

  const relPath = buildRelPath(parentRelPath, name, "folder");
  const ws = getActiveWorkspace();

  // Physical dir must exist for `scan_tree` to see it. Must happen before
  // the DB insert so a crash mid-way leaves a stray physical dir (harmless
  // next scan) rather than an orphan DB row.
  await ws.createDir(relPath);
  await ws.createFolder({ parentFolderId: undefined, name, relPath });
  await useFileTreeStore.getState().refresh();
}

export async function createNoteAt(parentRelPath: string | null, name: string): Promise<void> {
  const validation = validateNodeName(name);
  if (!validation.ok) throw new Error(validation.reason);

  const relPath = buildRelPath(parentRelPath, name, "document");
  const ws = getActiveWorkspace();

  // `writeText` auto-creates intermediate dirs. Empty body seeds an empty
  // Y.Doc — Rust side reconciles on first `open_doc`.
  await ws.writeText(relPath, "");
  await ws.upsertDocument({
    id: undefined,
    folderId: undefined,
    title: name,
    relPath,
    fileHash: undefined,
  });
  await useFileTreeStore.getState().refresh();
}
