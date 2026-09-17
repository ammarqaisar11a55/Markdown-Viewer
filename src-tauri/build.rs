/// App commands; each gets `allow-<command>` / `deny-<command>` permissions
/// that `capabilities/default.json` grants explicitly.
const COMMANDS: &[&str] = &[
    "open_document",
    "scan_folder",
    "check_files",
    "watch_file",
    "unwatch_file",
    "take_startup_paths",
    "set_menu_visible",
];

fn main() {
    let attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));
    if let Err(err) = tauri_build::try_build(attributes) {
        panic!("tauri build failed: {err:#}");
    }
}
