//! How the app was installed, and what the system package installer made of an
//! update.
//!
//! Both decisions are pure: the shell crate looks up the executable path, the
//! environment and the exit status of the installer, and this module says what
//! they mean. That keeps them unit-testable without a window, a package manager
//! or an elevated process.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Install prefix a system package unpacks into.
const SYSTEM_PREFIX: &str = "/usr";

/// How this copy of Markdown Viewer was installed, which decides how it can
/// update itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallFlavor {
    /// A self-contained AppImage: the updater replaces the file in place.
    AppImage,
    /// A system package under [`SYSTEM_PREFIX`]: its files are root-owned and
    /// tracked by the package manager, so only the package manager may replace
    /// them.
    Deb,
    /// A snap: snapd refreshes it from the store on its own, and the app
    /// cannot write into its own read-only mount even if it wanted to.
    Snap,
    /// Anything else — the Windows installer, or a build started from a source
    /// tree — where the updater's own install path applies.
    Other,
}

/// Decides the install flavor from the running executable and the environment.
///
/// `executable` is the resolved path of the running binary, `appimage` the
/// value of the `APPIMAGE` variable and `snap` the value of `SNAP`, all looked
/// up by the caller.
///
/// The environment is checked before the path because both an AppImage and a
/// snap run their binary from a mount point that can itself sit under
/// [`SYSTEM_PREFIX`] — a snap's does exactly that (`/snap/<name>/…/usr/bin`),
/// so a path-first check would mistake it for a system package and offer to
/// run the package manager over a read-only squashfs.
pub fn install_flavor(
    executable: Option<PathBuf>,
    appimage: Option<OsString>,
    snap: Option<OsString>,
) -> InstallFlavor {
    if appimage.is_some_and(|path| !path.is_empty()) {
        return InstallFlavor::AppImage;
    }
    if snap.is_some_and(|path| !path.is_empty()) {
        return InstallFlavor::Snap;
    }
    match executable {
        Some(path) if path.starts_with(Path::new(SYSTEM_PREFIX)) => InstallFlavor::Deb,
        _ => InstallFlavor::Other,
    }
}

/// What handing a downloaded package to the system installer resulted in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DebInstallOutcome {
    /// The package manager installed the update.
    Installed,
    /// The user declined the authorisation prompt; nothing changed.
    Cancelled,
    /// `pkexec` is not available, so the app cannot ask for authorisation at
    /// all. The downloaded package is kept for the user to install.
    InstallerMissing,
    /// The package manager ran and refused or failed.
    Failed,
}

/// Classifies the exit status of `pkexec apt-get install …`.
///
/// `pkexec` exits 126 when the authorisation dialog is dismissed and 127 when
/// the user is not authorised to run the command; from the app's point of view
/// both mean "the user did not allow it". `None` is an exit without a code,
/// which on Unix means a signal killed the installer.
pub fn deb_install_outcome(code: Option<i32>) -> DebInstallOutcome {
    match code {
        Some(0) => DebInstallOutcome::Installed,
        Some(126 | 127) => DebInstallOutcome::Cancelled,
        _ => DebInstallOutcome::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flavor(executable: &str, appimage: Option<&str>) -> InstallFlavor {
        install_flavor(Some(PathBuf::from(executable)), appimage.map(OsString::from), None)
    }

    fn snap_flavor(executable: &str, snap: Option<&str>) -> InstallFlavor {
        install_flavor(Some(PathBuf::from(executable)), None, snap.map(OsString::from))
    }

    #[test]
    fn appimage_wins_over_the_executable_path() {
        assert_eq!(
            flavor("/tmp/.mount_abc/usr/bin/markdown-viewer", Some("/home/u/Apps/mdv.AppImage")),
            InstallFlavor::AppImage
        );
        assert_eq!(flavor("/usr/bin/markdown-viewer", Some("/home/u/mdv.AppImage")), InstallFlavor::AppImage);
    }

    #[test]
    fn an_empty_appimage_variable_is_not_an_appimage() {
        assert_eq!(flavor("/usr/bin/markdown-viewer", Some("")), InstallFlavor::Deb);
        assert_eq!(flavor("/home/u/mdv/target/debug/markdown-viewer", Some("")), InstallFlavor::Other);
    }

    #[test]
    fn a_system_executable_is_a_package_install() {
        assert_eq!(flavor("/usr/bin/markdown-viewer", None), InstallFlavor::Deb);
        assert_eq!(flavor("/usr/local/bin/markdown-viewer", None), InstallFlavor::Deb);
    }

    #[test]
    fn anything_outside_the_system_prefix_is_neither() {
        assert_eq!(flavor("/home/u/mdv/target/release/markdown-viewer", None), InstallFlavor::Other);
        // Matching is by path component, so a sibling of `/usr` is not under it.
        assert_eq!(flavor("/usrlocal/bin/markdown-viewer", None), InstallFlavor::Other);
        assert_eq!(
            flavor("C:\\Program Files\\Markdown Viewer\\markdown-viewer.exe", None),
            InstallFlavor::Other
        );
        assert_eq!(install_flavor(None, None, None), InstallFlavor::Other);
    }

    #[test]
    fn a_snap_is_not_mistaken_for_a_package_install() {
        // A snap runs from a read-only mount that sits under `/usr`, so the
        // environment has to win over the path.
        assert_eq!(
            snap_flavor("/snap/markdown-viewer/42/usr/bin/markdown-viewer", Some("/snap/markdown-viewer/42")),
            InstallFlavor::Snap
        );
        assert_eq!(snap_flavor("/usr/bin/markdown-viewer", Some("")), InstallFlavor::Deb);
        assert_eq!(
            install_flavor(
                Some(PathBuf::from("/snap/markdown-viewer/42/usr/bin/markdown-viewer")),
                Some(OsString::from("/home/u/mdv.AppImage")),
                Some(OsString::from("/snap/markdown-viewer/42")),
            ),
            InstallFlavor::AppImage
        );
    }

    #[test]
    fn maps_the_installer_exit_status() {
        assert_eq!(deb_install_outcome(Some(0)), DebInstallOutcome::Installed);
        assert_eq!(deb_install_outcome(Some(126)), DebInstallOutcome::Cancelled);
        assert_eq!(deb_install_outcome(Some(127)), DebInstallOutcome::Cancelled);
        assert_eq!(deb_install_outcome(Some(1)), DebInstallOutcome::Failed);
        assert_eq!(deb_install_outcome(Some(100)), DebInstallOutcome::Failed);
        // Killed by a signal.
        assert_eq!(deb_install_outcome(None), DebInstallOutcome::Failed);
    }

    #[test]
    fn serializes_as_camel_case_for_the_frontend() {
        assert_eq!(serde_json::to_value(InstallFlavor::AppImage).unwrap(), "appImage");
        assert_eq!(serde_json::to_value(InstallFlavor::Deb).unwrap(), "deb");
        assert_eq!(serde_json::to_value(InstallFlavor::Other).unwrap(), "other");
        assert_eq!(serde_json::to_value(DebInstallOutcome::InstallerMissing).unwrap(), "installerMissing");
        assert_eq!(serde_json::to_value(DebInstallOutcome::Cancelled).unwrap(), "cancelled");
    }
}
