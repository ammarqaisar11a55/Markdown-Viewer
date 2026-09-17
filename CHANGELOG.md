# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-17

Initial release.

### Added

#### Reading

- GitHub Flavored Markdown rendering in Rust (comrak): headings with anchors,
  emphasis, strikethrough, tables with alignment, task lists, autolinks,
  footnotes, fenced code blocks and GitHub alerts (note, tip, important,
  warning, caution).
- Sanitized inline HTML (`details`, `summary`, `kbd`, `mark`, `sup`, `sub` and
  more), with a setting to show raw HTML as text instead.
- YAML front matter is hidden from the rendered document.
- Syntax highlighting for about 45 languages with Shiki in a Web Worker,
  loaded lazily per code block; optional line numbers; copy button and language
  label on code blocks.
- Local (relative and absolute) and remote HTTPS images, lazy loading,
  accessible placeholders for missing or blocked images, and an image lightbox.
- Light, dark and system themes; sans-serif and serif reading fonts; font size,
  code font size, content width and zoom controls.
- Reading mode that hides all chrome.
- Bundled fonts (Inter, JetBrains Mono, Source Serif 4); works fully offline.

#### Navigation

- Table of contents sidebar with active-section tracking and smooth scrolling.
- In-document search with match count, next/previous navigation and a
  case-sensitive option.
- Tabs with context menu, reopen closed tab, per-tab scroll position and
  session restore.
- Folder mode with a Markdown file tree and an option to show all files.
- Quick Open with fuzzy matching across tabs, recent files and the open folder.
- Recent files list with detection of missing files.
- Links to other Markdown files open in a new tab, including heading
  fragments.
- Context menus for documents, links, images and tabs.
- Keyboard shortcuts for all commands and a shortcuts reference dialog.

#### Desktop integration

- Native file and folder pickers, drag and drop, command-line arguments and
  "Open with" support.
- Single-instance behavior: files opened while the app is running open in the
  existing window.
- File watching with automatic reload (preserving scroll position) or a
  reload/ignore prompt; detection of deleted files; native notifications when
  the window is in the background.
- Native application menu, fullscreen and remembered window size and position.
- Settings dialog (appearance, behavior, Markdown) with persistence.
- Linux packages: `.deb` and AppImage with desktop entry, icon and Markdown
  MIME association.
- Windows packages: NSIS installer with Markdown file associations and a
  portable executable.
- GitHub Actions workflows for continuous integration and tagged releases.

#### Performance

- Rendering and sanitization off the UI thread in Rust (about 0.19 s for 1 MB
  and 1.5 s for 10 MB in release builds).
- Chunked insertion with `content-visibility` for large documents.
- Performance mode for documents over 5 MB (syntax highlighting disabled).
- 64 MB maximum document size.

#### Security

- Allow-list HTML sanitization (ammonia) that removes scripts, frames, forms,
  styles, SVG, event handlers, style attributes and non-renderer classes, and
  restricts URLs to `http`, `https`, `mailto` and image `data:` URLs.
- Strict Content Security Policy.
- Least-privilege Tauri capabilities with no filesystem or shell plugin in the
  frontend, and `freezePrototype`.
- Dedicated `mdasset` protocol that serves only image files up to 50 MB.
- External links open in the system browser, with an optional confirmation;
  local non-Markdown files are only revealed in their folder.
- Remote image loading can be disabled; insecure `http:` images are always
  blocked.

[Unreleased]: https://github.com/ammarqaisar11a55/Markdown-Viewer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.0.0
