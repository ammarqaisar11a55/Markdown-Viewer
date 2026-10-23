//! IPC commands. Filesystem work runs on the blocking thread pool so the main
//! thread (and therefore the UI) never waits on disk I/O.

use std::path::{Path, PathBuf};

use mdv_core::fs::{files_exist, read_markdown_file, scan_directory, DirectoryTree, LoadedFile, ScanOptions};
use mdv_core::{FsError, OpenedDocument, RenderOptions, RenderedSource};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::startup::StartupPaths;
use crate::watcher::FileWatcher;
use crate::MAIN_WINDOW;

async fn blocking<T, F>(task: F) -> Result<T, FsError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, FsError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task).await.map_err(|err| {
        log::error!("background task failed: {err}");
        FsError::Io("background task failed".to_owned())
    })?
}

fn log_failure<T>(action: &str, path: &str, result: Result<T, FsError>) -> Result<T, FsError> {
    if let Err(err) = &result {
        log::warn!("{action} {path}: {err}");
    }
    result
}

#[tauri::command]
pub async fn open_document(path: String, options: RenderOptions) -> Result<OpenedDocument, FsError> {
    let target = PathBuf::from(&path);
    let result = blocking(move || mdv_core::open_document(&target, &options)).await;
    log_failure("open", &path, result)
}

/// Reads the raw text of a document, for editing rather than rendering.
#[tauri::command]
pub async fn read_source(path: String) -> Result<LoadedFile, FsError> {
    let target = PathBuf::from(&path);
    let result = blocking(move || {
        let canonical = mdv_core::document::canonicalize(&target)?;
        read_markdown_file(&canonical)
    })
    .await;
    log_failure("read", &path, result)
}

/// Renders unsaved editor text; nothing is read from or written to disk.
#[tauri::command]
pub async fn render_source(
    path: String,
    source: String,
    options: RenderOptions,
) -> Result<RenderedSource, FsError> {
    let target = PathBuf::from(&path);
    let result = blocking(move || Ok(mdv_core::render_source(&target, &source, &options))).await;
    log_failure("render", &path, result)
}

/// Writes the document back to disk and returns it re-rendered.
#[tauri::command]
pub async fn save_document(
    watcher: State<'_, FileWatcher>,
    path: String,
    content: String,
    options: RenderOptions,
) -> Result<OpenedDocument, FsError> {
    let watcher = watcher.inner().clone();
    let target = PathBuf::from(&path);
    let result = blocking(move || {
        let document = mdv_core::save_document(&target, &content, &options)?;
        // Our own write must not come back as a `file-changed` event.
        watcher.refresh(Path::new(&document.path));
        Ok(document)
    })
    .await;
    log_failure("save", &path, result)
}

/// Creates a new, empty Markdown document and returns it rendered.
///
/// `path` must come from the operating system's own save dialog (see
/// `pickNewMarkdownFile` in the frontend), never from a text field inside the
/// app: this command is the whole reason the app can create a file at all, so
/// the user — not a document, a link in one, or a stale path held by the UI —
/// chooses where it goes.
///
/// It refuses, in [`mdv_core::create_document`]:
///
/// * a path whose extension is not a Markdown one (`unsupportedType`), so no
///   other kind of file can be created;
/// * a path that already exists, including a symlink (`alreadyExists`) — the
///   file is created with `create_new`, so an existing document can never be
///   truncated and a link can never be followed to its target;
/// * a parent folder that is missing (`notFound`), is not a folder
///   (`notADirectory`) or is not writable (`permissionDenied`); nothing is ever
///   created recursively.
///
/// The file is created empty; putting content in it goes through the existing
/// [`save_document`] path, which keeps a single, narrow place that writes bytes.
#[tauri::command]
pub async fn create_document(path: String, options: RenderOptions) -> Result<OpenedDocument, FsError> {
    let target = PathBuf::from(&path);
    let result = blocking(move || mdv_core::create_document(&target, &options)).await;
    log_failure("create", &path, result)
}

#[tauri::command]
pub async fn scan_folder(path: String, show_all_files: bool) -> Result<DirectoryTree, FsError> {
    let target = PathBuf::from(&path);
    let result = blocking(move || {
        let root = mdv_core::document::canonicalize(&target)?;
        scan_directory(&root, ScanOptions { show_all_files, ..ScanOptions::default() })
    })
    .await;
    log_failure("scan", &path, result)
}

#[tauri::command]
pub async fn check_files(paths: Vec<String>) -> Result<Vec<bool>, FsError> {
    blocking(move || {
        let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        Ok(files_exist(&paths))
    })
    .await
}

#[tauri::command]
pub async fn watch_file(watcher: State<'_, FileWatcher>, path: String) -> Result<(), FsError> {
    let watcher = watcher.inner().clone();
    let target = PathBuf::from(&path);
    let result = blocking(move || watcher.watch(&target)).await;
    log_failure("watch", &path, result)
}

#[tauri::command]
pub async fn unwatch_file(watcher: State<'_, FileWatcher>, path: String) -> Result<(), FsError> {
    let watcher = watcher.inner().clone();
    blocking(move || {
        watcher.unwatch(&PathBuf::from(path));
        Ok(())
    })
    .await
}

#[tauri::command]
pub fn take_startup_paths(startup: State<'_, StartupPaths>) -> Vec<String> {
    startup.take()
}

#[tauri::command]
pub fn set_menu_visible<R: Runtime>(app: AppHandle<R>, visible: bool) -> Result<(), String> {
    let window = app.get_webview_window(MAIN_WINDOW).ok_or_else(|| "window unavailable".to_owned())?;
    let result = if visible { window.show_menu() } else { window.hide_menu() };
    result.map_err(|err| {
        log::warn!("failed to change menu visibility: {err}");
        "menu unavailable".to_owned()
    })
}
