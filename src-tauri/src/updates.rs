//! Updating an installation the Tauri updater cannot replace itself.
//!
//! The updater can swap an AppImage or run a Windows installer, but a `.deb` is
//! unpacked into root-owned files under `/usr` that only the package manager
//! may touch. On that install flavor the app downloads the signed package
//! itself and hands it to `apt-get` through `pkexec`, which asks the user for
//! authorisation. See [`install_deb_update`] for the threat model.

use mdv_core::install::InstallFlavor;

#[cfg(target_os = "linux")]
use serde::Serialize;

/// Download progress of a package update.
///
/// The payload is shaped exactly like the updater plugin's own `DownloadEvent`,
/// so the frontend feeds both install paths through one progress handler.
#[cfg(target_os = "linux")]
#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
enum ProgressEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        #[serde(skip_serializing_if = "Option::is_none")]
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

/// Event carrying [`ProgressEvent`] while a package update downloads.
pub const UPDATE_PROGRESS_EVENT: &str = "update-progress";

/// What a `.deb` update attempt ended in, and the package it downloaded.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebUpdateReport {
    outcome: mdv_core::install::DebInstallOutcome,
    /// Version of the downloaded package.
    version: String,
    /// Where the package was written, so the app can reveal it in the file
    /// manager when it could not be installed automatically.
    path: String,
}

/// How this copy of the app was installed, so the frontend knows which update
/// path to offer. Constant for the lifetime of the process.
#[tauri::command]
pub fn install_flavor() -> InstallFlavor {
    let flavor =
        mdv_core::install::install_flavor(std::env::current_exe().ok(), std::env::var_os("APPIMAGE"));
    log::debug!("install flavor: {flavor:?}");
    flavor
}

#[cfg(target_os = "linux")]
mod deb {
    use std::fs::{self, DirBuilder, OpenOptions};
    use std::io::{self, ErrorKind, Write};
    use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
    use std::path::{Path, PathBuf};
    use std::process::{Command, Stdio};
    use std::time::{SystemTime, UNIX_EPOCH};

    use mdv_core::install::{deb_install_outcome, DebInstallOutcome};
    use tauri::{AppHandle, Emitter, Runtime};
    use tauri_plugin_updater::UpdaterExt;

    use super::{DebUpdateReport, ProgressEvent, UPDATE_PROGRESS_EVENT};

    /// Key of the `.deb` entry in the release manifest.
    const DEB_TARGET: &str = "linux-x86_64-deb";
    /// The authorisation helper, looked up on `PATH` by the operating system.
    const PKEXEC: &str = "pkexec";
    /// Fixed argument vector for the installer; only the package path, which
    /// this module chose itself, is appended.
    const INSTALL_ARGV: &[&str] = &["apt-get", "install", "-y", "--allow-downgrades"];
    /// Shown instead of whatever the package manager printed.
    const INSTALL_FAILED: &str = "The system package installer could not install the update.";

    fn emit<R: Runtime>(app: &AppHandle<R>, event: ProgressEvent) {
        if let Err(err) = app.emit(UPDATE_PROGRESS_EVENT, event) {
            log::warn!("failed to emit {UPDATE_PROGRESS_EVENT}: {err}");
        }
    }

    /// Logs the technical reason and answers with a sentence fit for the UI.
    fn failure(action: &str, err: impl std::fmt::Display) -> String {
        log::error!("cannot {action}: {err}");
        format!("Markdown Viewer could not {action}.")
    }

    /// Creates the private directory the package is written to.
    ///
    /// The name is unique per attempt and `create` fails rather than reusing an
    /// existing path, so a directory or symlink planted by another user is never
    /// written into, and the restrictive mode is set by the call that creates
    /// it rather than afterwards. The OS temp directory is cleared on reboot,
    /// so a package left behind for the package manager does not pile up.
    fn create_private_dir() -> io::Result<PathBuf> {
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |since| since.as_nanos());
        let dir =
            std::env::temp_dir().join(format!("markdown-viewer-update.{}.{unique}", std::process::id()));
        DirBuilder::new().mode(0o700).create(&dir)?;
        Ok(dir)
    }

    /// Writes the verified package, readable by the package manager running as
    /// root but writable only by us.
    fn write_package(path: &Path, bytes: &[u8]) -> io::Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).mode(0o644).open(path)?;
        file.write_all(bytes)?;
        file.sync_all()
    }

    fn discard(dir: &Path) {
        if let Err(err) = fs::remove_dir_all(dir) {
            log::warn!("could not clean up {}: {err}", dir.display());
        }
    }

    /// Runs the package manager and reports what it did.
    ///
    /// The exit status is classified by [`deb_install_outcome`]; only the log
    /// sees the installer's own output.
    fn run_installer(path: &Path) -> DebInstallOutcome {
        let output = match Command::new(PKEXEC)
            .args(INSTALL_ARGV)
            .arg(path)
            // Nothing may prompt on a terminal the app does not have.
            .stdin(Stdio::null())
            .output()
        {
            Ok(output) => output,
            Err(err) if err.kind() == ErrorKind::NotFound => {
                log::warn!("{PKEXEC} is not installed; leaving the package for the user");
                return DebInstallOutcome::InstallerMissing;
            }
            Err(err) => {
                log::error!("cannot run {PKEXEC}: {err}");
                return DebInstallOutcome::Failed;
            }
        };
        let outcome = deb_install_outcome(output.status.code());
        if matches!(outcome, DebInstallOutcome::Failed) {
            log::error!(
                "{PKEXEC} {} exited with {}: {}",
                INSTALL_ARGV.join(" "),
                output.status,
                String::from_utf8_lossy(&output.stderr).trim()
            );
        } else {
            log::info!("{PKEXEC} {} finished: {outcome:?}", INSTALL_ARGV.join(" "));
        }
        outcome
    }

    /// Writes the package and installs it, cleaning up unless the file is still
    /// needed: the package manager may still be reading it after a successful
    /// install, and the user needs it when there is no installer to run.
    fn install_package(version: String, bytes: &[u8]) -> Result<DebUpdateReport, String> {
        let dir = create_private_dir().map_err(|err| failure("prepare the download", err))?;
        let path = dir.join(format!("markdown-viewer_{version}_amd64.deb"));
        if let Err(err) = write_package(&path, bytes) {
            discard(&dir);
            return Err(failure("save the downloaded update", err));
        }

        let outcome = run_installer(&path);
        match outcome {
            DebInstallOutcome::Installed | DebInstallOutcome::InstallerMissing => {}
            DebInstallOutcome::Cancelled | DebInstallOutcome::Failed => discard(&dir),
        }
        if matches!(outcome, DebInstallOutcome::Failed) {
            return Err(INSTALL_FAILED.to_owned());
        }
        Ok(DebUpdateReport { outcome, version, path: path.to_string_lossy().into_owned() })
    }

    pub async fn install<R: Runtime>(app: AppHandle<R>) -> Result<DebUpdateReport, String> {
        let updater = app
            .updater_builder()
            .target(DEB_TARGET)
            .build()
            .map_err(|err| failure("prepare the update", err))?;
        let Some(update) = updater.check().await.map_err(|err| failure("check for the update", err))? else {
            log::info!("no {DEB_TARGET} update to install");
            return Err("There is no update to install.".to_owned());
        };

        // `download` verifies the package against the public key compiled into
        // the app and only then returns the bytes, so nothing unverified is
        // ever written to disk, let alone handed to the package manager.
        let progress = app.clone();
        let finished = app.clone();
        let mut started = false;
        let bytes = update
            .download(
                move |chunk, total| {
                    if !started {
                        started = true;
                        emit(&progress, ProgressEvent::Started { content_length: total });
                    }
                    emit(&progress, ProgressEvent::Progress { chunk_length: chunk });
                },
                move || emit(&finished, ProgressEvent::Finished),
            )
            .await
            .map_err(|err| failure("download the update", err))?;

        let version = update.version.clone();
        log::info!("downloaded {} bytes of version {version}, installing", bytes.len());
        tauri::async_runtime::spawn_blocking(move || install_package(version, &bytes))
            .await
            .map_err(|err| failure("install the update", err))?
    }
}

/// Installs the update as a system package.
///
/// Downloads the `.deb` announced for `linux-x86_64-deb`, writes it to a
/// private directory of our own and runs
/// `pkexec apt-get install -y --allow-downgrades <path>`.
///
/// # Why handing a file to a privileged process is safe here
///
/// * **The bytes are verified first.** `Update::download` checks the package
///   against the minisign public key compiled into the app before it returns,
///   so a tampered download never reaches disk or the package manager.
/// * **We choose the path.** The package is written into a freshly created,
///   `0700` directory under the OS temp directory, with a name this process
///   builds from the version it just verified. Nothing from a document, a link
///   or the webview takes part in it.
/// * **Fixed argument vector, no shell.** The program and its flags are
///   compile-time constants passed as separate arguments to `Command`, which
///   `exec`s `pkexec` directly. There is no shell to quote for, and the only
///   variable argument is the path above.
/// * **The user authorises the privileged part.** The app itself stays
///   unprivileged: polkit prompts for the user's own password and may refuse,
///   which this command reports as a cancellation rather than an error.
/// * **Nothing is hidden.** A failing package manager has its output logged and
///   the temporary file removed; the UI only ever sees a friendly sentence.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn install_deb_update<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<DebUpdateReport, String> {
    deb::install(app).await
}

/// Rejects on platforms whose installations the updater handles itself.
#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn install_deb_update() -> Result<DebUpdateReport, String> {
    Err("Markdown Viewer only installs system packages on Linux.".to_owned())
}
