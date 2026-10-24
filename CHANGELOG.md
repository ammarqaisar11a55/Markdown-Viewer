# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-10-25

### Added

- A snap package, published as `markdown-viewer-desktop`. The Snap Store
  refreshes it automatically, so that installation never has to download a
  release by hand; the app recognises it and leaves updating to the store
  rather than offering to install anything itself.

## [1.4.0] - 2026-10-24

### Changed

- New look, based on the Industry design system: a technical, blueprint-style
  interface on a light ground or a deep slate dark theme, with square corners,
  hairline borders, registration marks on framed objects and a single steel
  accent. Headings are set in Barlow Condensed over Barlow, code stays in
  JetBrains Mono, and both fonts are bundled so the app remains fully offline.
- The reading sheet, code blocks, tables, alerts and dialogs were all retuned
  to match; reading measure, font size, code size and zoom settings behave
  exactly as before.
- The sidebar is now an icon rail (Outline, Files, Recent, then theme and
  settings) beside a panel with its own header and per-view actions, and the
  tab bar carries a Quick Open field.
- Settings is a two-pane dialog: numbered sections on the left, their rows on
  the right. Every setting, label and description is unchanged.
- Nothing about how the app works changed: the same shortcuts, tabs, search,
  editing, updates and file handling.

### Added

- An available update now shows what changed. Release notes come from this
  file's entry for the new version, and the app renders them — safely, as
  text rather than HTML — in Settings and from the update notice.

### Fixed

- Ordered lists lost their numbers because of a CSS reset; they are numbered
  again.

## [1.3.1] - 2026-10-23

### Fixed

- The app could not be quit. Closing the window — with the close button,
  `Ctrl+Q` or the menu — ran the unsaved-changes check and then stopped,
  because the window never received permission to destroy itself. Quitting
  works again, and the check now fails open: if it ever errors, the window
  closes and the reason is logged rather than trapping you in the app.

## [1.3.0] - 2026-10-23

### Added

- In-app updates now work for Debian/Ubuntu installs. The app downloads the
  signed `.deb`, verifies it, and hands it to the system package manager
  through `pkexec`, so one password prompt replaces a manual download. A
  dismissed prompt is reported as a cancellation, and a system without
  `pkexec` keeps the downloaded package and offers to show it.

## [1.2.0] - 2026-10-23

### Added

- **New files** ([#3](https://github.com/ammarqaisar11a55/Markdown-Viewer/issues/3)).
  `Ctrl+N`, a button in the folder panel and "New File Here" on a folder's
  context menu create a Markdown file. The operating system's save dialog
  chooses the location — the app never turns a path typed into its own UI into
  a new file — and the file is created with create-new semantics, so an
  existing file or symlink is refused rather than overwritten. The new document
  opens in a tab, already in the editor.
- **In-app updates** ([#4](https://github.com/ammarqaisar11a55/Markdown-Viewer/issues/4)).
  The app checks for new releases in the background (at most once a day,
  silently unless something is available), offers **Check for Updates** in
  Settings, the Help menu and the About dialog, and downloads and installs an
  update in place with progress. Updates must be signed with the project's key
  or they are rejected; the restart that completes an update is refused while a
  document has unsaved changes. Automatic checks can be switched off.

### Changed

- Releases are now signed and publish a `latest.json` manifest for the
  updater.

## [1.1.0] - 2026-10-22

### Added

- **MDX support** ([#2](https://github.com/ammarqaisar11a55/Markdown-Viewer/issues/2)).
  `.mdx` files open through every path the app already supports (file picker,
  drag and drop, folder tree, Quick Open, "Open with") and render their
  Markdown. Because the viewer never executes code from a document, `import`
  and `export` statements, JSX components and JSX comments are removed before
  rendering — the Markdown inside a component is kept — and `{expressions}` are
  shown literally. Code blocks are never touched. The document shows a notice
  when it was simplified this way.
- **Editing** ([#1](https://github.com/ammarqaisar11a55/Markdown-Viewer/issues/1)).
  `Ctrl+E` opens the current document in a plain Markdown editor and `Ctrl+S`
  saves it back to the file; `Esc` returns to reading with the preview
  re-rendered from the draft. Unsaved changes are marked on the tab and in the
  editor status line, and are never discarded without asking — closing tabs,
  reloading, quitting and external changes to the file all prompt first. Saves
  are written to a temporary file and renamed into place, so an interrupted
  save cannot truncate a document.
- Screenshots in the README.

### Changed

- The app registers `.mdx` with the Linux desktop entry and the Windows
  installer alongside `.md`, `.markdown`, `.mdown` and `.mkd`.
- Auto-reload no longer reloads a document that has unsaved changes; it warns
  instead and keeps the draft.

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

[Unreleased]: https://github.com/ammarqaisar11a55/Markdown-Viewer/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.5.0
[1.4.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.4.0
[1.3.1]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.3.1
[1.3.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.3.0
[1.2.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.2.0
[1.1.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.1.0
[1.0.0]: https://github.com/ammarqaisar11a55/Markdown-Viewer/releases/tag/v1.0.0
