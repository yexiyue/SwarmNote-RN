//! Event bridge from `swarmnote-core` to RN.
//!
//! [`ForeignEventBus`] is the single callback the RN host implements; every
//! [`swarmnote_core::AppEvent`] the core emits passes through
//! [`UniffiEventBusAdapter::emit`], which maps to [`UniffiAppEvent`] and
//! hands it to JS.
//!
//! Every core variant has a 1:1 projection here except:
//! - Binary UUIDs are stringified.
//! - `chrono::DateTime<Utc>` timestamps become `SystemTime` (→ `Date` in TS).
//! - Nested `Device` / `PairedDeviceInfo` use their Uniffi-side mirrors.

use std::sync::Arc;
use std::time::SystemTime;

use swarmnote_core::{AppEvent, EventBus};

use crate::device::UniffiDevice;
use crate::pairing::{UniffiOsInfo, UniffiPairedDeviceInfo, UniffiPairingMethod};

/// Every event emitted to RN. RN code typically dispatches on the variant
/// tag (`externalUpdate`, `nodeStarted`, …) to update stores or trigger
/// side effects (e.g. forward Y.Doc updates to the WebView editor).
#[derive(Debug, Clone, uniffi::Enum)]
pub enum UniffiAppEvent {
    // ── Y.Doc / documents ──
    /// A dirty Y.Doc was flushed to disk + DB (post-writeback).
    DocFlushed {
        doc_id: String,
    },
    /// Remote update applied to an open document — the editor should
    /// integrate the update bytes immediately.
    ExternalUpdate {
        doc_id: String,
        update: Vec<u8>,
    },
    /// External `.md` edit while unsaved edits existed — RN must prompt
    /// user to reload or keep.
    ExternalConflict {
        doc_id: String,
        rel_path: String,
    },

    // ── File tree ──
    /// Workspace file tree changed externally; re-scan.
    FileTreeChanged {
        workspace_id: String,
    },

    // ── Devices / discovery ──
    /// Full device snapshot — RN should atomically replace its list.
    DevicesChanged {
        devices: Vec<UniffiDevice>,
    },

    // ── Pairing ──
    /// Inbound pairing request awaiting user confirmation. RN prompts the
    /// user, then calls `respond_pairing_request(pending_id, accept)`.
    PairingRequestReceived {
        pending_id: u64,
        peer_id: String,
        os_info: UniffiOsInfo,
        method: UniffiPairingMethod,
        expires_at: SystemTime,
    },
    /// A device was paired (outbound or inbound). `info` is `None` for the
    /// outbound-success case where the peer's full info arrives later via
    /// Identify.
    PairedDeviceAdded {
        info: Option<UniffiPairedDeviceInfo>,
    },
    PairedDeviceRemoved {
        peer_id: String,
    },

    // ── Network / P2P node ──
    /// NAT status changed (public reachable, symmetric-NAT, etc.).
    NetworkStatusChanged {
        nat_status: String,
        public_addr: Option<String>,
    },
    NodeStarted,
    NodeStopped,

    // ── Workspace hydrate (mobile-only; pushed by `UniffiWorkspaceCore::hydrate`) ──
    /// Streamed progress while hydrating a workspace's Y.Doc state. Emitted
    /// **before** processing each document, so `current` starts at 1 and
    /// reaches `total` at completion. Unlike every other variant, this event
    /// is NOT mapped from a core `AppEvent`: `hydrate_workspace` takes a
    /// progress closure directly, and the wrap layer forwards each tick here.
    HydrateProgress {
        workspace_id: String,
        current: u64,
        total: u64,
    },

    // ── Sync (per-peer, per-workspace) ──
    SyncStarted {
        workspace_id: String,
        peer_id: String,
    },
    SyncProgress {
        workspace_id: String,
        peer_id: String,
        completed: u32,
        total: u32,
    },
    SyncCompleted {
        workspace_id: String,
        peer_id: String,
        /// `true` if the session was cancelled mid-run; `false` = normal
        /// finish.
        cancelled: bool,
    },
}

/// Trait the RN host implements. `emit` is called from the Rust runtime
/// thread; the callback must not block on long-running work (forward to
/// a store and return immediately).
#[uniffi::export(with_foreign)]
pub trait ForeignEventBus: Send + Sync {
    fn emit(&self, event: UniffiAppEvent);
}

/// Adapter plugged into the core as `Arc<dyn EventBus>`. Maps core events
/// 1:1 into [`UniffiAppEvent`] before handing to RN.
pub(crate) struct UniffiEventBusAdapter {
    foreign: Arc<dyn ForeignEventBus>,
}

impl UniffiEventBusAdapter {
    pub(crate) fn new(foreign: Arc<dyn ForeignEventBus>) -> Self {
        Self { foreign }
    }

    /// Push a [`UniffiAppEvent::HydrateProgress`] tick to RN. Used by
    /// `UniffiWorkspaceCore::hydrate` — the hydrate closure owns a clone of
    /// this adapter and calls this for every processed doc.
    pub(crate) fn emit_hydrate_progress(&self, workspace_id: String, current: u64, total: u64) {
        self.foreign.emit(UniffiAppEvent::HydrateProgress {
            workspace_id,
            current,
            total,
        });
    }
}

impl EventBus for UniffiEventBusAdapter {
    fn emit(&self, event: AppEvent) {
        self.foreign.emit(map_event(event));
    }
}

fn map_event(event: AppEvent) -> UniffiAppEvent {
    match event {
        AppEvent::DocFlushed { doc_id } => UniffiAppEvent::DocFlushed {
            doc_id: doc_id.to_string(),
        },
        AppEvent::ExternalUpdate { doc_id, update } => UniffiAppEvent::ExternalUpdate {
            doc_id: doc_id.to_string(),
            update,
        },
        AppEvent::ExternalConflict { doc_id, rel_path } => UniffiAppEvent::ExternalConflict {
            doc_id: doc_id.to_string(),
            rel_path,
        },
        AppEvent::FileTreeChanged { workspace_id } => UniffiAppEvent::FileTreeChanged {
            workspace_id: workspace_id.to_string(),
        },
        AppEvent::DevicesChanged { devices } => UniffiAppEvent::DevicesChanged {
            devices: devices.into_iter().map(UniffiDevice::from).collect(),
        },
        AppEvent::PairingRequestReceived {
            pending_id,
            peer_id,
            os_info,
            method,
            expires_at,
        } => UniffiAppEvent::PairingRequestReceived {
            pending_id,
            peer_id,
            os_info: os_info.into(),
            method: method.into(),
            expires_at: expires_at.into(),
        },
        AppEvent::PairedDeviceAdded { info } => UniffiAppEvent::PairedDeviceAdded {
            info: info.map(UniffiPairedDeviceInfo::from),
        },
        AppEvent::PairedDeviceRemoved { peer_id } => {
            UniffiAppEvent::PairedDeviceRemoved { peer_id }
        }
        AppEvent::NetworkStatusChanged {
            nat_status,
            public_addr,
        } => UniffiAppEvent::NetworkStatusChanged {
            nat_status,
            public_addr,
        },
        AppEvent::NodeStarted => UniffiAppEvent::NodeStarted,
        AppEvent::NodeStopped => UniffiAppEvent::NodeStopped,
        AppEvent::SyncStarted {
            workspace_id,
            peer_id,
        } => UniffiAppEvent::SyncStarted {
            workspace_id: workspace_id.to_string(),
            peer_id,
        },
        AppEvent::SyncProgress {
            workspace_id,
            peer_id,
            completed,
            total,
        } => UniffiAppEvent::SyncProgress {
            workspace_id: workspace_id.to_string(),
            peer_id,
            completed,
            total,
        },
        AppEvent::SyncCompleted {
            workspace_id,
            peer_id,
            cancelled,
        } => UniffiAppEvent::SyncCompleted {
            workspace_id: workspace_id.to_string(),
            peer_id,
            cancelled,
        },
    }
}
