//! FFI-side mirror of [`swarmnote_core::api::AppError`].
//!
//! We don't add `#[derive(uniffi::Error)]` to the shared `AppError` — that
//! would pull `uniffi` into the shared crate for every desktop build. Instead
//! `FfiError` is a standalone enum with a `From<AppError>` conversion, and
//! the variant (`kind`) names match 1:1 with `AppError` so RN i18n and
//! recovery code uses the same discriminants as the desktop shell.
//!
//! Additional variants (`InvalidInput`) cover wrap-layer parse errors that
//! don't exist in the shared API surface (bad UUIDs, malformed paths, etc.).

use swarmnote_core::api::AppError;

/// Wrap-layer error type exposed to RN. Every `Result<T, FfiError>` on a
/// `#[uniffi::export]` fn becomes `Promise<T>` on the TS side; rejections
/// are typed instances that RN matches via `FfiError.<Variant>.instanceOf(e)`.
#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum FfiError {
    // ── Direct mirror of AppError ─────────────────────────────
    #[error("database error: {0}")]
    Database(String),
    #[error("IO error: {0}")]
    Io(String),

    #[error("keypair decode failed: {0}")]
    KeypairDecode(String),
    #[error("keypair encode failed: {0}")]
    KeypairEncode(String),

    #[error("keychain unavailable: {0}")]
    KeychainUnavailable(String),

    #[error("config parse failed: {0}")]
    ConfigParse(String),

    #[error("yjs decode ({context}): {reason}")]
    YjsDecode { context: String, reason: String },
    #[error("yjs apply ({context}): {reason}")]
    YjsApply { context: String, reason: String },
    #[error("document row missing: {0}")]
    DocRowMissing(String),
    #[error("document not open: {0}")]
    DocNotOpen(String),

    #[error("P2P node is not running")]
    NetworkNotRunning,
    #[error("P2P node is already running")]
    NetworkAlreadyRunning,
    #[error("swarm I/O failed ({context}): {reason}")]
    SwarmIo { context: String, reason: String },

    #[error("pairing code has expired")]
    PairingCodeExpired,
    #[error("pairing code is invalid")]
    PairingCodeInvalid,
    #[error("no pending pairing request for id {0}")]
    PairingPendingNotFound(u64),
    #[error("pairing failed ({context}): {reason}")]
    PairingOther { context: String, reason: String },

    #[error("no workspace database open")]
    NoWorkspaceDb,
    #[error("app data directory not found")]
    NoAppDataDir,
    #[error("folder is not empty: {0}")]
    FolderNotEmpty(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("path traversal detected: {0}")]
    PathTraversal(String),
    #[error("name conflict: {0}")]
    NameConflict(String),
    #[error("no workspace open")]
    NoWorkspaceOpen,
    #[error("workspace {workspace_id} close failed ({failure_count} doc(s))")]
    WorkspaceCloseFailed {
        workspace_id: String,
        failure_count: u32,
        failures: Vec<DocFlushFailure>,
    },

    #[error("window error: {0}")]
    Window(String),

    // ── FFI-wrap-specific ─────────────────────────────────────
    /// Input from the RN host could not be parsed into the shape `swarmnote-core`
    /// expects (e.g. malformed UUID string). Indicates a caller bug, not a
    /// runtime failure in the core.
    #[error("invalid input ({field}): {reason}")]
    InvalidInput { field: String, reason: String },
}

/// Per-document persistence failure inside `WorkspaceCloseFailed`. Mirrors
/// the `(Uuid, String)` pairs the core returns, with UUIDs stringified for
/// the FFI boundary.
#[derive(Debug, Clone, uniffi::Record)]
pub struct DocFlushFailure {
    pub doc_id: String,
    pub reason: String,
}

impl From<AppError> for FfiError {
    fn from(e: AppError) -> Self {
        match e {
            AppError::Database(err) => FfiError::Database(err.to_string()),
            AppError::Io(err) => FfiError::Io(err.to_string()),

            AppError::KeypairDecode(msg) => FfiError::KeypairDecode(msg),
            AppError::KeypairEncode(msg) => FfiError::KeypairEncode(msg),

            AppError::KeychainUnavailable(msg) => FfiError::KeychainUnavailable(msg),

            AppError::ConfigParse(msg) => FfiError::ConfigParse(msg),

            AppError::YjsDecode { context, reason } => FfiError::YjsDecode {
                context: context.to_string(),
                reason,
            },
            AppError::YjsApply { context, reason } => FfiError::YjsApply {
                context: context.to_string(),
                reason,
            },
            AppError::DocRowMissing(uuid) => FfiError::DocRowMissing(uuid.to_string()),
            AppError::DocNotOpen(uuid) => FfiError::DocNotOpen(uuid.to_string()),

            AppError::NetworkNotRunning => FfiError::NetworkNotRunning,
            AppError::NetworkAlreadyRunning => FfiError::NetworkAlreadyRunning,
            AppError::SwarmIo { context, reason } => FfiError::SwarmIo {
                context: context.to_string(),
                reason,
            },

            AppError::PairingCodeExpired => FfiError::PairingCodeExpired,
            AppError::PairingCodeInvalid => FfiError::PairingCodeInvalid,
            AppError::PairingPendingNotFound(id) => FfiError::PairingPendingNotFound(id),
            AppError::PairingOther { context, reason } => FfiError::PairingOther {
                context: context.to_string(),
                reason,
            },

            AppError::NoWorkspaceDb => FfiError::NoWorkspaceDb,
            AppError::NoAppDataDir => FfiError::NoAppDataDir,
            AppError::FolderNotEmpty(s) => FfiError::FolderNotEmpty(s),
            AppError::InvalidPath(s) => FfiError::InvalidPath(s),
            AppError::PathTraversal(s) => FfiError::PathTraversal(s),
            AppError::NameConflict(s) => FfiError::NameConflict(s),
            AppError::NoWorkspaceOpen => FfiError::NoWorkspaceOpen,
            AppError::WorkspaceCloseFailed {
                workspace_id,
                failures,
            } => {
                let failure_count = failures.len() as u32;
                FfiError::WorkspaceCloseFailed {
                    workspace_id: workspace_id.to_string(),
                    failure_count,
                    failures: failures
                        .into_iter()
                        .map(|(uuid, reason)| DocFlushFailure {
                            doc_id: uuid.to_string(),
                            reason,
                        })
                        .collect(),
                }
            }

            AppError::Window(msg) => FfiError::Window(msg),
        }
    }
}

/// Convert any UUID string passed across the FFI boundary into a `Uuid`.
/// Failures surface as [`FfiError::InvalidInput`] — the caller is responsible
/// for passing well-formed UUID strings (they come from prior Rust→JS trips
/// via `Uuid::to_string()`, so malformed values imply a caller bug).
pub(crate) fn parse_uuid(field: &'static str, s: &str) -> Result<uuid::Uuid, FfiError> {
    uuid::Uuid::parse_str(s).map_err(|e| FfiError::InvalidInput {
        field: field.to_string(),
        reason: e.to_string(),
    })
}
