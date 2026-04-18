//! [`UniffiAppCore`] — FFI wrap around the device-level [`AppCore`].
//!
//! Constructed once per RN app launch; holds the Ed25519 identity, global
//! config, and devices DB for the lifetime of the process. The RN host is
//! responsible for keeping exactly one instance alive (stash it in a context
//! / store) and calling `uniffiDestroy()` on teardown.

use std::sync::Arc;

use swarmnote_core::libp2p::PeerId;
use swarmnote_core::{config::save_config, AppCore, AppCoreBuilder, NodeStatus};

use crate::error::{FfiError, parse_uuid};
use crate::events::{ForeignEventBus, UniffiEventBusAdapter};
use crate::keychain::{ForeignKeychainProvider, UniffiKeychainAdapter};
use crate::path::strip_file_uri;
use crate::types::{UniffiDeviceInfo, UniffiNodeStatus, UniffiWorkspaceInfo};
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
    pub async fn list_workspaces(&self) -> Vec<UniffiWorkspaceInfo> {
        self.inner
            .list_workspaces()
            .await
            .into_iter()
            .map(|ws| ws.info().clone().into())
            .collect()
    }

    /// Look up a workspace's info by UUID without forcing the caller to
    /// hold the `UniffiWorkspaceCore`. Returns `None` if the workspace is
    /// not currently open.
    pub async fn workspace_info(
        &self,
        workspace_id: String,
    ) -> Result<Option<UniffiWorkspaceInfo>, FfiError> {
        let uuid = parse_uuid("workspace_id", &workspace_id)?;
        Ok(self.inner.workspace_info(&uuid).await.map(Into::into))
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
}
