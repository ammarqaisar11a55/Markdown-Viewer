# Security Policy

Markdown Viewer opens files that users download, clone or receive from other
people. Every document is treated as untrusted input. This document describes
what the app protects against, how, and how to report a vulnerability.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

Security fixes are released as patch versions of the latest minor release.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting: open the repository on GitHub, go
to **Security → Report a vulnerability**, and describe:

- the affected version and platform (Windows or Linux distribution);
- a minimal Markdown file or steps that reproduce the issue;
- what an attacker can achieve (for example, script execution, file read, or
  opening an unexpected program).

You should receive an acknowledgement within a few days. Once a fix is
available, a patched release is published and the advisory is disclosed with
credit to the reporter, unless you prefer to stay anonymous.

## Threat model

**Assets**

- The user's files, other than the documents and images they choose to view.
- The user's system: the ability to run programs or commands.
- The user's privacy: which documents they read, and their network identity.
- The integrity of the app's UI (a document must not impersonate app dialogs).

**Attacker**

Anyone who can get a user to open a Markdown file, or a folder containing
Markdown files: a malicious repository, a downloaded archive, an email
attachment, or a document linked from another document.

**In scope**

- Script execution from Markdown or embedded HTML (`<script>`, event handlers,
  `javascript:` URLs, SVG, iframes, `data:` documents).
- Access to Tauri IPC or native APIs from document content.
- Reading local files through links, images or the local image protocol.
- Launching programs through links to local executables or custom URL schemes.
- Navigating the app's WebView to attacker-controlled content.
- UI spoofing through CSS or app class names.
- Resource exhaustion from very large documents or folders.

**Out of scope**

- An attacker who already controls the user's account or can modify the app's
  installation.
- Content of remote images. Remote HTTPS images are loaded by default, which
  reveals the user's IP address to the image host; this can be disabled in
  settings (**Load remote images**).
- Vulnerabilities in the operating system's WebView (WebView2, WebKitGTK),
  which are fixed by OS updates.

## Mitigations

### HTML sanitization

Markdown is rendered in Rust with comrak and the output is cleaned by
[ammonia](https://github.com/rust-ammonia/ammonia) with an allow-list:

- **Tags:** only formatting and structural tags are kept (headings,
  paragraphs, lists, tables, code, blockquotes, links, images, `details`,
  `summary`, `kbd`, `mark`, `sup`, `sub`, `dl`, `figure`, `picture` and
  similar). `script`, `style`, `iframe`, `frame`, `object`, `embed`, `form`,
  `input` (other than always-disabled checkboxes), `button`, `svg`, `math`,
  `link`, `meta`, `base` and all unknown tags are removed.
- **Attributes:** event handlers (`onload`, `onerror`, ...) and `style`
  attributes are removed. Only a small set of attributes per tag is kept.
- **Classes:** only the renderer's own classes survive (`anchor`, task list,
  footnote and alert classes, and `language-*` on `code`). A document cannot
  apply app classes to draw fake overlays or dialogs.
- **URLs:** `href` and `src` accept only `http`, `https`, `mailto` and
  relative URLs. `javascript:`, `vbscript:`, `file:` and custom schemes are
  dropped. `data:` URLs are accepted only in image sources and only for PNG,
  JPEG, GIF, WebP and AVIF (not SVG).
- **Links** receive `rel="noopener noreferrer"`. HTML comments are removed.
- With **Render HTML** turned off, all raw HTML is escaped and shown as text.

The sanitizer is covered by Rust unit tests with XSS payloads and dangerous
URLs (`cargo test -p mdv-core`).

### Content Security Policy

The WebView enforces:

```text
default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data: blob: https: mdasset: http://mdasset.localhost;
font-src 'self' data:; connect-src ipc: http://ipc.localhost;
worker-src 'self' blob:; object-src 'none'; base-uri 'none';
form-action 'none'; frame-src 'none'
```

Only scripts shipped with the app can run; inline scripts, inline styles,
frames, plugins and form submissions are blocked, and the page cannot make
network requests except to load images.

### Rendering in the frontend

- HTML is prepared inside an inert `<template>` element and inserted with DOM
  APIs. Content is never evaluated.
- Links never navigate the WebView. A single click handler decides what to do:
  in-document anchors scroll; links to Markdown files open in a new tab; links
  to other local files only **reveal the file in its folder** and are never
  opened or executed; `http`, `https` and `mailto` links open in the system
  browser or mail client, optionally after a confirmation dialog
  (**External links → Ask**); everything else is ignored.
- `http:` (non-TLS) images are always blocked.

### Least-privilege native access

- The frontend has **no filesystem plugin and no shell plugin**. It can only
  call a small set of app commands: open a Markdown document, list a folder,
  check whether files exist, watch/unwatch a file, read startup paths and hide
  the menu.
- `open_document` canonicalizes the path, accepts only `.md`, `.markdown`,
  `.mdown` and `.mkd` files, and refuses files over 64 MB.
- `scan_folder` returns names and paths only, skips hidden entries, does not
  follow directory symlinks, and is bounded in depth and entry count.
- The Tauri capability file grants the main window only the permissions the UI
  uses. The opener plugin is scoped to `http:`, `https:` and `mailto:` URLs.
- `freezePrototype` is enabled so that prototype pollution cannot tamper with
  the IPC bridge.
- The app runs as a single instance; files passed by a second launch are
  routed through the same validation as any other open.

### Local images

Local images are served through a dedicated `mdasset` protocol rather than a
general file protocol. It serves a file only if it is an absolute path to a
regular file with an image extension (`png`, `jpg`, `jpeg`, `jfif`, `gif`,
`webp`, `avif`, `bmp`, `ico`, `svg`) and at most 50 MB. SVG files are loaded
only through `<img>`, where scripts do not run.

### Resource limits

- Documents over 64 MB are refused; documents over 5 MB open in performance
  mode without syntax highlighting.
- Very large code blocks are not highlighted.
- Folder scans stop after 20,000 entries or 16 levels of depth.

## Testing the protections

[`samples/security-test.md`](samples/security-test.md) contains a collection
of XSS and spoofing attempts. Opening it must not show any alert, run any code,
open any window or program, or display anything that looks like part of the
app's own UI.
