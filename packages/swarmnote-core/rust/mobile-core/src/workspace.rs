//! [`UniffiWorkspaceCore`] — FFI wrap around the workspace-level
//! [`WorkspaceCore`]. All per-workspace operations (fs / documents /
//! folders / ydoc) are collapsed onto this single object so the RN side
//! only manages one handle.
//!
//! **Lifecycle contract**: RN host calls `close()` before dropping the
//! handle. A dropped-without-close handle aborts writeback tasks but does
//! NOT guarantee dirty docs have flushed — the core logs a warning.

use std::sync::Arc;

use swarmnote_core::api::{AppEvent, CreateFolderInput, UpsertDocumentInput, WorkspaceCore};

use crate::error::{parse_uuid, FfiError};
use crate::types::{
    CreateFolderInput as FfiCreateFolderInput, MoveNodeResult, UniffiDocument, UniffiFileTreeNode,
    UniffiFolder, UniffiOpenDocResult, UniffiWorkspaceInfo, UpsertDocInput,
};

#[derive(uniffi::Object)]
pub struct UniffiWorkspaceCore {
    inner: Arc<WorkspaceCore>,
}

impl UniffiWorkspaceCore {
    pub(crate) fn new(inner: Arc<WorkspaceCore>) -> Self {
        Self { inner }
    }
}

#[uniffi::export]
impl UniffiWorkspaceCore {
    // ── Workspace metadata ────────────────────────────────────

    pub fn info(&self) -> UniffiWorkspaceInfo {
        self.inner.info().clone().into()
    }

    pub fn id(&self) -> String {
        self.inner.id().to_string()
    }

    /// Flush every open Y.Doc and tear down watchers / sync. MUST be called
    /// before dropping the last reference, otherwise dirty edits may be lost.
    /// Fails with [`FfiError::WorkspaceCloseFailed`] when one or more docs
    /// failed to persist — RN should surface the failure as a toast.
    pub async fn close(&self) -> Result<(), FfiError> {
        self.inner.close().await.map_err(Into::into)
    }

    // ── Filesystem ────────────────────────────────────────────

    pub async fn read_text(&self, rel_path: String) -> Result<String, FfiError> {
        self.inner.fs().read_text(&rel_path).await.map_err(Into::into)
    }

    pub async fn write_text(&self, rel_path: String, content: String) -> Result<(), FfiError> {
        self.inner
            .fs()
            .write_text(&rel_path, &content)
            .await
            .map_err(Into::into)
    }

    pub async fn read_bytes(&self, rel_path: String) -> Result<Vec<u8>, FfiError> {
        self.inner.fs().read_bytes(&rel_path).await.map_err(Into::into)
    }

    pub async fn write_bytes(&self, rel_path: String, data: Vec<u8>) -> Result<(), FfiError> {
        self.inner
            .fs()
            .write_bytes(&rel_path, &data)
            .await
            .map_err(Into::into)
    }

    pub async fn exists(&self, rel_path: String) -> bool {
        self.inner.fs().exists(&rel_path).await
    }

    pub async fn is_dir(&self, rel_path: String) -> bool {
        self.inner.fs().is_dir(&rel_path).await
    }

    pub async fn create_dir(&self, rel_path: String) -> Result<(), FfiError> {
        self.inner
            .fs()
            .create_dir(&rel_path)
            .await
            .map_err(Into::into)
    }

    pub async fn remove_file(&self, rel_path: String) -> Result<(), FfiError> {
        self.inner
            .fs()
            .remove_file(&rel_path)
            .await
            .map_err(Into::into)
    }

    pub async fn remove_dir(&self, rel_path: String) -> Result<(), FfiError> {
        self.inner
            .fs()
            .remove_dir(&rel_path)
            .await
            .map_err(Into::into)
    }

    /// Single-file or single-directory rename. For atomic move-with-DB-rebase
    /// use [`move_node`](Self::move_node) instead.
    pub async fn rename(&self, from: String, to: String) -> Result<(), FfiError> {
        self.inner.fs().rename(&from, &to).await.map_err(Into::into)
    }

    pub async fn scan_tree(&self, rel_path: String) -> Result<Vec<UniffiFileTreeNode>, FfiError> {
        let nodes = self.inner.fs().scan_tree(&rel_path).await?;
        Ok(nodes.into_iter().map(UniffiFileTreeNode::from).collect())
    }

    /// Save a media file under the note's `.assets/` sidecar. Returns the
    /// workspace-relative path of the stored file (content-addressed).
    pub async fn save_media(
        &self,
        note_rel: String,
        file_name: String,
        data: Vec<u8>,
    ) -> Result<String, FfiError> {
        self.inner
            .fs()
            .save_media(&note_rel, &file_name, &data)
            .await
            .map_err(Into::into)
    }

    // ── Documents CRUD ────────────────────────────────────────

    pub async fn list_documents(&self) -> Result<Vec<UniffiDocument>, FfiError> {
        let docs = self.inner.documents().list_documents(self.inner.id()).await?;
        Ok(docs.into_iter().map(UniffiDocument::from).collect())
    }

    /// Insert or update a document row. `workspace_id` is implicit from the
    /// workspace handle — the caller only supplies folder / title / path.
    pub async fn upsert_document(
        &self,
        input: UpsertDocInput,
    ) -> Result<UniffiDocument, FfiError> {
        let id = input
            .id
            .as_deref()
            .map(|s| parse_uuid("id", s))
            .transpose()?;
        let folder_id = input
            .folder_id
            .as_deref()
            .map(|s| parse_uuid("folder_id", s))
            .transpose()?;
        let core_input = UpsertDocumentInput {
            id,
            workspace_id: self.inner.id(),
            folder_id,
            title: input.title,
            rel_path: input.rel_path,
            file_hash: input.file_hash,
        };
        let model = self.inner.documents().upsert_document(core_input).await?;
        Ok(model.into())
    }

    pub async fn delete_document_by_rel_path(&self, rel_path: String) -> Result<(), FfiError> {
        self.inner
            .documents()
            .delete_document_by_rel_path(&rel_path)
            .await
            .map_err(Into::into)
    }

    /// Rename a document in-place (same folder). Updates both the DB row
    /// and the open Y.Doc handle (if any). `new_title` is the display
    /// title; `new_rel_path` is the workspace-relative `.md` path.
    pub async fn rename_document(
        &self,
        old_rel_path: String,
        new_rel_path: String,
        new_title: String,
    ) -> Result<(), FfiError> {
        let doc_uuid = self
            .inner
            .documents()
            .rename_document(&old_rel_path, new_rel_path.clone(), new_title)
            .await?;
        if let Some(uuid) = doc_uuid {
            self.inner.ydoc().rename_doc(uuid, &new_rel_path);
        }
        Ok(())
    }

    /// Cascade-delete every document whose `rel_path` starts with `prefix`.
    /// Used when deleting a folder subtree. Returns the number of rows
    /// deleted.
    pub async fn delete_documents_by_prefix(&self, prefix: String) -> Result<u64, FfiError> {
        self.inner
            .documents()
            .delete_documents_by_prefix(&prefix)
            .await
            .map_err(Into::into)
    }

    /// Atomically move a document or folder subtree: physical rename on
    /// disk + DB `rel_path` rebase + live Y.Doc rename for every affected
    /// doc + `FileTreeChanged` event.
    ///
    /// `is_dir` is supplied by the caller (it's usually cheap to know:
    /// folder moves originate from a folder-tree UI affordance, document
    /// moves from a document-list affordance).
    pub async fn move_node(
        &self,
        from_rel_path: String,
        to_rel_path: String,
        is_dir: bool,
    ) -> Result<MoveNodeResult, FfiError> {
        // 1. Physical rename on disk.
        self.inner.fs().rename(&from_rel_path, &to_rel_path).await?;

        // 2. Rebase DB rows + Y.Doc handles.
        if is_dir {
            let prefix_from = if from_rel_path.ends_with('/') {
                from_rel_path.clone()
            } else {
                format!("{from_rel_path}/")
            };
            let prefix_to = if to_rel_path.ends_with('/') {
                to_rel_path.clone()
            } else {
                format!("{to_rel_path}/")
            };
            let rebased = self
                .inner
                .documents()
                .rebase_documents_by_prefix(&prefix_from, &prefix_to)
                .await?;
            for (doc_uuid, new_path) in rebased {
                self.inner.ydoc().rename_doc(doc_uuid, &new_path);
            }
        } else if let Some(doc_uuid) = self
            .inner
            .documents()
            .rebase_document(&from_rel_path, to_rel_path.clone())
            .await?
        {
            self.inner.ydoc().rename_doc(doc_uuid, &to_rel_path);
        }

        // 3. Fire tree-change event so the frontend re-scans without waiting
        //    for the watcher debounce (mobile has no watcher anyway).
        self.inner.event_bus().emit(AppEvent::FileTreeChanged {
            workspace_id: self.inner.id(),
        });

        Ok(MoveNodeResult {
            new_rel_path: to_rel_path,
            is_dir,
        })
    }

    // ── Folders CRUD ──────────────────────────────────────────

    pub async fn list_folders(&self) -> Result<Vec<UniffiFolder>, FfiError> {
        let folders = self.inner.documents().list_folders(self.inner.id()).await?;
        Ok(folders.into_iter().map(UniffiFolder::from).collect())
    }

    pub async fn create_folder(
        &self,
        input: FfiCreateFolderInput,
    ) -> Result<UniffiFolder, FfiError> {
        let parent_folder_id = input
            .parent_folder_id
            .as_deref()
            .map(|s| parse_uuid("parent_folder_id", s))
            .transpose()?;
        let core_input = CreateFolderInput {
            workspace_id: self.inner.id(),
            parent_folder_id,
            name: input.name,
            rel_path: input.rel_path,
        };
        let model = self.inner.documents().create_folder(core_input).await?;
        Ok(model.into())
    }

    pub async fn delete_folder(&self, folder_id: String) -> Result<(), FfiError> {
        let id = parse_uuid("folder_id", &folder_id)?;
        self.inner
            .documents()
            .delete_folder(id)
            .await
            .map_err(Into::into)
    }

    // ── Y.Doc ─────────────────────────────────────────────────

    /// Open a document's Y.Doc by workspace-relative `.md` path. Returns
    /// the stable doc UUID + the full Y.Doc state (v1 update bytes) which
    /// RN forwards to the WebView-hosted CodeMirror to seed the editor.
    pub async fn open_doc(&self, rel_path: String) -> Result<UniffiOpenDocResult, FfiError> {
        let result = self.inner.ydoc().open_doc(&rel_path).await?;
        Ok(result.into())
    }

    /// Apply a local Y.Doc update (originated by CodeMirror in the WebView).
    /// Triggers debounced writeback to disk + DB; flush completion fires
    /// [`UniffiAppEvent::DocFlushed`].
    pub async fn apply_update(
        &self,
        doc_uuid: String,
        update: Vec<u8>,
    ) -> Result<(), FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        self.inner
            .ydoc()
            .apply_update(uuid, &update)
            .await
            .map_err(Into::into)
    }

    /// Drop the in-memory Y.Doc. Flushes dirty state first. Safe to call
    /// even when the doc isn't open.
    pub async fn close_doc(&self, doc_uuid: String) -> Result<(), FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        self.inner
            .ydoc()
            .close_doc(uuid)
            .await
            .map_err(Into::into)
    }

    /// Update the `rel_path` tracked by an open Y.Doc (used after a file
    /// rename so writebacks target the new path). Sync — no I/O.
    pub fn rename_doc(&self, doc_uuid: String, new_rel_path: String) -> Result<(), FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        self.inner.ydoc().rename_doc(uuid, &new_rel_path);
        Ok(())
    }

    /// Confirm a reload after an `ExternalConflict` — discards unsaved
    /// in-memory edits and reloads from disk. RN calls this from the
    /// "keep file on disk" side of the conflict prompt.
    pub async fn reload_confirmed(&self, doc_uuid: String) -> Result<(), FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        self.inner
            .ydoc()
            .reload_confirmed(uuid)
            .await
            .map_err(Into::into)
    }

    /// Re-encode the full Y.Doc state for the given UUID. Returns `None` if
    /// the doc isn't currently open. Used when RN needs to re-seed an editor
    /// that was force-closed or reopened in a new WebView.
    pub async fn encode_full_state(&self, doc_uuid: String) -> Result<Option<Vec<u8>>, FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        Ok(self.inner.ydoc().encode_full_state(&uuid).await)
    }

    pub fn is_doc_open(&self, doc_uuid: String) -> Result<bool, FfiError> {
        let uuid = parse_uuid("doc_uuid", &doc_uuid)?;
        Ok(self.inner.ydoc().is_doc_open(&uuid))
    }

    pub fn list_open_doc_uuids(&self) -> Vec<String> {
        self.inner
            .ydoc()
            .list_open_doc_uuids()
            .into_iter()
            .map(|u| u.to_string())
            .collect()
    }
}
