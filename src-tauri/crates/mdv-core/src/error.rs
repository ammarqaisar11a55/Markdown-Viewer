use std::io;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Filesystem errors surfaced to the frontend.
///
/// The frontend maps [`FsError::kind`] to a friendly, localized message; the
/// `message` field only carries technical detail for logs.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FsError {
    #[error("the file or folder does not exist")]
    NotFound,
    #[error("permission denied")]
    PermissionDenied,
    #[error("the path is not a file")]
    NotAFile,
    #[error("the path is not a folder")]
    NotADirectory,
    #[error("unsupported file type")]
    UnsupportedType,
    #[error("the file is too large ({size} bytes, limit {limit} bytes)")]
    TooLarge { size: u64, limit: u64 },
    #[error("i/o error: {0}")]
    Io(String),
}

impl FsError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::NotFound => "notFound",
            Self::PermissionDenied => "permissionDenied",
            Self::NotAFile => "notAFile",
            Self::NotADirectory => "notADirectory",
            Self::UnsupportedType => "unsupportedType",
            Self::TooLarge { .. } => "tooLarge",
            Self::Io(_) => "io",
        }
    }
}

impl From<io::Error> for FsError {
    fn from(err: io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => Self::NotFound,
            io::ErrorKind::PermissionDenied => Self::PermissionDenied,
            io::ErrorKind::IsADirectory => Self::NotAFile,
            io::ErrorKind::NotADirectory => Self::NotADirectory,
            _ => Self::Io(err.to_string()),
        }
    }
}

impl Serialize for FsError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("FsError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_io_error_kinds() {
        assert_eq!(FsError::from(io::Error::from(io::ErrorKind::NotFound)), FsError::NotFound);
        assert_eq!(
            FsError::from(io::Error::from(io::ErrorKind::PermissionDenied)),
            FsError::PermissionDenied
        );
        assert_eq!(FsError::from(io::Error::other("boom")).kind(), "io");
    }

    #[test]
    fn serializes_kind_and_message() {
        let json = serde_json::to_value(FsError::TooLarge { size: 10, limit: 5 }).unwrap();
        assert_eq!(json["kind"], "tooLarge");
        assert!(json["message"].as_str().unwrap().contains("10 bytes"));
    }
}
