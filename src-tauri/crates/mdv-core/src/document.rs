//! Opening a Markdown document: path validation, reading and rendering.

use std::path::Path;

use serde::Serialize;

use crate::fs::read_markdown_file;
use crate::markdown::{render_markdown, Heading, RenderOptions};
use crate::FsError;

/// A document ready to be displayed by the viewer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDocument {
    /// Canonical absolute path.
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified_ms: Option<u64>,
    /// Sanitized HTML.
    pub html: String,
    pub headings: Vec<Heading>,
    pub word_count: usize,
    /// The file was not valid UTF-8; invalid bytes were replaced.
    pub lossy: bool,
}

/// Canonicalizes `path` without the Windows `\\?\` verbatim prefix.
///
/// Only absolute paths are accepted: relative paths would silently depend on
/// the working directory of the process.
pub fn canonicalize(path: &Path) -> Result<std::path::PathBuf, FsError> {
    if !path.is_absolute() {
        return Err(FsError::NotFound);
    }
    Ok(dunce::canonicalize(path)?)
}

/// Reads and renders the Markdown file at `path`.
pub fn open_document(path: &Path, options: &RenderOptions) -> Result<OpenedDocument, FsError> {
    let canonical = canonicalize(path)?;
    let file = read_markdown_file(&canonical)?;
    let rendered = render_markdown(&file.content, options);
    Ok(OpenedDocument {
        path: file.metadata.path,
        name: file.metadata.name,
        size: file.metadata.size,
        modified_ms: file.metadata.modified_ms,
        html: rendered.html,
        headings: rendered.headings,
        word_count: rendered.word_count,
        lossy: file.lossy,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn opens_and_renders_markdown() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Guide.md");
        fs::write(&path, "# Title\n\nSome words here.\n").unwrap();

        let doc = open_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(doc.name, "Guide.md");
        assert_eq!(doc.path, dunce::canonicalize(&path).unwrap().to_string_lossy());
        assert_eq!(doc.headings.len(), 1);
        assert_eq!(doc.word_count, 4);
        assert!(doc.html.contains("<h1 id=\"title\">"));
        assert!(!doc.lossy);

        let json = serde_json::to_value(&doc).unwrap();
        for key in ["path", "name", "size", "modifiedMs", "html", "headings", "wordCount", "lossy"] {
            assert!(json.get(key).is_some(), "missing {key}");
        }
    }

    #[test]
    fn resolves_dot_segments() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("a.md"), "x").unwrap();
        let doc = open_document(&dir.path().join("sub/../a.md"), &RenderOptions::default()).unwrap();
        assert!(!doc.path.contains(".."));
    }

    #[test]
    fn rejects_relative_missing_and_unsupported_paths() {
        let options = RenderOptions::default();
        assert_eq!(open_document(Path::new("README.md"), &options).unwrap_err(), FsError::NotFound);

        let dir = tempfile::tempdir().unwrap();
        assert_eq!(open_document(&dir.path().join("none.md"), &options).unwrap_err(), FsError::NotFound);

        let txt = dir.path().join("notes.txt");
        fs::write(&txt, "x").unwrap();
        assert_eq!(open_document(&txt, &options).unwrap_err(), FsError::UnsupportedType);
    }
}
