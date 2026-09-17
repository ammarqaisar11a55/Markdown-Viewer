//! Watches open documents for external changes and emits `file-changed`.

use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use mdv_core::watch::WatchRegistry;
use mdv_core::FsError;
use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use tauri::{AppHandle, Emitter, Runtime};

pub const FILE_CHANGED_EVENT: &str = "file-changed";

const DEBOUNCE_TIMEOUT: Duration = Duration::from_millis(250);

type Backend = Debouncer<RecommendedWatcher, RecommendedCache>;

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    // The protected data stays consistent even if a holder panicked.
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Shared, reference-counted file watcher.
///
/// Lock order: `registry` before `backend`. The debouncer callback only takes
/// `registry`, and the debouncer never invokes it while holding its own locks.
#[derive(Clone)]
pub struct FileWatcher {
    registry: Arc<Mutex<WatchRegistry>>,
    backend: Arc<Mutex<Option<Backend>>>,
}

impl FileWatcher {
    pub fn new<R: Runtime>(app: &AppHandle<R>) -> Self {
        let registry = Arc::new(Mutex::new(WatchRegistry::new()));
        let handler_registry = Arc::clone(&registry);
        let handler_app = app.clone();
        let handler = move |result: DebounceEventResult| match result {
            Ok(events) => {
                let rescan = events.iter().any(|event| event.need_rescan());
                let paths: Vec<&Path> = if rescan {
                    Vec::new()
                } else {
                    events.iter().flat_map(|event| event.paths.iter().map(|p| p.as_path())).collect()
                };
                if !rescan && paths.is_empty() {
                    return;
                }
                let changes = lock(&handler_registry).process(paths);
                for change in changes {
                    log::debug!("{} changed on disk ({:?})", change.path, change.kind);
                    if let Err(err) = handler_app.emit(FILE_CHANGED_EVENT, change) {
                        log::error!("failed to emit {FILE_CHANGED_EVENT}: {err}");
                    }
                }
            }
            Err(errors) => {
                for err in errors {
                    log::warn!("file watcher error: {err}");
                }
            }
        };
        let backend = match new_debouncer(DEBOUNCE_TIMEOUT, None, handler) {
            Ok(debouncer) => Some(debouncer),
            Err(err) => {
                log::error!("file watching is unavailable: {err}");
                None
            }
        };
        Self { registry, backend: Arc::new(Mutex::new(backend)) }
    }

    /// Starts (or re-references) watching `path`, which must be an absolute file path.
    pub fn watch(&self, path: &Path) -> Result<(), FsError> {
        if !path.is_absolute() || !path.is_file() {
            return Err(FsError::NotFound);
        }
        let mut registry = lock(&self.registry);
        let Some(dir) = registry.add(path)? else { return Ok(()) };
        let result = match lock(&self.backend).as_mut() {
            Some(backend) => backend
                .watch(&dir, RecursiveMode::NonRecursive)
                .map_err(|err| FsError::Io(format!("cannot watch {}: {err}", dir.display()))),
            None => Err(FsError::Io("file watching is unavailable".to_owned())),
        };
        if let Err(err) = result {
            registry.remove(path);
            log::warn!("{err}");
            return Err(err);
        }
        log::debug!("watching {}", dir.display());
        Ok(())
    }

    /// Releases one reference to `path`; unknown paths are ignored.
    pub fn unwatch(&self, path: &Path) {
        let mut registry = lock(&self.registry);
        let Some(dir) = registry.remove(path) else { return };
        if let Some(backend) = lock(&self.backend).as_mut() {
            // The directory may already be gone, in which case the OS dropped the watch.
            match backend.unwatch(&dir) {
                Ok(()) => log::debug!("stopped watching {}", dir.display()),
                Err(err) => log::debug!("unwatch {}: {err}", dir.display()),
            }
        }
    }
}
