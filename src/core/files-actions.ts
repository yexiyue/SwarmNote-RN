import type { UniffiFileTreeNode } from "react-native-swarmnote-core";
import { getActiveWorkspace } from "@/core/workspace-manager";
import { buildRelPath, validateNodeName } from "@/lib/file-naming";
import { useCurrentDocStore } from "@/stores/current-doc-store";
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

/** Rename a file or folder in-place (same parent directory). Uses
 *  `moveNode` — Rust-side handles FS rename + DB rebase + live Y.Doc
 *  rename + emits `FileTreeChanged` (event-bus then refreshes file tree).
 *  If the renamed node is the currently open doc, rebinds
 *  `useCurrentDocStore.relPath` to the new path (the Y.Doc handle is
 *  preserved, no close+reopen). */
export async function renameNode(node: UniffiFileTreeNode, newName: string): Promise<void> {
  const validation = validateNodeName(newName);
  if (!validation.ok) throw new Error(validation.reason);

  const isDir = node.children !== undefined && node.children !== null;
  const parentRelPath = parentOf(node.id);
  const newRelPath = buildRelPath(parentRelPath, newName, isDir ? "folder" : "document");
  if (newRelPath === node.id) return;

  const ws = getActiveWorkspace();
  await ws.moveNode(node.id, newRelPath, isDir);

  // `moveNode` emits `FileTreeChanged`, so the tree refresh is handled by
  // event-bus. We still need to rebind currentDocStore if it was pointing
  // at the renamed node (or a descendant, for folder rename).
  const currentRelPath = useCurrentDocStore.getState().relPath;
  if (currentRelPath !== null) {
    if (!isDir && currentRelPath === node.id) {
      useCurrentDocStore.getState().rebindRelPath(newRelPath);
    } else if (isDir && currentRelPath.startsWith(`${node.id}/`)) {
      const tail = currentRelPath.slice(node.id.length);
      useCurrentDocStore.getState().rebindRelPath(`${newRelPath}${tail}`);
    }
  }
}

/** Delete a file or folder. Files go via DB tombstone + physical remove;
 *  folders cascade-delete child DB rows by prefix then `remove_dir_all`
 *  the physical directory. Orphaned DB `folders` rows are harmless
 *  (`scan_tree` doesn't read the folders table) and will be cleaned up
 *  by the next reconcile pass.
 *
 *  Closes the editor if the current doc was (inside) the deleted node. */
export async function deleteNode(node: UniffiFileTreeNode): Promise<void> {
  const ws = getActiveWorkspace();
  const isDir = node.children !== undefined && node.children !== null;

  if (isDir) {
    await ws.deleteDocumentsByPrefix(`${node.id}/`);
    await ws.removeDir(node.id);
  } else {
    await ws.deleteDocumentByRelPath(node.id);
    await ws.removeFile(node.id);
  }

  await useFileTreeStore.getState().refresh();

  const currentRelPath = useCurrentDocStore.getState().relPath;
  if (
    currentRelPath !== null &&
    (currentRelPath === node.id || (isDir && currentRelPath.startsWith(`${node.id}/`)))
  ) {
    await useCurrentDocStore.getState().close();
  }
}

/** Return the parent directory of a workspace-relative path, or null for
 *  root-level entries. `"a/b/c"` → `"a/b"`, `"root.md"` → `null`. */
function parentOf(relPath: string): string | null {
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? null : relPath.slice(0, idx);
}

/** Strip the trailing `.md` extension for display / rename prefill.
 *  Folders have no extension so this is a no-op for them. */
export function basenameForEdit(node: UniffiFileTreeNode): string {
  return node.name;
}
