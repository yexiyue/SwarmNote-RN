//! `mobile-core` — uniffi FFI wrap around `swarmnote-core` for React Native.
//!
//! Layer diagram:
//! ```text
//!   TypeScript (RN)
//!        │  uniffi generated bindings
//!        ▼
//!   mobile-core (this crate)   ← lives here
//!        │  Arc<dyn trait> + adapter structs
//!        ▼
//!   swarmnote-core (flat public surface)
//!        │
//!        ▼
//!   swarm-p2p-core / yrs / sea-orm / ...
//! ```
//!
//! See `dev-notes/knowledge/rust-bridge.md` for the wrap template + the
//! "don't do" list (no `uniffi` derives on the shared crate, etc.).

uniffi::setup_scaffolding!();

mod app;
mod device;
mod error;
mod events;
mod keychain;
mod pairing;
mod path;
mod types;
mod workspace;

// Re-export everything uniffi needs to discover. The proc-macros (`uniffi::Object`,
// `uniffi::Record`, `uniffi::Enum`, `uniffi::Error`, `#[uniffi::export]`) register
// types with the scaffolding at module-load time, so simply declaring the
// `mod`s above is enough for ubrn to pick them up.
