//! IPC commands. Filesystem work runs on the blocking thread pool so the main
//! thread (and therefore the UI) never waits on disk I/O.

use std::path::PathBuf;

use mdv_core::fs::{files_exist, scan_directory, DirectoryTree, ScanOptions};
use mdv_core::{FsError, OpenedDocument, RenderOptions};
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
