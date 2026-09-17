//! `mdasset://` — serves local images referenced by documents.
//!
//! Only image files are served (see `mdv_core::media`). Error responses carry
//! no body so nothing about the filesystem leaks to the page.

use std::borrow::Cow;

use mdv_core::media::{load_asset, AssetResponse};
use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{Runtime, UriSchemeContext, UriSchemeResponder};

pub const ASSET_SCHEME: &str = "mdasset";

pub fn handle<R: Runtime>(
    _ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let method = request.method().clone();
    if method != Method::GET && method != Method::HEAD {
        responder.respond(empty(StatusCode::METHOD_NOT_ALLOWED));
        return;
    }
    let url_path = request.uri().path().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let asset = load_asset(&url_path);
        let response = match asset {
            AssetResponse::Ok { bytes, mime } => {
                let body = if method == Method::HEAD { Vec::new() } else { bytes };
                base(StatusCode::OK)
                    .header(header::CONTENT_TYPE, mime)
                    .body(Cow::Owned(body))
                    .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
            }
            other => {
                log::debug!("{ASSET_SCHEME} request refused with status {}", other.status());
                empty(StatusCode::from_u16(other.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR))
            }
        };
        responder.respond(response);
    });
}

fn base(status: StatusCode) -> tauri::http::response::Builder {
    Response::builder()
        .status(status)
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
}

fn empty(status: StatusCode) -> Response<Cow<'static, [u8]>> {
    base(status).body(Cow::Borrowed(&[][..])).unwrap_or_else(|_| {
        let mut response = Response::new(Cow::Borrowed(&[][..]));
        *response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
        response
    })
}
