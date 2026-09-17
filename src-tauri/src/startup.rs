//! Paths passed on the command line, at launch or by a second instance.

use std::path::Path;
use std::sync::{Mutex, PoisonError};

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::MAIN_WINDOW;

pub const OPEN_PATHS_EVENT: &str = "open-paths";

/// Paths the app was launched with; handed to the frontend once.
#[derive(Default)]
pub struct StartupPaths(Mutex<Vec<String>>);

impl StartupPaths {
    pub fn from_env() -> Self {
        let paths = std::env::current_dir()
            .map(|cwd| parse_args(std::env::args_os().skip(1), &cwd))
            .unwrap_or_else(|err| {
                log::warn!("cannot resolve the working directory: {err}");
                Vec::new()
            });
        if !paths.is_empty() {
            log::info!("launched with {} path(s)", paths.len());
        }
        Self(Mutex::new(paths))
    }

    pub fn take(&self) -> Vec<String> {
        std::mem::take(&mut *self.0.lock().unwrap_or_else(PoisonError::into_inner))
    }
}

fn parse_args<I, S>(args: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<std::ffi::OsString>,
{
    mdv_core::cli::collect_paths(args, cwd)
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

/// Handles a second launch: forwards its paths and brings the window forward.
pub fn on_second_instance<R: Runtime>(app: &AppHandle<R>, argv: Vec<String>, cwd: String) {
    let paths = parse_args(argv.into_iter().skip(1), Path::new(&cwd));
    log::info!("second instance started with {} path(s)", paths.len());
    if !paths.is_empty() {
        if let Err(err) = app.emit(OPEN_PATHS_EVENT, paths) {
            log::error!("failed to emit {OPEN_PATHS_EVENT}: {err}");
        }
    }
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        log::warn!("main window not found while focusing");
        return;
    };
    let focus = window.unminimize().and_then(|()| window.show()).and_then(|()| window.set_focus());
    if let Err(err) = focus {
        log::warn!("failed to focus the main window: {err}");
    }
}
