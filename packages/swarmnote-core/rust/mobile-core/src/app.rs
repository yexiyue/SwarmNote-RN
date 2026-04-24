//! [`UniffiAppCore`] — FFI wrap around the device-level [`AppCore`].
//!
//! Constructed once per RN app launch; holds the Ed25519 identity, global
//! config, and devices DB for the lifetime of the process. The RN host is
//! responsible for keeping exactly one instance alive (stash it in a context
//! / store) and calling `uniffiDestroy()` on teardown.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use swarmnote_core::libp2p::PeerId;
use swarmnote_core::protocol::{AppRequest, AppResponse, WorkspaceRequest, WorkspaceResponse};
use swarmnote_core::{
    config::save_config, ensure_workspace_row, AppCore, AppCoreBuilder, DeviceFilter,
    DeviceStatus, NodeStatus,
};
use tokio::task::JoinSet;

use crate::error::{FfiError, parse_uuid};
use crate::events::{ForeignEventBus, UniffiEventBusAdapter};
use crate::keychain::{ForeignKeychainProvider, UniffiKeychainAdapter};
use crate::path::strip_file_uri;
use crate::types::{
    UniffiDeviceInfo, UniffiNodeStatus, UniffiRecentWorkspace, UniffiRemoteWorkspaceInfo,
    UniffiWorkspaceInfo,
};
use crate::workspace::UniffiWorkspaceCore;

/// Device-level core, wrapping [`swarmnote_core::AppCore`].
///
/// `fs_factory` defaults to `LocalFs` — mobile sandbox paths (Expo's
/// `documentDirectory`) work directly. `watcher_factory` is intentionally
/// left `None`: mobile sandboxes don't need external file-change detection.
#[derive(uniffi::Object)]
pub struct UniffiAppCore {
    pub(crate) inner: Arc<AppCore>,
    /// Same adapter that's been plumbed into `AppCore` as `Arc<dyn EventBus>`.
    /// Kept here separately so wrap-layer code (e.g. `UniffiWorkspaceCore::hydrate`)
    /// can call methods on the concrete adapter type without downcasting.
    pub(crate) event_bus: Arc<UniffiEventBusAdapter>,
}

#[uniffi::export(async_runtime = "tokio")]
impl UniffiAppCore {
    /// Bootstrap the core: load/create config, initialize identity from the
    /// keychain, open `devices.db`. Does NOT start the P2P node — call
    /// [`start_network`](Self::start_network) separately.
    #[uniffi::constructor]
    pub async fn new(
        keychain: Arc<dyn ForeignKeychainProvider>,
        event_bus: Arc<dyn ForeignEventBus>,
        app_data_dir: String,
    ) -> Result<Arc<Self>, FfiError> {
        let app_data_dir = strip_file_uri(app_data_dir);
        let event_bus = Arc::new(UniffiEventBusAdapter::new(event_bus));
        let inner = AppCoreBuilder::new(
            Arc::new(UniffiKeychainAdapter::new(keychain)),
            event_bus.clone(),
            app_data_dir,
        )
        .build()
        .await?;
        Ok(Arc::new(Self { inner, event_bus }))
    }

    /// Snapshot of the device identity — peer id + user-facing metadata.
    pub fn device_info(&self) -> Result<UniffiDeviceInfo, FfiError> {
        Ok(self.inner.identity().device_info()?.into())
    }

    /// Libp2p peer id of this device. Stable across restarts.
    pub fn peer_id(&self) -> Result<String, FfiError> {
        Ok(self.inner.identity().peer_id()?)
    }

    /// Update the user-facing device name. Persists immediately to
    /// `{app_data_dir}/config.json` and, if the P2P node is running, restarts
    /// it so the new name propagates through libp2p Identify's
    /// `agent_version`. Mirrors the desktop `commands::identity::set_device_name`.
    ///
    /// If P2P restart fails mid-way (`stop_network` succeeds but
    /// `start_network` errors), the new name is **not rolled back** — the
    /// disk config keeps the user's choice and the node ends up stopped with
    /// the error surfaced to RN.
    pub async fn set_device_name(&self, name: String) -> Result<(), FfiError> {
        // 1. In-memory identity snapshot.
        self.inner.identity().set_device_name(name.clone())?;

        // 2. Persist to disk immediately — user may kill the app right after
        //    Onboarding 2 before any other config mutation would flush this.
        {
            let mut cfg = self.inner.config().write().await;
            cfg.device_name = name.clone();
            save_config(self.inner.config().path(), &cfg)?;
        }

        // 3. Restart P2P if it was running so Identify agent_version updates.
        if matches!(self.inner.network_status().await, NodeStatus::Running) {
            self.inner.stop_network().await?;
            self.inner.start_network().await?;
        }

        Ok(())
    }

    /// Current P2P node status. `NodeStarted` / `NodeStopped` also fire on
    /// the event bus when lifecycle transitions.
    pub async fn network_status(&self) -> UniffiNodeStatus {
        self.inner.network_status().await.into()
    }

    /// Start the P2P node. Fails with [`FfiError::NetworkAlreadyRunning`] if
    /// already up. RN should call this in `onAppActive`.
    pub async fn start_network(&self) -> Result<(), FfiError> {
        self.inner.start_network().await.map_err(Into::into)
    }

    /// Stop the P2P node. No-op if already stopped. RN should call this in
    /// `onAppBackground`.
    pub async fn stop_network(&self) -> Result<(), FfiError> {
        self.inner.stop_network().await.map_err(Into::into)
    }

    /// Open (or retrieve) the workspace at `path`. `path` may be a raw
    /// filesystem path or a `file://` URI (the latter is common from Expo).
    ///
    /// **Mobile contract**: keep at most one `UniffiWorkspaceCore` handle
    /// alive at a time. Before opening a new workspace, call `close()` on
    /// the old handle and drop it — this guarantees the old workspace's
    /// dirty docs flush before the new one opens.
    pub async fn open_workspace(&self, path: String) -> Result<Arc<UniffiWorkspaceCore>, FfiError> {
        let path = strip_file_uri(path);
        let ws = self.inner.open_workspace(path).await?;
        Ok(Arc::new(UniffiWorkspaceCore::new(ws, self.event_bus.clone())))
    }

    /// Authoritative close for the workspace with the given UUID. Flushes
    /// dirty docs + tears down watchers / sync regardless of how many
    /// `UniffiWorkspaceCore` handles the host still holds — mirror of the
    /// desktop's "close last window" hook. No-op if not open.
    pub async fn close_workspace(&self, workspace_id: String) -> Result<(), FfiError> {
        let uuid = parse_uuid("workspace_id", &workspace_id)?;
        self.inner.close_workspace(uuid).await.map_err(Into::into)
    }

    /// Snapshot of every currently-open workspace. On mobile there is at
    /// most one; exposed primarily for diagnostic / debugging surfaces.
    ///
    /// Calls `WorkspaceCore::fresh_info` so `doc_count` reflects the current
    /// DB row count instead of the cached 0 from the `info()` getter.
    pub async fn list_workspaces(&self) -> Result<Vec<UniffiWorkspaceInfo>, FfiError> {
        let workspaces = self.inner.list_workspaces().await;
        let mut out = Vec::with_capacity(workspaces.len());
        for ws in workspaces {
            out.push(ws.fresh_info().await?.into());
        }
        Ok(out)
    }

    /// Persistent MRU list of workspaces the user has opened on this device
    /// (source: `GlobalConfig.recent_workspaces`, capped at 10). Available
    /// even for workspaces that are not currently loaded — the RN host uses
    /// this to populate the workspace picker without forcing `open` on every
    /// entry.
    pub async fn recent_workspaces(&self) -> Vec<UniffiRecentWorkspace> {
        self.inner
            .recent_workspaces()
            .await
            .into_iter()
            .map(Into::into)
            .collect()
    }

    /// Drop an entry from the persistent recent list. No-op if `path` is not
    /// present. **Does not delete files on disk** — hosts that want to wipe
    /// the workspace directory must do so themselves (delete workspace is a
    /// separate future API).
    pub async fn remove_recent_workspace(&self, path: String) -> Result<(), FfiError> {
        self.inner
            .remove_recent_workspace(&path)
            .await
            .map_err(Into::into)
    }

    /// Look up a workspace's info by UUID without forcing the caller to
    /// hold the `UniffiWorkspaceCore`. Returns `None` if the workspace is
    /// not currently open.
    ///
    /// Uses `WorkspaceCore::fresh_info` so `doc_count` is populated from a
    /// live DB count rather than the 0 cached on the snapshot.
    pub async fn workspace_info(
        &self,
        workspace_id: String,
    ) -> Result<Option<UniffiWorkspaceInfo>, FfiError> {
        let uuid = parse_uuid("workspace_id", &workspace_id)?;
        match self.inner.get_workspace(&uuid).await {
            Some(ws) => Ok(Some(ws.fresh_info().await?.into())),
            None => Ok(None),
        }
    }

    /// Kick off a full sync session between this device and a specific paired
    /// peer for a given workspace. Mirrors the desktop
    /// `commands::sync::trigger_workspace_sync`.
    ///
    /// Fails with [`FfiError::NetworkNotRunning`] if P2P is not up, or with
    /// [`FfiError::InvalidInput`] if either ID fails to parse. Progress and
    /// completion are observed through the usual `SyncStarted` /
    /// `SyncProgress` / `SyncCompleted` events on the event bus.
    pub async fn trigger_sync_with_peer(
        &self,
        workspace_id: String,
        peer_id: String,
    ) -> Result<(), FfiError> {
        let workspace_uuid = parse_uuid("workspace_id", &workspace_id)?;
        let pid: PeerId = peer_id.parse().map_err(|e| FfiError::InvalidInput {
            field: "peer_id".into(),
            reason: format!("{e}"),
        })?;
        let coordinator = self.inner.sync_coordinator_or_err().await?;
        coordinator.spawn_full_sync(pid, workspace_uuid).await;
        Ok(())
    }

    /// Query all paired-and-online peers in parallel for their workspace
    /// lists, merge the results, and mark entries whose UUID is already
    /// open locally. Mirrors the desktop `commands::pairing::get_remote_workspaces`.
    ///
    /// - 5s timeout per peer; slow peers are silently dropped.
    /// - Returns `Ok(vec![])` when no paired peer is online.
    /// - `FfiError::NetworkNotRunning` if P2P is not up.
    pub async fn get_remote_workspaces(
        &self,
    ) -> Result<Vec<UniffiRemoteWorkspaceInfo>, FfiError> {
        let client = self.inner.client().await?;
        let dm = self.inner.devices().await?;

        let paired_online: Vec<_> = dm
            .get_devices(DeviceFilter::Paired)
            .into_iter()
            .filter(|d| d.status == DeviceStatus::Online)
            .collect();

        if paired_online.is_empty() {
            return Ok(Vec::new());
        }

        let mut tasks = JoinSet::new();
        for device in &paired_online {
            let peer_id_str = device.peer_id.clone();
            let peer_name = device.hostname.clone();
            let client = client.clone();
            tasks.spawn(async move {
                let Ok(peer_id) = peer_id_str.parse::<PeerId>() else {
                    return (peer_id_str, peer_name, None);
                };
                let result = tokio::time::timeout(
                    Duration::from_secs(5),
                    client.send_request(
                        peer_id,
                        AppRequest::Workspace(WorkspaceRequest::ListWorkspaces),
                    ),
                )
                .await;
                let workspaces = match result {
                    Ok(Ok(AppResponse::Workspace(WorkspaceResponse::WorkspaceList {
                        workspaces,
                    }))) => Some(workspaces),
                    _ => None,
                };
                (peer_id_str, peer_name, workspaces)
            });
        }

        let local_uuids: HashSet<uuid::Uuid> = self
            .inner
            .list_workspaces()
            .await
            .into_iter()
            .map(|w| w.info().id)
            .collect();

        let mut results = Vec::new();
        while let Some(Ok((peer_id, peer_name, Some(workspaces)))) = tasks.join_next().await {
            for ws in workspaces {
                results.push(UniffiRemoteWorkspaceInfo {
                    is_local: local_uuids.contains(&ws.uuid),
                    uuid: ws.uuid.to_string(),
                    name: ws.name,
                    doc_count: ws.doc_count,
                    updated_at: ws.updated_at,
                    peer_id: peer_id.clone(),
                    peer_name: peer_name.clone(),
                });
            }
        }

        Ok(results)
    }

    /// Create an empty local workspace with a caller-assigned UUID, ready to
    /// receive documents from a paired peer's full sync. Mirrors the desktop
    /// `commands::workspace::create_workspace_for_sync`.
    ///
    /// - `base_path` may be a raw path or `file://` URI; the latter is common
    ///   from Expo's `FileSystem.documentDirectory`.
    /// - Registers the new workspace in `AppCore.workspaces` (as a `Weak`) and
    ///   pushes it onto the recent-workspaces list.
    /// - Returns the absolute path of the newly created workspace directory.
    pub async fn create_workspace_for_sync(
        self: &Arc<Self>,
        uuid: String,
        name: String,
        base_path: String,
    ) -> Result<String, FfiError> {
        let ws_uuid = parse_uuid("uuid", &uuid)?;

        if name.is_empty()
            || name.contains('/')
            || name.contains('\\')
            || name.contains("..")
            || name == "."
        {
            return Err(FfiError::InvalidInput {
                field: "name".into(),
                reason: format!("invalid workspace name: {name}"),
            });
        }

        let base_path = strip_file_uri(base_path);
        let base = PathBuf::from(&base_path);
        if !base.is_dir() {
            tokio::fs::create_dir_all(&base)
                .await
                .map_err(|e| FfiError::Io(format!("failed to create base directory: {e}")))?;
        }

        let ws_path = base.join(&name);
        let ws_path_str = ws_path
            .to_str()
            .ok_or_else(|| FfiError::InvalidPath("workspace path is not valid UTF-8".into()))?
            .to_owned();

        tokio::fs::create_dir_all(&ws_path)
            .await
            .map_err(|e| FfiError::Io(format!("failed to create workspace directory: {e}")))?;

        // Wrap the DB init + row insert so a single rollback covers all three
        // failure points; otherwise we'd leave a half-initialized workspace dir.
        let init: Result<(), FfiError> = async {
            let conn = swarmnote_core::workspace::db::init_workspace_db(&ws_path).await?;
            let peer_id = self.inner.identity().peer_id()?;
            ensure_workspace_row(&conn, ws_uuid, &name, &peer_id).await?;
            drop(conn);
            Ok(())
        }
        .await;

        if let Err(e) = init {
            let _ = tokio::fs::remove_dir_all(&ws_path).await;
            return Err(e);
        }

        let _ws_core = self.inner.clone().open_workspace(ws_path.clone()).await?;

        // touch_recent_workspace failing only costs a missing MRU entry; the
        // workspace itself is already registered, so we swallow the error.
        let _ = self
            .inner
            .touch_recent_workspace(&ws_path_str, &name, Some(&ws_uuid.to_string()))
            .await;

        Ok(ws_path_str)
    }
}
