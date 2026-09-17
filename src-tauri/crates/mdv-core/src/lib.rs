//! Platform-independent core of Markdown Viewer.
//!
//! This crate contains everything that does not need a window or a webview:
//! Markdown rendering, HTML sanitization and the (read-only) filesystem access
//! used by the desktop shell. Keeping it free of Tauri dependencies means it can
//! be unit-tested on any machine with a plain Rust toolchain.

pub mod cli;
pub mod document;
pub mod error;
pub mod fs;
pub mod markdown;
pub mod media;
mod sanitize;
pub mod watch;

pub use document::{open_document, OpenedDocument};
pub use error::FsError;
pub use markdown::{render_markdown, Heading, RenderOptions, RenderedDocument};
