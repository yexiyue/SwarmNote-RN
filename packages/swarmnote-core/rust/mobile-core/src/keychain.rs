//! Keychain bridge between RN (JS) and `swarmnote-core`.
//!
//! The RN host implements [`ForeignKeychainProvider`] on top of
//! `expo-secure-store` / `react-native-keychain`, storing the device's
//! libp2p-protobuf-encoded Ed25519 keypair bytes. `swarmnote-core` receives
//! those bytes through [`UniffiKeychainAdapter`], which satisfies the
//! core-layer `KeychainProvider` trait.

use std::sync::Arc;

use async_trait::async_trait;
use swarmnote_core::{AppResult, KeychainProvider};

use crate::error::FfiError;

/// Trait the RN host implements. Methods are `async` so JS implementations
/// can await native keychain APIs (which are all async).
#[uniffi::export(with_foreign)]
#[async_trait]
pub trait ForeignKeychainProvider: Send + Sync {
    /// Return the protobuf-encoded Ed25519 keypair. On first call the host
    /// MUST generate a fresh keypair and persist it so subsequent calls
    /// return the same bytes — the core's `peer_id` stability depends on
    /// this contract.
    async fn get_or_create_keypair(&self) -> Result<Vec<u8>, FfiError>;
}

/// Adapter that implements the core `KeychainProvider` trait by delegating
/// to a foreign `ForeignKeychainProvider`. Held by `AppCore` via
/// `Arc<dyn KeychainProvider>`.
pub(crate) struct UniffiKeychainAdapter {
    foreign: Arc<dyn ForeignKeychainProvider>,
}

impl UniffiKeychainAdapter {
    pub(crate) fn new(foreign: Arc<dyn ForeignKeychainProvider>) -> Self {
        Self { foreign }
    }
}

#[async_trait]
impl KeychainProvider for UniffiKeychainAdapter {
    async fn get_or_create_keypair(&self) -> AppResult<Vec<u8>> {
        self.foreign
            .get_or_create_keypair()
            .await
            .map_err(Into::into)
    }
}

// Convert a `FfiError` raised by the RN keychain back into an `AppError`.
// The only cases the RN side should realistically raise here are
// `KeychainUnavailable` / `KeypairDecode`; anything else is treated as
// `KeychainUnavailable` with the display text so the core still gets a
// meaningful error without introducing a new variant.
impl From<FfiError> for swarmnote_core::AppError {
    fn from(e: FfiError) -> Self {
        use swarmnote_core::AppError;
        match e {
            FfiError::KeychainUnavailable(msg) => AppError::KeychainUnavailable(msg),
            FfiError::KeypairDecode(msg) => AppError::KeypairDecode(msg),
            FfiError::KeypairEncode(msg) => AppError::KeypairEncode(msg),
            other => AppError::KeychainUnavailable(other.to_string()),
        }
    }
}
