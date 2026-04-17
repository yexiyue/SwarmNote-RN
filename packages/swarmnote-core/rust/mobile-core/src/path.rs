//! Path normalization for FFI inputs.
//!
//! Expo's `FileSystem.documentDirectory` returns URIs like
//! `file:///var/mobile/Containers/Data/Application/.../Documents/`, but
//! `tokio::fs` / `PathBuf` expect plain filesystem paths. Every path-shaped
//! argument crossing the FFI boundary goes through [`strip_file_uri`] so RN
//! callers can pass Expo paths verbatim.

use std::path::PathBuf;

/// Strip a leading `file://` (or `file:`) URI scheme, if present, and return
/// a plain filesystem `PathBuf`. Non-URI paths pass through unchanged.
pub(crate) fn strip_file_uri(s: String) -> PathBuf {
    let trimmed = if let Some(rest) = s.strip_prefix("file://") {
        rest
    } else if let Some(rest) = s.strip_prefix("file:") {
        rest
    } else {
        s.as_str()
    };
    PathBuf::from(trimmed)
}
