//! Device list — unified view over discovered and paired peers.
//!
//! Wraps the `DeviceManager` surface reachable via `AppCore::devices()`. List
//! results include both paired (persistent) and nearby-discovered
//! (session-scoped) devices, annotated with connection status, latency, and
//! NAT-traversal type.

use std::time::SystemTime;

use swarmnote_core::{ConnectionType, Device, DeviceFilter, DeviceStatus};

use crate::app::UniffiAppCore;

// ── Records ──────────────────────────────────────────────────

#[derive(Debug, Clone, uniffi::Enum)]
pub enum UniffiDeviceStatus {
    Online,
    Offline,
}

impl From<DeviceStatus> for UniffiDeviceStatus {
    fn from(s: DeviceStatus) -> Self {
        match s {
            DeviceStatus::Online => UniffiDeviceStatus::Online,
            DeviceStatus::Offline => UniffiDeviceStatus::Offline,
        }
    }
}

#[derive(Debug, Clone, uniffi::Enum)]
pub enum UniffiConnectionType {
    /// Local-area connection (mDNS / direct dial).
    Lan,
    /// NAT hole-punched via DCUtR.
    Dcutr,
    /// Relayed through a relay server.
    Relay,
}

impl From<ConnectionType> for UniffiConnectionType {
    fn from(c: ConnectionType) -> Self {
        match c {
            ConnectionType::Lan => UniffiConnectionType::Lan,
            ConnectionType::Dcutr => UniffiConnectionType::Dcutr,
            ConnectionType::Relay => UniffiConnectionType::Relay,
        }
    }
}

/// Filter applied to `list_devices`. Default is `All` on the RN side.
#[derive(Debug, Clone, uniffi::Enum)]
pub enum UniffiDeviceFilter {
    All,
    /// Currently connected peers only.
    Connected,
    /// Persistently-paired peers (online or offline).
    Paired,
}

impl From<UniffiDeviceFilter> for DeviceFilter {
    fn from(f: UniffiDeviceFilter) -> Self {
        match f {
            UniffiDeviceFilter::All => DeviceFilter::All,
            UniffiDeviceFilter::Connected => DeviceFilter::Connected,
            UniffiDeviceFilter::Paired => DeviceFilter::Paired,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct UniffiDevice {
    pub peer_id: String,
    pub name: Option<String>,
    pub hostname: String,
    pub os: String,
    pub platform: String,
    pub arch: String,
    pub status: UniffiDeviceStatus,
    pub connection: Option<UniffiConnectionType>,
    /// Round-trip latency in milliseconds. `None` if no ping has succeeded
    /// yet or the peer is offline.
    pub latency: Option<u64>,
    pub is_paired: bool,
    pub paired_at: Option<SystemTime>,
    pub last_seen: Option<SystemTime>,
}

impl From<Device> for UniffiDevice {
    fn from(d: Device) -> Self {
        Self {
            peer_id: d.peer_id,
            name: d.name,
            hostname: d.hostname,
            os: d.os,
            platform: d.platform,
            arch: d.arch,
            status: d.status.into(),
            connection: d.connection.map(Into::into),
            latency: d.latency,
            is_paired: d.is_paired,
            paired_at: d.paired_at.map(Into::into),
            last_seen: d.last_seen.map(Into::into),
        }
    }
}

// ── Methods on UniffiAppCore ─────────────────────────────────

#[uniffi::export(async_runtime = "tokio")]
impl UniffiAppCore {
    /// List devices matching the filter. Returns `Vec::new()` if P2P is not
    /// running — the RN UI should render an empty list, not an error.
    pub async fn list_devices(&self, filter: UniffiDeviceFilter) -> Vec<UniffiDevice> {
        let Ok(dm) = self.inner.devices().await else {
            return Vec::new();
        };
        dm.get_devices(filter.into())
            .into_iter()
            .map(UniffiDevice::from)
            .collect()
    }
}
