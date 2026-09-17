//! Markdown Viewer desktop shell.

mod commands;
mod menu;
mod protocol;
mod startup;
mod watcher;

use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_window_state::StateFlags;

use crate::startup::StartupPaths;
use crate::watcher::FileWatcher;

/// Label of the main window (see `tauri.conf.json`).
pub const MAIN_WINDOW: &str = "main";

const MAX_LOG_FILE_BYTES: u128 = 5 * 1024 * 1024;

fn log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let level = if cfg!(debug_assertions) { log::LevelFilter::Debug } else { log::LevelFilter::Info };
    tauri_plugin_log::Builder::new()
        .clear_targets()
        .targets([
            Target::new(TargetKind::LogDir { file_name: Some("markdown-viewer".to_owned()) }),
            Target::new(TargetKind::Stdout),
        ])
        .level(level)
        // Dependencies are noisy at debug level.
        .level_for("tao", log::LevelFilter::Info)
        .level_for("notify", log::LevelFilter::Info)
        .level_for("notify_debouncer_full", log::LevelFilter::Info)
        .max_file_size(MAX_LOG_FILE_BYTES)
        .rotation_strategy(RotationStrategy::KeepSome(3))
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use_launch_directory();
    let result = tauri::Builder::default()
        // Must be registered first so a second instance exits before doing any work.
        .plugin(tauri_plugin_single_instance::init(startup::on_second_instance))
        .plugin(log_plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::Builder::new().open_js_links_on_click(false).build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .register_asynchronous_uri_scheme_protocol(protocol::ASSET_SCHEME, protocol::handle)
        .menu(menu::build)
        .on_menu_event(menu::on_event)
        .setup(|app| {
            log::info!("Markdown Viewer {} starting", app.package_info().version);
            app.manage(StartupPaths::from_env());
            app.manage(FileWatcher::new(app.handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_document,
            commands::scan_folder,
            commands::check_files,
            commands::watch_file,
            commands::unwatch_file,
            commands::take_startup_paths,
            commands::set_menu_visible,
        ])
        .run(tauri::generate_context!());

    if let Err(err) = result {
        log::error!("application error: {err}");
        eprintln!("Markdown Viewer failed to start: {err}");
        std::process::exit(1);
    }
}

/// Restores the directory the user launched from (see [`mdv_core::cli::launch_directory`]),
/// so relative paths work for this process and for arguments forwarded by a second instance.
fn use_launch_directory() {
    let current = std::env::current_dir().ok();
    let wanted = mdv_core::cli::launch_directory(
        current.clone(),
        std::env::var_os("APPIMAGE"),
        std::env::var_os("OWD"),
    );
    if let Some(dir) = wanted.filter(|dir| Some(dir) != current.as_ref()) {
        if let Err(err) = std::env::set_current_dir(&dir) {
            log::warn!("cannot switch to the launch directory: {err}");
        }
    }
}
