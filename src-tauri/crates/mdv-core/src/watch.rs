//! Bookkeeping for watched documents, independent of the notification backend.
//!
//! The desktop shell watches the *parent directory* of every open document
//! (non-recursively) so that atomic saves — write to a temporary file, then
//! rename over the original — and deletions are observed reliably. Raw events
//! are only used as a hint: each affected document is re-examined with `stat`
//! and a change is reported only when its observable state actually changed.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::FsError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Modified,
    Removed,
}

/// Payload of the `file-changed` event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub kind: ChangeKind,
    pub modified_ms: Option<u64>,
}

/// Observable state of a file; `None` means it does not exist (as a file).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Signature {
    modified_ns: Option<u128>,
    size: u64,
}

impl Signature {
    fn read(path: &Path) -> Option<Self> {
        let meta = fs::metadata(path).ok().filter(fs::Metadata::is_file)?;
        let modified_ns =
            meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_nanos());
        Some(Self { modified_ns, size: meta.len() })
    }

    fn modified_ms(&self) -> Option<u64> {
        self.modified_ns.and_then(|ns| u64::try_from(ns / 1_000_000).ok())
    }
}

#[derive(Debug)]
struct WatchedFile {
    refs: usize,
    signature: Option<Signature>,
}

/// Reference-counted set of watched files and the directories backing them.
#[derive(Debug, Default)]
pub struct WatchRegistry {
    files: HashMap<PathBuf, WatchedFile>,
    dirs: HashMap<PathBuf, usize>,
}

impl WatchRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers one more watcher of `file`.
    ///
    /// Returns the directory that must start being watched, if any.
    pub fn add(&mut self, file: &Path) -> Result<Option<PathBuf>, FsError> {
        if let Some(entry) = self.files.get_mut(file) {
            entry.refs += 1;
            return Ok(None);
        }
        let dir = parent_dir(file)?;
        self.files.insert(file.to_path_buf(), WatchedFile { refs: 1, signature: Signature::read(file) });
        let dir_refs = self.dirs.entry(dir.clone()).or_insert(0);
        *dir_refs += 1;
        Ok((*dir_refs == 1).then_some(dir))
    }

    /// Releases one watcher of `file`.
    ///
    /// Returns the directory that is no longer needed, if any.
    pub fn remove(&mut self, file: &Path) -> Option<PathBuf> {
        let entry = self.files.get_mut(file)?;
        entry.refs -= 1;
        if entry.refs > 0 {
            return None;
        }
        self.files.remove(file);
        let dir = parent_dir(file).ok()?;
        let dir_refs = self.dirs.get_mut(&dir)?;
        *dir_refs -= 1;
        if *dir_refs > 0 {
            return None;
        }
        self.dirs.remove(&dir);
        Some(dir)
    }

    pub fn is_watched(&self, file: &Path) -> bool {
        self.files.contains_key(file)
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }

    /// Re-examines the documents affected by a batch of raw event paths and
    /// returns the changes to report.
    ///
    /// An event path matches a document when it is the document itself or its
    /// directory (backends report some directory-level events that way). An
    /// empty batch of paths (e.g. a backend rescan request) re-examines every
    /// document.
    pub fn process<'a, I>(&mut self, event_paths: I) -> Vec<FileChange>
    where
        I: IntoIterator<Item = &'a Path>,
    {
        let event_paths: Vec<&Path> = event_paths.into_iter().collect();
        let mut changes = Vec::new();
        for (path, entry) in &mut self.files {
            let affected = event_paths.is_empty()
                || event_paths.iter().any(|p| *p == path.as_path() || Some(*p) == path.parent());
            if !affected {
                continue;
            }
            let current = Signature::read(path);
            if current == entry.signature {
                continue;
            }
            entry.signature = current;
            let path = path.to_string_lossy().into_owned();
            changes.push(match current {
                Some(signature) => {
                    FileChange { path, kind: ChangeKind::Modified, modified_ms: signature.modified_ms() }
                }
                None => FileChange { path, kind: ChangeKind::Removed, modified_ms: None },
            });
        }
        changes.sort_by(|a, b| a.path.cmp(&b.path));
        changes
    }
}

fn parent_dir(file: &Path) -> Result<PathBuf, FsError> {
    file.parent().filter(|p| !p.as_os_str().is_empty()).map(Path::to_path_buf).ok_or(FsError::NotAFile)
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, SystemTime};

    use super::*;

    fn touch(path: &Path, content: &str, offset_secs: u64) {
        fs::write(path, content).unwrap();
        let file = fs::File::options().write(true).open(path).unwrap();
        file.set_modified(SystemTime::now() + Duration::from_secs(offset_secs)).unwrap();
    }

    #[test]
    fn reference_counts_files_and_directories() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.md");
        let b = dir.path().join("b.md");
        let mut registry = WatchRegistry::new();

        assert_eq!(registry.add(&a).unwrap(), Some(dir.path().to_path_buf()));
        assert_eq!(registry.add(&a).unwrap(), None);
        assert_eq!(registry.add(&b).unwrap(), None);
        assert!(registry.is_watched(&a));

        assert_eq!(registry.remove(&a), None);
        assert!(registry.is_watched(&a));
        assert_eq!(registry.remove(&a), None);
        assert!(!registry.is_watched(&a));
        assert_eq!(registry.remove(&a), None);
        assert_eq!(registry.remove(&b), Some(dir.path().to_path_buf()));
        assert!(registry.is_empty());
    }

    #[test]
    fn rejects_paths_without_parent() {
        let mut registry = WatchRegistry::new();
        assert_eq!(registry.add(Path::new("a.md")), Err(FsError::NotAFile));
    }

    #[test]
    fn reports_modification_removal_and_recreation() {
        let dir = tempfile::tempdir().unwrap();
        let doc = dir.path().join("doc.md");
        let other = dir.path().join("other.md");
        touch(&doc, "one", 0);
        let mut registry = WatchRegistry::new();
        registry.add(&doc).unwrap();

        // Unrelated paths and unchanged files produce nothing.
        assert!(registry.process([other.as_path()]).is_empty());
        assert!(registry.process([doc.as_path()]).is_empty());

        touch(&doc, "one two", 5);
        let changes = registry.process([doc.as_path()]);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, ChangeKind::Modified);
        assert!(changes[0].modified_ms.is_some());
        assert_eq!(changes[0].path, doc.to_string_lossy());
        // Already reported.
        assert!(registry.process([doc.as_path()]).is_empty());

        fs::remove_file(&doc).unwrap();
        let changes = registry.process([doc.as_path()]);
        assert_eq!(
            changes,
            [FileChange { path: doc.to_string_lossy().into(), kind: ChangeKind::Removed, modified_ms: None }]
        );

        touch(&doc, "back", 10);
        assert_eq!(registry.process([dir.path()])[0].kind, ChangeKind::Modified);
    }

    #[test]
    fn detects_atomic_rename_over_the_document() {
        let dir = tempfile::tempdir().unwrap();
        let doc = dir.path().join("doc.md");
        let tmp = dir.path().join(".doc.md.tmp");
        touch(&doc, "old", 0);
        let mut registry = WatchRegistry::new();
        registry.add(&doc).unwrap();

        touch(&tmp, "new content", 5);
        fs::rename(&tmp, &doc).unwrap();
        let changes = registry.process([tmp.as_path(), doc.as_path()]);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, ChangeKind::Modified);
    }

    #[test]
    fn empty_event_batch_rechecks_everything() {
        let dir = tempfile::tempdir().unwrap();
        let doc = dir.path().join("doc.md");
        touch(&doc, "a", 0);
        let mut registry = WatchRegistry::new();
        registry.add(&doc).unwrap();
        fs::remove_file(&doc).unwrap();
        assert_eq!(registry.process(std::iter::empty())[0].kind, ChangeKind::Removed);
    }

    #[test]
    fn serializes_payload_in_camel_case() {
        let change = FileChange { path: "/a.md".into(), kind: ChangeKind::Removed, modified_ms: None };
        let json = serde_json::to_value(change).unwrap();
        assert_eq!(json, serde_json::json!({ "path": "/a.md", "kind": "removed", "modifiedMs": null }));
    }
}
