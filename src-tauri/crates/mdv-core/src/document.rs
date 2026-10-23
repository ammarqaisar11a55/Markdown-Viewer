//! Opening and saving a Markdown document: path validation, reading, writing
//! and rendering.

use std::path::Path;

use serde::Serialize;

use crate::fs::{create_markdown_file, read_markdown_file, write_markdown_file};
use crate::markdown::{render_markdown, Heading, RenderOptions, RenderedDocument};
use crate::mdx::{is_mdx_path, simplify_mdx};
use crate::FsError;

/// How a document's source is interpreted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentFlavor {
    Markdown,
    Mdx,
}

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
    pub flavor: DocumentFlavor,
    /// MDX only: imports, exports, comments or JSX were removed before rendering.
    pub simplified: bool,
}

/// Text rendered without touching the disk (the editor's unsaved draft).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedSource {
    pub html: String,
    pub headings: Vec<Heading>,
    pub word_count: usize,
    pub flavor: DocumentFlavor,
    pub simplified: bool,
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

/// Renders `source` the way the document at `path` is rendered: MDX documents
/// are simplified to Markdown first (see [`crate::mdx`]), everything else is
/// rendered as it is.
fn render_for_path(
    path: &Path,
    source: &str,
    options: &RenderOptions,
) -> (RenderedDocument, DocumentFlavor, bool) {
    if is_mdx_path(path) {
        let (markdown, simplified) = simplify_mdx(source);
        (render_markdown(&markdown, options), DocumentFlavor::Mdx, simplified)
    } else {
        (render_markdown(source, options), DocumentFlavor::Markdown, false)
    }
}

/// Reads and renders the Markdown file at `path`.
pub fn open_document(path: &Path, options: &RenderOptions) -> Result<OpenedDocument, FsError> {
    let canonical = canonicalize(path)?;
    let file = read_markdown_file(&canonical)?;
    let (rendered, flavor, simplified) = render_for_path(&canonical, &file.content, options);
    Ok(OpenedDocument {
        path: file.metadata.path,
        name: file.metadata.name,
        size: file.metadata.size,
        modified_ms: file.metadata.modified_ms,
        html: rendered.html,
        headings: rendered.headings,
        word_count: rendered.word_count,
        lossy: file.lossy,
        flavor,
        simplified,
    })
}

/// Renders unsaved text, without reading or writing anything.
///
/// `path` only selects the flavor, so the editor's preview matches what saving
/// the same text would produce.
pub fn render_source(path: &Path, source: &str, options: &RenderOptions) -> RenderedSource {
    let (rendered, flavor, simplified) = render_for_path(path, source, options);
    RenderedSource {
        html: rendered.html,
        headings: rendered.headings,
        word_count: rendered.word_count,
        flavor,
        simplified,
    }
}

/// Writes `content` to the document at `path` and returns the saved document.
///
/// The path is canonicalized *before* it is validated, so the checks in
/// [`write_markdown_file`] — Markdown extension, existing file — apply to the
/// real target rather than to the name of a link. A document (or a stale path
/// held by the frontend) can therefore only ever overwrite the existing
/// Markdown file the user opened: never a new path, and never the
/// non-Markdown file a symlink points at.
pub fn save_document(path: &Path, content: &str, options: &RenderOptions) -> Result<OpenedDocument, FsError> {
    let canonical = canonicalize(path)?;
    let metadata = write_markdown_file(&canonical, content)?;
    let (rendered, flavor, simplified) = render_for_path(&canonical, content, options);
    Ok(OpenedDocument {
        path: metadata.path,
        name: metadata.name,
        size: metadata.size,
        modified_ms: metadata.modified_ms,
        html: rendered.html,
        headings: rendered.headings,
        word_count: rendered.word_count,
        // The content is a Rust string, so what landed on disk is valid UTF-8.
        lossy: false,
        flavor,
        simplified,
    })
}

/// Creates an empty Markdown document at `path` and returns it rendered.
///
/// Unlike [`save_document`], the target does not exist yet, so the path cannot
/// be canonicalized as a whole. The *parent directory* is canonicalized
/// instead and the chosen file name is joined onto the result, which keeps the
/// same guarantees:
///
/// * the parent must already exist and be a directory — a missing folder is
///   reported rather than created, and `..` or a symlinked folder is resolved
///   before anything is touched, so the file lands exactly where the resolved
///   directory is;
/// * only the last component of `path` is used as the name, so no segment of a
///   path from the UI can escape that directory;
/// * the extension must be a Markdown one, and
///   [`create_markdown_file`] creates the file with `create_new`, so an
///   existing file or symlink is refused instead of being truncated.
///
/// This is why the frontend must get `path` from the operating system's own
/// save dialog and never from a text field of its own: the user, not the
/// document being viewed, picks the one directory this call may write to.
pub fn create_document(path: &Path, options: &RenderOptions) -> Result<OpenedDocument, FsError> {
    let name = path.file_name().ok_or(FsError::NotAFile)?;
    let parent = canonicalize(path.parent().ok_or(FsError::NotFound)?)?;
    if !parent.is_dir() {
        return Err(FsError::NotADirectory);
    }
    let target = parent.join(name);
    let metadata = create_markdown_file(&target)?;
    let (rendered, flavor, simplified) = render_for_path(&target, "", options);
    Ok(OpenedDocument {
        path: metadata.path,
        name: metadata.name,
        size: metadata.size,
        modified_ms: metadata.modified_ms,
        html: rendered.html,
        headings: rendered.headings,
        word_count: rendered.word_count,
        lossy: false,
        flavor,
        simplified,
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
        assert_eq!(doc.flavor, DocumentFlavor::Markdown);
        assert!(!doc.simplified);

        let json = serde_json::to_value(&doc).unwrap();
        for key in [
            "path",
            "name",
            "size",
            "modifiedMs",
            "html",
            "headings",
            "wordCount",
            "lossy",
            "flavor",
            "simplified",
        ] {
            assert!(json.get(key).is_some(), "missing {key}");
        }
        assert_eq!(json["flavor"], "markdown");
    }

    #[test]
    fn simplifies_mdx_before_rendering() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Guide.mdx");
        fs::write(&path, "import Note from './Note'\n\n# Title\n\n<Note kind=\"tip\">**Careful**</Note>\n")
            .unwrap();

        let doc = open_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(doc.flavor, DocumentFlavor::Mdx);
        assert!(doc.simplified);
        assert!(doc.html.contains("<h1 id=\"title\">"));
        assert!(doc.html.contains("<strong>Careful</strong>"), "{}", doc.html);
        assert!(!doc.html.contains("import"), "{}", doc.html);
        assert_eq!(serde_json::to_value(&doc).unwrap()["flavor"], "mdx");
    }

    #[test]
    fn plain_mdx_is_not_reported_as_simplified() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("plain.mdx");
        fs::write(&path, "# Title\n\nJust Markdown.\n").unwrap();
        let doc = open_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(doc.flavor, DocumentFlavor::Mdx);
        assert!(!doc.simplified);
    }

    #[test]
    fn markdown_documents_keep_mdx_syntax() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notes.md");
        fs::write(&path, "import Note from './Note'\n").unwrap();
        let doc = open_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(doc.flavor, DocumentFlavor::Markdown);
        assert!(!doc.simplified);
        assert!(doc.html.contains("import Note"), "{}", doc.html);
    }

    #[test]
    fn renders_unsaved_source_without_reading_the_file() {
        let options = RenderOptions::default();
        let missing = Path::new("/nonexistent/draft.md");
        let rendered = render_source(missing, "# Draft\n\ntwo words\n", &options);
        assert!(rendered.html.contains("<h1 id=\"draft\">"));
        assert_eq!(rendered.headings.len(), 1);
        assert_eq!(rendered.word_count, 3);
        assert_eq!(rendered.flavor, DocumentFlavor::Markdown);
        assert!(!rendered.simplified);

        let rendered = render_source(Path::new("/nonexistent/draft.mdx"), "<Note />\ntext\n", &options);
        assert_eq!(rendered.flavor, DocumentFlavor::Mdx);
        assert!(rendered.simplified);
        assert!(!rendered.html.contains("Note"), "{}", rendered.html);

        let json = serde_json::to_value(&rendered).unwrap();
        for key in ["html", "headings", "wordCount", "flavor", "simplified"] {
            assert!(json.get(key).is_some(), "missing {key}");
        }
    }

    #[test]
    fn saves_and_rerenders_the_document() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notes.md");
        fs::write(&path, "# Old\n").unwrap();
        let before = open_document(&path, &RenderOptions::default()).unwrap();

        let doc = save_document(&path, "# New\n\nmore words here\n", &RenderOptions::default()).unwrap();
        assert_eq!(doc.path, before.path);
        assert_eq!(doc.name, "notes.md");
        assert_eq!(doc.size, 23);
        assert_ne!(doc.size, before.size);
        assert!(doc.html.contains("<h1 id=\"new\">"));
        assert_eq!(doc.word_count, 4);
        assert!(!doc.lossy);
        assert_eq!(doc.flavor, DocumentFlavor::Markdown);
        assert_eq!(fs::read_to_string(&path).unwrap(), "# New\n\nmore words here\n");
    }

    #[test]
    fn saving_mdx_reports_simplification() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.mdx");
        fs::write(&path, "x\n").unwrap();
        let doc = save_document(&path, "<Note>**hi**</Note>\n", &RenderOptions::default()).unwrap();
        assert_eq!(doc.flavor, DocumentFlavor::Mdx);
        assert!(doc.simplified);
        assert!(doc.html.contains("<strong>hi</strong>"));
        // The file keeps the MDX the user wrote; only the rendering is simplified.
        assert_eq!(fs::read_to_string(&path).unwrap(), "<Note>**hi**</Note>\n");
    }

    #[test]
    fn save_rejects_relative_missing_and_unsupported_paths() {
        let options = RenderOptions::default();
        assert_eq!(save_document(Path::new("README.md"), "x", &options).unwrap_err(), FsError::NotFound);

        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("new.md");
        assert_eq!(save_document(&missing, "x", &options).unwrap_err(), FsError::NotFound);
        assert!(!missing.exists());

        let txt = dir.path().join("notes.txt");
        fs::write(&txt, "keep").unwrap();
        assert_eq!(save_document(&txt, "x", &options).unwrap_err(), FsError::UnsupportedType);
        assert_eq!(fs::read_to_string(&txt).unwrap(), "keep");
    }

    #[cfg(unix)]
    #[test]
    fn save_does_not_follow_a_link_to_a_non_markdown_file() {
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("profile.sh");
        fs::write(&secret, "# shell profile\n").unwrap();
        let link = dir.path().join("innocent.md");
        std::os::unix::fs::symlink(&secret, &link).unwrap();

        let err = save_document(&link, "overwritten", &RenderOptions::default()).unwrap_err();
        assert_eq!(err, FsError::UnsupportedType);
        assert_eq!(fs::read_to_string(&secret).unwrap(), "# shell profile\n");
    }

    #[cfg(unix)]
    #[test]
    fn save_follows_a_link_to_a_markdown_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("real.md");
        fs::write(&target, "old\n").unwrap();
        let link = dir.path().join("link.md");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        let doc = save_document(&link, "new\n", &RenderOptions::default()).unwrap();
        // The saved document reports the real file, not the link.
        assert_eq!(doc.path, dunce::canonicalize(&target).unwrap().to_string_lossy());
        assert_eq!(fs::read_to_string(&target).unwrap(), "new\n");
        // Replacing the target must not have replaced the link itself.
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
    }

    #[test]
    fn creates_an_empty_document_and_renders_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("untitled.md");

        let doc = create_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(doc.name, "untitled.md");
        assert_eq!(doc.path, dunce::canonicalize(&path).unwrap().to_string_lossy());
        assert_eq!(doc.size, 0);
        assert_eq!(doc.html, "");
        assert_eq!(doc.word_count, 0);
        assert!(doc.headings.is_empty());
        assert!(!doc.lossy);
        assert_eq!(doc.flavor, DocumentFlavor::Markdown);
        assert!(!doc.simplified);
        assert_eq!(fs::read_to_string(&path).unwrap(), "");

        // The new document can be opened and edited like any other.
        let opened = open_document(&path, &RenderOptions::default()).unwrap();
        assert_eq!(opened.path, doc.path);
        save_document(&path, "# Started\n", &RenderOptions::default()).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "# Started\n");
    }

    #[test]
    fn creates_mdx_documents_too() {
        let dir = tempfile::tempdir().unwrap();
        let doc = create_document(&dir.path().join("notes.mdx"), &RenderOptions::default()).unwrap();
        assert_eq!(doc.flavor, DocumentFlavor::Mdx);
        assert!(!doc.simplified);
    }

    #[test]
    fn create_resolves_the_parent_directory() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        let doc = create_document(&dir.path().join("sub/../a.md"), &RenderOptions::default()).unwrap();
        assert!(!doc.path.contains(".."));
        assert!(dir.path().join("a.md").is_file());
        assert!(!dir.path().join("sub/a.md").exists());
    }

    #[test]
    fn create_refuses_existing_missing_and_unsupported_paths() {
        let options = RenderOptions::default();
        // Relative paths depend on the process directory and are refused.
        assert_eq!(create_document(Path::new("new.md"), &options).unwrap_err(), FsError::NotFound);

        let dir = tempfile::tempdir().unwrap();
        let existing = dir.path().join("notes.md");
        fs::write(&existing, "# Precious\n").unwrap();
        assert_eq!(create_document(&existing, &options).unwrap_err(), FsError::AlreadyExists);
        assert_eq!(fs::read_to_string(&existing).unwrap(), "# Precious\n");

        let txt = dir.path().join("notes.txt");
        assert_eq!(create_document(&txt, &options).unwrap_err(), FsError::UnsupportedType);
        assert!(!txt.exists());

        // A missing parent folder is reported, never created.
        let nested = dir.path().join("gone/new.md");
        assert_eq!(create_document(&nested, &options).unwrap_err(), FsError::NotFound);
        assert!(!dir.path().join("gone").exists());

        // A file where a folder is expected is not a folder.
        let file_parent = existing.join("new.md");
        assert_eq!(create_document(&file_parent, &options).unwrap_err(), FsError::NotADirectory);
    }

    #[cfg(unix)]
    #[test]
    fn create_does_not_follow_a_link_to_a_non_markdown_file() {
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("profile.sh");
        fs::write(&secret, "# shell profile\n").unwrap();
        let link = dir.path().join("innocent.md");
        std::os::unix::fs::symlink(&secret, &link).unwrap();

        let err = create_document(&link, &RenderOptions::default()).unwrap_err();
        assert_eq!(err, FsError::AlreadyExists);
        assert_eq!(fs::read_to_string(&secret).unwrap(), "# shell profile\n");
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
    }

    #[cfg(unix)]
    #[test]
    fn create_in_a_read_only_folder_is_refused() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path().join("locked");
        fs::create_dir(&folder).unwrap();
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o555)).unwrap();
        let result = create_document(&folder.join("new.md"), &RenderOptions::default());
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o755)).unwrap();
        // Root can write anywhere, so only assert when the mode actually applied.
        if let Err(err) = result {
            assert_eq!(err, FsError::PermissionDenied);
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
