//! Helpers for the local image protocol.
//!
//! Markdown documents may reference local images. The desktop shell serves
//! them through a dedicated URI scheme that only ever returns image files, so a
//! malicious document cannot use the protocol to read arbitrary files.

use std::fs;
use std::path::{Path, PathBuf};

use crate::FsError;

/// Maximum size of a single local image served to the webview.
pub const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024;

/// Returns the MIME type for supported image file extensions.
pub fn image_mime_type(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" | "jfif" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        // Served as an image, SVG cannot run scripts: it is only ever used as <img src>.
        "svg" => "image/svg+xml",
        _ => return None,
    })
}

/// Decodes the path component of a local image URL (`mdasset://localhost/<percent-encoded path>`).
pub fn decode_asset_path(url_path: &str) -> Option<PathBuf> {
    let trimmed = url_path.strip_prefix('/').unwrap_or(url_path);
    let decoded = percent_decode(trimmed)?;
    if decoded.is_empty() || decoded.contains('\0') {
        return None;
    }
    let path = PathBuf::from(decoded);
    path.is_absolute().then_some(path)
}

/// Reads a local image, refusing anything that is not a supported image file.
pub fn read_image(path: &Path) -> Result<(Vec<u8>, &'static str), FsError> {
    let mime = image_mime_type(path).ok_or(FsError::UnsupportedType)?;
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(FsError::NotAFile);
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(FsError::TooLarge { size: metadata.len(), limit: MAX_IMAGE_BYTES });
    }
    Ok((fs::read(path)?, mime))
}

/// Outcome of a local image request, mapped to an HTTP status by the shell.
#[derive(Debug, PartialEq, Eq)]
pub enum AssetResponse {
    Ok {
        bytes: Vec<u8>,
        mime: &'static str,
    },
    /// 404: malformed URL, missing file or not a file.
    NotFound,
    /// 403: not an image, or not readable.
    Forbidden,
    /// 413: larger than [`MAX_IMAGE_BYTES`].
    TooLarge,
    /// 500: any other I/O failure.
    Failed,
}

impl AssetResponse {
    pub fn status(&self) -> u16 {
        match self {
            Self::Ok { .. } => 200,
            Self::NotFound => 404,
            Self::Forbidden => 403,
            Self::TooLarge => 413,
            Self::Failed => 500,
        }
    }
}

/// Resolves the path component of a local image URL and loads the image.
///
/// Symbolic links are resolved first and the *target* must be a supported
/// image, so a link named `pic.png` cannot expose an arbitrary file.
pub fn load_asset(url_path: &str) -> AssetResponse {
    let Some(path) = decode_asset_path(url_path) else { return AssetResponse::NotFound };
    let resolved = match dunce::canonicalize(&path) {
        Ok(resolved) => resolved,
        Err(err) => return error_response(&FsError::from(err)),
    };
    match read_image(&resolved) {
        Ok((bytes, mime)) => AssetResponse::Ok { bytes, mime },
        Err(err) => error_response(&err),
    }
}

fn error_response(err: &FsError) -> AssetResponse {
    match err {
        FsError::NotFound | FsError::NotAFile | FsError::NotADirectory => AssetResponse::NotFound,
        FsError::PermissionDenied | FsError::UnsupportedType => AssetResponse::Forbidden,
        FsError::TooLarge { .. } => AssetResponse::TooLarge,
        FsError::Io(_) => AssetResponse::Failed,
    }
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                let hex = bytes.get(i + 1..i + 3)?;
                let value = u8::from_str_radix(std::str::from_utf8(hex).ok()?, 16).ok()?;
                out.push(value);
                i += 3;
            }
            byte => {
                out.push(byte);
                i += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_image_extensions() {
        assert_eq!(image_mime_type(Path::new("a/b.PNG")), Some("image/png"));
        assert_eq!(image_mime_type(Path::new("x.svg")), Some("image/svg+xml"));
        assert_eq!(image_mime_type(Path::new("secret.txt")), None);
        assert_eq!(image_mime_type(Path::new("id_rsa")), None);
    }

    #[test]
    fn decodes_percent_encoded_paths() {
        #[cfg(unix)]
        assert_eq!(
            decode_asset_path("/%2Fhome%2Fme%2Fmy%20pic.png"),
            Some(PathBuf::from("/home/me/my pic.png"))
        );
        #[cfg(windows)]
        assert_eq!(decode_asset_path("/C%3A%5Cdocs%5Cpic.png"), Some(PathBuf::from("C:\\docs\\pic.png")));
        assert_eq!(decode_asset_path("/relative.png"), None);
        assert_eq!(decode_asset_path("/%zz"), None);
        assert_eq!(decode_asset_path("/%2Fa%00b.png"), None);
    }

    #[test]
    fn refuses_non_images() {
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("secret.txt");
        fs::write(&secret, "token").unwrap();
        assert_eq!(read_image(&secret), Err(FsError::UnsupportedType));

        let image = dir.path().join("pic.png");
        fs::write(&image, [0x89, b'P', b'N', b'G']).unwrap();
        let (bytes, mime) = read_image(&image).unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(bytes.len(), 4);

        assert_eq!(read_image(&dir.path().join("missing.png")), Err(FsError::NotFound));
    }

    fn encode(path: &Path) -> String {
        let mut out = String::from("/");
        for byte in path.to_string_lossy().bytes() {
            if byte.is_ascii_alphanumeric() || b"-_.~".contains(&byte) {
                out.push(char::from(byte));
            } else {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
        out
    }

    #[test]
    fn loads_assets_with_status_mapping() {
        let dir = tempfile::tempdir().unwrap();
        let image = dir.path().join("my pic.png");
        fs::write(&image, [1, 2, 3]).unwrap();
        let secret = dir.path().join("secret.txt");
        fs::write(&secret, "token").unwrap();
        fs::create_dir(dir.path().join("folder.png")).unwrap();

        let ok = load_asset(&encode(&image));
        assert_eq!(ok, AssetResponse::Ok { bytes: vec![1, 2, 3], mime: "image/png" });
        assert_eq!(ok.status(), 200);
        assert_eq!(load_asset(&encode(&secret)).status(), 403);
        assert_eq!(load_asset(&encode(&dir.path().join("gone.png"))).status(), 404);
        assert_eq!(load_asset(&encode(&dir.path().join("folder.png"))).status(), 404);
        assert_eq!(load_asset("/relative.png").status(), 404);
        assert_eq!(load_asset("/%zz").status(), 404);
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_must_point_to_images() {
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("id_rsa");
        fs::write(&secret, "key").unwrap();
        let link = dir.path().join("innocent.png");
        std::os::unix::fs::symlink(&secret, &link).unwrap();
        assert_eq!(load_asset(&encode(&link)), AssetResponse::Forbidden);
    }
}
