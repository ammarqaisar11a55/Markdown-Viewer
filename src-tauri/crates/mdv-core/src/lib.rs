//! Platform-independent core of Markdown Viewer.
//!
//! This crate contains everything that does not need a window or a webview:
//! Markdown rendering, HTML sanitization and the filesystem access used by the
//! desktop shell. Keeping it free of Tauri dependencies means it can be
//! unit-tested on any machine with a plain Rust toolchain.

pub mod cli;
pub mod document;
pub mod error;
pub mod fs;
pub mod markdown;
pub mod mdx;
pub mod media;
mod sanitize;
pub mod watch;

pub use document::{
    open_document, render_source, save_document, DocumentFlavor, OpenedDocument, RenderedSource,
};
pub use error::FsError;
pub use markdown::{render_markdown, Heading, RenderOptions, RenderedDocument};
pub use mdx::{is_mdx_path, simplify_mdx};
