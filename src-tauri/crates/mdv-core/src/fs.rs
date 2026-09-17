//! Read-only filesystem access used by the viewer.

use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::FsError;

/// File extensions treated as Markdown (compared case-insensitively).
pub const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd"];

/// Documents larger than this are refused instead of risking the webview.
pub const MAX_DOCUMENT_BYTES: u64 = 64 * 1024 * 1024;

/// Directory names that are never worth descending into.
const SKIPPED_DIRECTORIES: &[&str] = &["node_modules", "bower_components", "__pycache__"];

pub fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| MARKDOWN_EXTENSIONS.iter().any(|md| md.eq_ignore_ascii_case(ext)))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    /// Modification time in milliseconds since the Unix epoch.
    pub modified_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedFile {
    #[serde(flatten)]
    pub metadata: FileMetadata,
    pub content: String,
    /// True when the file was not valid UTF-8 and invalid sequences were replaced.
    pub lossy: bool,
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

fn metadata_for(path: &Path, meta: &fs::Metadata) -> FileMetadata {
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .and_then(|d| u64::try_from(d.as_millis()).ok());
    FileMetadata {
        path: path.to_string_lossy().into_owned(),
        name: file_name(path),
        size: meta.len(),
        modified_ms,
    }
}

/// Validates that `path` is an existing Markdown file and returns its metadata.
pub fn markdown_file_metadata(path: &Path) -> Result<FileMetadata, FsError> {
    if !is_markdown_path(path) {
        return Err(FsError::UnsupportedType);
    }
    let meta = fs::metadata(path)?;
    if !meta.is_file() {
        return Err(FsError::NotAFile);
    }
    Ok(metadata_for(path, &meta))
}

/// Reads a Markdown file. Only files with a Markdown extension can be read.
pub fn read_markdown_file(path: &Path) -> Result<LoadedFile, FsError> {
    let metadata = markdown_file_metadata(path)?;
    if metadata.size > MAX_DOCUMENT_BYTES {
        return Err(FsError::TooLarge { size: metadata.size, limit: MAX_DOCUMENT_BYTES });
    }
    let bytes = fs::read(path)?;
    let (content, lossy) = match String::from_utf8(bytes) {
        Ok(text) => (text, false),
        Err(err) => (String::from_utf8_lossy(err.as_bytes()).into_owned(), true),
    };
    // Strip a UTF-8 byte order mark so it does not end up in the first heading.
    let content = match content.strip_prefix('\u{feff}') {
        Some(stripped) => stripped.to_owned(),
        None => content,
    };
    Ok(LoadedFile { metadata, content, lossy })
}

/// Returns, for every path, whether it is an existing file.
pub fn files_exist(paths: &[PathBuf]) -> Vec<bool> {
    paths.iter().map(|p| p.is_file()).collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub is_markdown: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<DirectoryEntry>,
}

#[derive(Debug, Clone, Copy)]
pub struct ScanOptions {
    /// Include non-Markdown files.
    pub show_all_files: bool,
    pub max_depth: usize,
    pub max_entries: usize,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self { show_all_files: false, max_depth: 16, max_entries: 20_000 }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryTree {
    pub root: DirectoryEntry,
    pub markdown_file_count: usize,
    /// True when the scan stopped early because of `max_entries`.
    pub truncated: bool,
}

struct Scanner {
    options: ScanOptions,
    entries: usize,
    markdown_files: usize,
    truncated: bool,
}

impl Scanner {
    fn scan_dir(&mut self, dir: &Path, depth: usize) -> Vec<DirectoryEntry> {
        let Ok(read_dir) = fs::read_dir(dir) else {
            // Unreadable sub-folders are skipped rather than failing the whole tree.
            return Vec::new();
        };
        let mut result = Vec::new();
        for entry in read_dir.flatten() {
            if self.entries >= self.options.max_entries {
                self.truncated = true;
                break;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            // `file_type` does not follow symlinks, which keeps us out of cycles.
            let Ok(file_type) = entry.file_type() else { continue };
            let path = entry.path();
            if file_type.is_dir() {
                if SKIPPED_DIRECTORIES.contains(&name.as_str()) || depth >= self.options.max_depth {
                    continue;
                }
                let children = self.scan_dir(&path, depth + 1);
                if children.is_empty() && !self.options.show_all_files {
                    continue;
                }
                self.entries += 1;
                result.push(DirectoryEntry {
                    name,
                    path: path.to_string_lossy().into_owned(),
                    kind: EntryKind::Directory,
                    is_markdown: false,
                    children,
                });
            } else {
                // Symlinked files are fine to list; they are resolved when opened.
                let is_markdown = is_markdown_path(&path);
                if !is_markdown && !self.options.show_all_files {
                    continue;
                }
                if is_markdown {
                    self.markdown_files += 1;
                }
                self.entries += 1;
                result.push(DirectoryEntry {
                    name,
                    path: path.to_string_lossy().into_owned(),
                    kind: EntryKind::File,
                    is_markdown,
                    children: Vec::new(),
                });
            }
        }
        result.sort_by(compare_entries);
        result
    }
}

fn compare_entries(a: &DirectoryEntry, b: &DirectoryEntry) -> Ordering {
    let rank = |e: &DirectoryEntry| match e.kind {
        EntryKind::Directory => 0,
        EntryKind::File => 1,
    };
    rank(a).cmp(&rank(b)).then_with(|| natural_cmp(&a.name, &b.name))
}

/// Case-insensitive comparison that orders embedded numbers numerically
/// (`chapter-2.md` before `chapter-10.md`).
fn natural_cmp(a: &str, b: &str) -> Ordering {
    let mut a_chars = a.chars().peekable();
    let mut b_chars = b.chars().peekable();
    loop {
        match (a_chars.peek().copied(), b_chars.peek().copied()) {
            (None, None) => return a.cmp(b),
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let take_number = |chars: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut digits = String::new();
                    while let Some(c) = chars.peek().copied().filter(char::is_ascii_digit) {
                        digits.push(c);
                        chars.next();
                    }
                    digits
                };
                let (na, nb) = (take_number(&mut a_chars), take_number(&mut b_chars));
                let (ta, tb) = (na.trim_start_matches('0'), nb.trim_start_matches('0'));
                let ordering = ta.len().cmp(&tb.len()).then_with(|| ta.cmp(tb));
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
            (Some(x), Some(y)) => {
                let ordering = x.to_lowercase().cmp(y.to_lowercase());
                if ordering != Ordering::Equal {
                    return ordering;
                }
                a_chars.next();
                b_chars.next();
            }
        }
    }
}

/// Lists a folder, returning Markdown files (or all files) as a tree.
pub fn scan_directory(root: &Path, options: ScanOptions) -> Result<DirectoryTree, FsError> {
    let meta = fs::metadata(root)?;
    if !meta.is_dir() {
        return Err(FsError::NotADirectory);
    }
    // Surface permission problems on the root itself instead of showing an empty tree.
    fs::read_dir(root)?;
    let mut scanner = Scanner { options, entries: 0, markdown_files: 0, truncated: false };
    let children = scanner.scan_dir(root, 0);
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.to_string_lossy().into_owned());
    Ok(DirectoryTree {
        root: DirectoryEntry {
            name,
            path: root.to_string_lossy().into_owned(),
            kind: EntryKind::Directory,
            is_markdown: false,
            children,
        },
        markdown_file_count: scanner.markdown_files,
        truncated: scanner.truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn detects_markdown_extensions() {
        for name in ["a.md", "b.MARKDOWN", "c.mdown", "d.mkd", "e.Md"] {
            assert!(is_markdown_path(Path::new(name)), "{name}");
        }
        for name in ["a.txt", "md", "a.md.bak", "a.mdx"] {
            assert!(!is_markdown_path(Path::new(name)), "{name}");
        }
    }

    #[test]
    fn reads_valid_markdown() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("README.md");
        write(&path, "\u{feff}# Hello\n");
        let file = read_markdown_file(&path).unwrap();
        assert_eq!(file.content, "# Hello\n");
        assert_eq!(file.metadata.name, "README.md");
        assert_eq!(file.metadata.size, 11);
        assert!(file.metadata.modified_ms.is_some());
        assert!(!file.lossy);
    }

    #[test]
    fn reads_invalid_utf8_lossily() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("latin1.md");
        fs::write(&path, [b'c', b'a', b'f', 0xe9]).unwrap();
        let file = read_markdown_file(&path).unwrap();
        assert!(file.lossy);
        assert!(file.content.starts_with("caf"));
    }

    #[test]
    fn missing_file_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let err = read_markdown_file(&dir.path().join("gone.md")).unwrap_err();
        assert_eq!(err, FsError::NotFound);
    }

    #[test]
    fn refuses_non_markdown_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("secret.txt");
        write(&path, "x");
        assert_eq!(read_markdown_file(&path).unwrap_err(), FsError::UnsupportedType);
    }

    #[test]
    fn refuses_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("folder.md");
        fs::create_dir(&path).unwrap();
        assert_eq!(read_markdown_file(&path).unwrap_err(), FsError::NotAFile);
    }

    #[cfg(unix)]
    #[test]
    fn permission_denied_is_reported() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("locked.md");
        write(&path, "# locked");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();
        let result = read_markdown_file(&path);
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        // Root can read anything, so only assert when the permission actually applied.
        if let Err(err) = result {
            assert_eq!(err, FsError::PermissionDenied);
        }
    }

    #[test]
    fn detects_modification_and_deletion() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        write(&path, "one");
        let before = markdown_file_metadata(&path).unwrap();
        write(&path, "one two three");
        let after = markdown_file_metadata(&path).unwrap();
        assert_ne!(before.size, after.size);
        assert_eq!(read_markdown_file(&path).unwrap().content, "one two three");

        fs::remove_file(&path).unwrap();
        assert_eq!(markdown_file_metadata(&path).unwrap_err(), FsError::NotFound);
        assert_eq!(files_exist(&[path, dir.path().to_path_buf()]), [false, false]);
    }

    #[test]
    fn scans_markdown_tree() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write(&root.join("README.md"), "");
        write(&root.join("CHANGELOG.md"), "");
        write(&root.join("image.png"), "");
        write(&root.join("docs/api.md"), "");
        write(&root.join("docs/chapter-10.md"), "");
        write(&root.join("docs/chapter-2.md"), "");
        write(&root.join("src/main.rs"), "");
        write(&root.join("node_modules/pkg/README.md"), "");
        write(&root.join(".git/HEAD.md"), "");

        let tree = scan_directory(root, ScanOptions::default()).unwrap();
        let names: Vec<_> = tree.root.children.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["docs", "CHANGELOG.md", "README.md"]);
        let docs: Vec<_> = tree.root.children[0].children.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(docs, ["api.md", "chapter-2.md", "chapter-10.md"]);
        assert_eq!(tree.markdown_file_count, 5);
        assert!(!tree.truncated);

        let all = scan_directory(root, ScanOptions { show_all_files: true, ..Default::default() }).unwrap();
        let names: Vec<_> = all.root.children.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["docs", "src", "CHANGELOG.md", "image.png", "README.md"]);
        assert!(!all.root.children[3].is_markdown);
    }

    #[test]
    fn scan_respects_entry_limit() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..20 {
            write(&dir.path().join(format!("{i}.md")), "");
        }
        let tree = scan_directory(dir.path(), ScanOptions { max_entries: 5, ..Default::default() }).unwrap();
        assert_eq!(tree.root.children.len(), 5);
        assert!(tree.truncated);
    }

    #[test]
    fn scan_rejects_files_and_missing_paths() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        write(&file, "");
        assert_eq!(scan_directory(&file, ScanOptions::default()).unwrap_err(), FsError::NotADirectory);
        assert_eq!(
            scan_directory(&dir.path().join("missing"), ScanOptions::default()).unwrap_err(),
            FsError::NotFound
        );
    }

    #[test]
    fn natural_ordering() {
        let mut names = vec!["b10", "B2", "a", "b1", "b02x"];
        names.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(names, ["a", "b1", "B2", "b02x", "b10"]);
    }
}
