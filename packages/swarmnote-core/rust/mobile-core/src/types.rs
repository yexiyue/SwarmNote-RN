//! FFI value types exposed to RN.
//!
//! Three flavors of type live here:
//! - **Output mirrors** of `swarmnote-core` outputs (WorkspaceInfo, DeviceInfo,
//!   NodeStatus, OpenDocResult, FileTreeNode).
//! - **UI-friendly projections** of SeaORM entity rows (UniffiDocument,
//!   UniffiFolder) that omit internal blob columns (yjs_state, file_hash,
//!   state_vector, lamport_clock) — those are never read by the RN host.
//! - **Input structs** (UpsertDocInput, CreateFolderInput) that drop
//!   `workspace_id` — the wrap layer fills it from the workspace handle.
//!
//! Timestamps everywhere convert to `std::time::SystemTime` (uniffi native
//! `Date` on the TS side). UUIDs round-trip as `String`.

use std::time::SystemTime;

use entity::workspace::{documents, folders};
use swarmnote_core::{
    DeviceInfo, FileTreeNode, HydrateResult, NodeStatus, OpenDocResult, RecentWorkspace,
    WorkspaceInfo,
};

// ── Workspace ────────────────────────────────────────────────

#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiWorkspaceInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_by: String,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
}

impl From<WorkspaceInfo> for UniffiWorkspaceInfo {
    fn from(w: WorkspaceInfo) -> Self {
        Self {
            id: w.id.to_string(),
            name: w.name,
            path: w.path,
            created_by: w.created_by,
            created_at: w.created_at.into(),
            updated_at: w.updated_at.into(),
        }
    }
}

/// Persistent MRU entry from `GlobalConfig.recent_workspaces`. Unlike
/// `UniffiWorkspaceInfo`, this is available for workspaces that have been
/// opened previously even when the handle is not currently loaded — the
/// host surfaces this list in the workspace picker UI.
///
/// `last_opened_at` stays as an ISO-8601 string (mirror of core's typing)
/// so RN can display it directly without a Date round-trip.
#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiRecentWorkspace {
    pub path: String,
    pub name: String,
    pub last_opened_at: String,
    pub uuid: Option<String>,
}

impl From<RecentWorkspace> for UniffiRecentWorkspace {
    fn from(w: RecentWorkspace) -> Self {
        Self {
            path: w.path,
            name: w.name,
            last_opened_at: w.last_opened_at,
            uuid: w.uuid,
        }
    }
}

// ── Device identity ──────────────────────────────────────────

#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiDeviceInfo {
    pub peer_id: String,
    pub device_name: String,
    pub hostname: String,
    pub os: String,
    pub platform: String,
    pub arch: String,
    /// Opaque ISO-8601 string set by the core's GlobalConfig. Kept as string
    /// because `DeviceInfo::created_at` is typed as `String` in core (not a
    /// parsed DateTime).
    pub created_at: String,
}

impl From<DeviceInfo> for UniffiDeviceInfo {
    fn from(d: DeviceInfo) -> Self {
        Self {
            peer_id: d.peer_id,
            device_name: d.device_name,
            hostname: d.hostname,
            os: d.os,
            platform: d.platform,
            arch: d.arch,
            created_at: d.created_at,
        }
    }
}

// ── Network status ───────────────────────────────────────────

#[derive(Debug, Clone, uniffi::Enum)]
pub enum UniffiNodeStatus {
    Stopped,
    Running,
    Error { message: String },
}

impl From<NodeStatus> for UniffiNodeStatus {
    fn from(s: NodeStatus) -> Self {
        match s {
            NodeStatus::Stopped => UniffiNodeStatus::Stopped,
            NodeStatus::Running => UniffiNodeStatus::Running,
            NodeStatus::Error { message } => UniffiNodeStatus::Error { message },
        }
    }
}

// ── Documents / folders (UI projection) ──────────────────────

/// UI-facing document row. Drops `yjs_state` / `state_vector` / `file_hash` /
/// `lamport_clock` — those are storage internals, never read by RN.
/// `workspace_id` is implicit via the owning `UniffiWorkspaceCore` handle.
#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiDocument {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub rel_path: String,
    pub created_by: String,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
}

impl From<documents::Model> for UniffiDocument {
    fn from(m: documents::Model) -> Self {
        Self {
            id: m.id.to_string(),
            folder_id: m.folder_id.map(|u| u.to_string()),
            title: m.title,
            rel_path: m.rel_path,
            created_by: m.created_by,
            created_at: m.created_at.into(),
            updated_at: m.updated_at.into(),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiFolder {
    pub id: String,
    pub parent_folder_id: Option<String>,
    pub name: String,
    pub rel_path: String,
    pub created_by: String,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
}

impl From<folders::Model> for UniffiFolder {
    fn from(m: folders::Model) -> Self {
        Self {
            id: m.id.to_string(),
            parent_folder_id: m.parent_folder_id.map(|u| u.to_string()),
            name: m.name,
            rel_path: m.rel_path,
            created_by: m.created_by,
            created_at: m.created_at.into(),
            updated_at: m.updated_at.into(),
        }
    }
}

// ── Y.Doc ────────────────────────────────────────────────────

#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiOpenDocResult {
    pub doc_uuid: String,
    /// Full Y.Doc state encoded as a v1 update. RN forwards this to the
    /// WebView-hosted CodeMirror via Comlink to seed the editor.
    pub yjs_state: Vec<u8>,
}

impl From<OpenDocResult> for UniffiOpenDocResult {
    fn from(r: OpenDocResult) -> Self {
        Self {
            doc_uuid: r.doc_uuid.to_string(),
            yjs_state: r.yjs_state,
        }
    }
}

// ── File tree ────────────────────────────────────────────────

/// Recursive file-tree node mirroring [`FileTreeNode`]. `children` is `None`
/// for files, `Some(vec)` for directories.
#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiFileTreeNode {
    pub id: String,
    pub name: String,
    pub children: Option<Vec<UniffiFileTreeNode>>,
}

impl From<FileTreeNode> for UniffiFileTreeNode {
    fn from(n: FileTreeNode) -> Self {
        Self {
            id: n.id,
            name: n.name,
            children: n
                .children
                .map(|v| v.into_iter().map(UniffiFileTreeNode::from).collect()),
        }
    }
}

// ── Inputs (workspace_id omitted — supplied by handle) ───────

/// Insert or update a document row. On create, `id` is `None` (server assigns
/// a v7 UUID) and the returned [`UniffiDocument`] carries the generated id.
/// On update, `id` is the existing document's UUID.
#[derive(Debug, Clone, uniffi::Record)]
pub struct UpsertDocInput {
    pub id: Option<String>,
    pub folder_id: Option<String>,
    pub title: String,
    pub rel_path: String,
    /// Optional content hash (blake3 hex) — populated by the core's own
    /// writeback path; RN typically leaves this `None` on user-initiated
    /// creates.
    pub file_hash: Option<String>,
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct CreateFolderInput {
    pub parent_folder_id: Option<String>,
    pub name: String,
    pub rel_path: String,
}

/// Result returned by `UniffiWorkspaceCore::move_node` — the destination
/// path after the atomic move (echoed back) and whether the moved entity
/// was a directory.
#[derive(Debug, Clone, uniffi::Record)]
pub struct MoveNodeResult {
    pub new_rel_path: String,
    pub is_dir: bool,
}

// ── Hydrate ──────────────────────────────────────────────────

/// Summary returned by [`UniffiWorkspaceCore::hydrate`]. Mirrors
/// [`swarmnote_core::HydrateResult`], widening `usize` to `u64` (uniffi
/// does not expose `usize`; `u64` preserves full range on both 32/64-bit).
#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiHydrateResult {
    pub generated: u64,
    pub merged: u64,
    pub skipped: u64,
    pub failed: u64,
}

impl From<HydrateResult> for UniffiHydrateResult {
    fn from(r: HydrateResult) -> Self {
        Self {
            generated: r.generated as u64,
            merged: r.merged as u64,
            skipped: r.skipped as u64,
            failed: r.failed as u64,
        }
    }
}
