//! Command-line handling: turning launch arguments into paths to open.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// The directory the user launched the app from.
///
/// An AppImage runs its binary from the image's mount point and exports the
/// caller's directory as `OWD`; prefer it so relative arguments keep working.
pub fn launch_directory(
    current: Option<PathBuf>,
    appimage: Option<OsString>,
    owd: Option<OsString>,
) -> Option<PathBuf> {
    match (appimage, owd) {
        (Some(_), Some(owd)) if Path::new(&owd).is_absolute() => Some(PathBuf::from(owd)),
        _ => current,
    }
}

/// Extracts the files and folders to open from command-line arguments.
///
/// `args` must not include the program name. Flags (arguments starting with
/// `-`) are ignored until a `--` separator, after which every argument is
/// treated as a path. Relative paths are resolved against `cwd`; paths that do
/// not exist are dropped. The result is canonical and free of duplicates.
pub fn collect_paths<I, S>(args: I, cwd: &Path) -> Vec<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let mut only_paths = false;
    let mut result: Vec<PathBuf> = Vec::new();
    for arg in args {
        let arg: OsString = arg.into();
        if !only_paths {
            if arg == "--" {
                only_paths = true;
                continue;
            }
            if arg.to_string_lossy().starts_with('-') {
                continue;
            }
        }
        if arg.is_empty() {
            continue;
        }
        let candidate = PathBuf::from(arg);
        let absolute = if candidate.is_absolute() { candidate } else { cwd.join(candidate) };
        let Ok(canonical) = dunce::canonicalize(&absolute) else { continue };
        if (canonical.is_file() || canonical.is_dir()) && !result.contains(&canonical) {
            result.push(canonical);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn appimage_uses_original_working_directory() {
        let current = Some(PathBuf::from("/tmp/.mount_app/usr"));
        let owd = std::env::temp_dir();
        let image = || Some(OsString::from("app.AppImage"));
        assert_eq!(launch_directory(current.clone(), image(), Some(owd.clone().into())), Some(owd.clone()));
        assert_eq!(launch_directory(current.clone(), None, Some(owd.into())), current);
        assert_eq!(launch_directory(current.clone(), image(), Some("relative".into())), current);
        assert_eq!(launch_directory(None, image(), None), None);
    }

    #[test]
    fn keeps_existing_files_and_folders() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        fs::write(root.join("a.md"), "").unwrap();
        fs::create_dir(root.join("docs")).unwrap();
        let absolute = root.join("a.md");

        let paths = collect_paths(
            [
                OsString::from("--flag"),
                OsString::from("a.md"),
                OsString::from("./docs"),
                OsString::from("missing.md"),
                absolute.clone().into_os_string(),
                OsString::from(""),
            ],
            &root,
        );
        assert_eq!(paths, [absolute, root.join("docs")]);
    }

    #[test]
    fn double_dash_ends_flags() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        fs::write(root.join("-odd.md"), "").unwrap();
        assert!(collect_paths(["-odd.md"], &root).is_empty());
        assert_eq!(collect_paths(["--", "-odd.md"], &root), [root.join("-odd.md")]);
    }

    #[test]
    fn empty_arguments_yield_nothing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(collect_paths(Vec::<OsString>::new(), dir.path()).is_empty());
    }
}
