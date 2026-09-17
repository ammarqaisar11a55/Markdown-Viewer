# Markdown Viewer

A fast, secure, offline desktop reader for Markdown files on Windows and Linux.

Markdown Viewer is a reader, not an editor. It opens `.md` files and makes them
comfortable to read: clean typography, syntax-highlighted code, a live table of
contents, tabs, folder browsing and automatic reloads when a file changes on disk.
It works fully offline and treats every document as untrusted input.

## Contents

- [Features](#features)
- [Supported platforms](#supported-platforms)
- [Installation](#installation)
- [Tech stack](#tech-stack)
- [Development](#development)
- [Testing](#testing)
- [Building and packaging](#building-and-packaging)
- [File associations](#file-associations)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Project structure](#project-structure)
- [Performance](#performance)
- [Security](#security)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Features

**Reading**

- GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks,
  footnotes, heading anchors and GitHub alerts (`[!NOTE]`, `[!TIP]`,
  `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
- Safe inline HTML such as `<details>`, `<summary>`, `<kbd>`, `<mark>`,
  `<sup>` and `<sub>` (sanitized; can be turned off).
- YAML front matter is hidden from the rendered output.
- Syntax highlighting for about 45 common languages, with optional line numbers
  and a copy button on every code block.
- Relative, absolute and remote (HTTPS) images, with an accessible placeholder
  for missing images and a click-to-zoom lightbox.
- Carefully designed light and dark themes, or follow the system theme.
- Sans-serif or serif reading font, adjustable font size, code font size,
  content width and zoom.
- Reading mode that hides everything except the document.

**Navigation**

- Table of contents in the sidebar, generated from the document headings, with
  the current section highlighted while you scroll.
- In-document search (`Ctrl+F`) with match count, next/previous and a
  case-sensitive toggle.
- Tabs with session restore, "reopen closed tab" and per-tab scroll position.
- Folder mode: open a folder and browse its Markdown files in a tree.
- Quick Open (`Ctrl+P`): fuzzy search across open tabs, recent files and the
  open folder.
- Recent files list with detection of files that were moved or deleted.
- Links to other Markdown files open in a new tab, including `#heading`
  fragments; external links open in the system browser.

**Desktop integration**

- Native file and folder pickers, drag and drop, and "Open with" from the file
  manager.
- Single instance: opening a file from the file manager while the app is running
  opens it in the existing window.
- File watching: documents reload automatically when they change on disk, or
  show a notice with **Reload** / **Ignore** if auto-reload is off.
- Native application menu, desktop notifications, remembered window size and
  position.
- Fully offline: fonts (Inter, JetBrains Mono, Source Serif 4) and highlighting
  grammars are bundled.

## Supported platforms

| Platform                         | Status    | Packages                                      |
| -------------------------------- | --------- | --------------------------------------------- |
| Windows 10 / 11 (x64)            | Supported | NSIS installer (`.exe`), portable `.exe`      |
| Linux (Ubuntu/Debian and others) | Supported | `.deb`, AppImage                              |
| macOS                            | Planned   | The code is portable; packaging is not set up |

The Windows build uses the Microsoft Edge WebView2 runtime, which ships with
Windows 10 and 11. The Linux build uses WebKitGTK 4.1.

## Installation

Download the package for your platform from the
[Releases](../../releases) page.

- **Windows (installer):** run `Markdown Viewer_<version>_x64-setup.exe`. The
  installer registers the app as a handler for Markdown files.
- **Windows (portable):** run `markdown-viewer.exe` from any folder. The
  portable build does not register file associations and requires the WebView2
  runtime.
- **Debian/Ubuntu:** `sudo apt install ./markdown-viewer_<version>_amd64.deb`
- **AppImage:** `chmod +x Markdown*.AppImage && ./Markdown*.AppImage`

Exact file names are listed on each release.

## Tech stack

| Layer         | Technology                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Desktop shell | [Tauri 2](https://v2.tauri.app/) (Rust)                                                                                           |
| Markdown      | [comrak](https://github.com/kivikakk/comrak) (GFM) + [ammonia](https://github.com/rust-ammonia/ammonia) (HTML sanitizer), in Rust |
| File watching | [notify](https://github.com/notify-rs/notify) with a debouncer                                                                    |
| UI            | React 19, TypeScript 6 (strict)                                                                                                   |
| Build tooling | Vite 8                                                                                                                            |
| Styling       | Tailwind CSS 4 plus hand-written reading typography                                                                               |
| State         | zustand 5                                                                                                                         |
| Highlighting  | Shiki 4 with the JavaScript regex engine, in a Web Worker                                                                         |
| Icons         | lucide-react                                                                                                                      |
| Tests         | Vitest, Testing Library, jsdom; `cargo test` for Rust                                                                             |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## Development

### Prerequisites

- **Node.js** 20.19 or newer, with npm
- **Rust** stable (1.80 or newer), installed with [rustup](https://rustup.rs/)

**Linux (Debian/Ubuntu):**

```bash
sudo apt update
sudo apt install pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev \
  build-essential file
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

For other distributions, see the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

**Windows:**

1. Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   with the "Desktop development with C++" workload.
2. WebView2 is preinstalled on Windows 10 and 11. On older systems, install the
   [Evergreen runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
3. Install Rust with [rustup](https://rustup.rs/) (MSVC toolchain).

### Getting started

```bash
git clone https://github.com/ammarqaisar11a55/Markdown-Viewer.git
cd Markdown-Viewer
npm install
npm run tauri:dev
```

`npm run tauri:dev` starts the Vite dev server on port 1420 and launches the
desktop app with hot reload for the frontend. Rust changes trigger a rebuild.

`npm run dev` starts only the web UI in a browser. This is useful for layout
work, but desktop features (opening files, folders, file watching, native menus)
need the Tauri runtime and are unavailable there.

### Scripts

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `npm run tauri:dev`    | Run the desktop app in development mode           |
| `npm run dev`          | Run the web UI only (no desktop features)         |
| `npm run lint`         | ESLint with zero warnings allowed                 |
| `npm run typecheck`    | TypeScript type checking                          |
| `npm run test`         | Frontend unit and component tests (Vitest)        |
| `npm run test:watch`   | Vitest in watch mode                              |
| `npm run test:rust`    | Rust tests (`cargo test` for the whole workspace) |
| `npm run format`       | Format with Prettier                              |
| `npm run format:check` | Check formatting                                  |
| `npm run build`        | Type-check and build the frontend into `dist/`    |
| `npm run tauri:build`  | Build release binaries and installers             |

### Sample documents

The [`samples/`](samples/) folder contains documents for manual testing:

- [`samples/showcase.md`](samples/showcase.md) exercises every supported
  Markdown feature.
- [`samples/security-test.md`](samples/security-test.md) contains XSS attempts
  that must all render inert.
- [`samples/docs/`](samples/docs/) is a small cross-linked set for trying folder
  mode and relative links. Open the `samples/` folder with `Ctrl+Shift+O`.

Large documents for performance testing are generated, not committed:

```bash
node scripts/generate-large-docs.mjs
```

This writes 100 KB, 500 KB, 1 MB, 5 MB, 10 MB and 25 MB files to
`samples/large/`.

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rust
```

Frontend tests live next to the code as `*.test.ts(x)` and run in jsdom with
Tauri IPC mocked. Rust tests cover Markdown rendering, sanitization (including
XSS payloads and dangerous URLs), filesystem access and the image protocol:

```bash
cargo test --manifest-path src-tauri/Cargo.toml -p mdv-core
```

To measure rendering speed on a generated document:

```bash
cargo run --release --manifest-path src-tauri/Cargo.toml -p mdv-core \
  --example render -- samples/large/large-10mb.md > /dev/null
```

## Building and packaging

```bash
npm run tauri:build
```

Artifacts are written to `src-tauri/target/release/`:

| Output                   | Path                                           | Built on |
| ------------------------ | ---------------------------------------------- | -------- |
| Debian package           | `src-tauri/target/release/bundle/deb/`         | Linux    |
| AppImage                 | `src-tauri/target/release/bundle/appimage/`    | Linux    |
| Windows installer (NSIS) | `src-tauri/target/release/bundle/nsis/`        | Windows  |
| Windows portable binary  | `src-tauri/target/release/markdown-viewer.exe` | Windows  |

Installers must be built on their target platform. The Windows installer cannot
be cross-built from Linux; it is produced by CI.

To build a single bundle type:

```bash
npm run tauri:build -- --bundles deb
npm run tauri:build -- --bundles appimage
npm run tauri:build -- --bundles nsis
```

### Continuous integration

GitHub Actions workflows live in [`.github/workflows/`](.github/workflows/):

- `ci.yml` runs lint, type checking, frontend tests, Rust tests and a build on
  every push and pull request.
- `release.yml` runs when a `v*` tag is pushed. It builds the Linux and Windows
  packages and attaches them to a GitHub release for that tag.

```bash
git tag v1.0.0
git push origin v1.0.0
```

## File associations

The installers register Markdown Viewer for `.md`, `.markdown`, `.mdown` and
`.mkd` files:

- **Windows (NSIS):** the app appears under **Open with** for Markdown files.
  To make it the default, use **Open with → Choose another app → Always**, or
  **Settings → Apps → Default apps**.
- **Linux (`.deb`):** a desktop entry declares the `text/markdown` MIME type.
  Choose it in your file manager's **Open With** dialog, or set it as default:

  ```bash
  xdg-mime default markdown-viewer.desktop text/markdown
  ```

  The desktop file name may differ; check `/usr/share/applications/`.

- **AppImage and portable builds** do not register associations by themselves.

You can also pass files or folders on the command line:

```bash
markdown-viewer README.md docs/
```

If the app is already running, the paths open in the existing window.

## Keyboard shortcuts

`Ctrl` is used on Windows and Linux.

| Action                  | Shortcut                                   |
| ----------------------- | ------------------------------------------ |
| Open file               | `Ctrl+O`                                   |
| Open folder             | `Ctrl+Shift+O`                             |
| Quick Open              | `Ctrl+P`                                   |
| Reload document         | `Ctrl+R`, `F5`                             |
| Close tab               | `Ctrl+W`                                   |
| Close all tabs          | `Ctrl+Shift+W`                             |
| Reopen closed tab       | `Ctrl+Shift+T`                             |
| Next tab                | `Ctrl+Tab`, `Ctrl+PageDown`                |
| Previous tab            | `Ctrl+Shift+Tab`, `Ctrl+PageUp`            |
| Toggle sidebar          | `Ctrl+B`                                   |
| Reading mode            | `Ctrl+Shift+R` (`Esc` to exit)             |
| Toggle light/dark theme | `Ctrl+Shift+D`                             |
| Zoom in                 | `Ctrl+=`, `Ctrl++`                         |
| Zoom out                | `Ctrl+-`                                   |
| Reset zoom              | `Ctrl+0`                                   |
| Find in document        | `Ctrl+F`                                   |
| Next / previous match   | `Enter` / `Shift+Enter`, `F3` / `Shift+F3` |
| Full screen             | `F11`                                      |
| Settings                | `Ctrl+,`                                   |
| Keyboard shortcuts      | `Ctrl+/`                                   |
| Quit                    | `Ctrl+Q`                                   |

The full list is also available in the app in the Keyboard Shortcuts dialog
(`Ctrl+/`).

## Settings

Open settings with `Ctrl+,`. Changes apply immediately and are saved
automatically.

**Appearance**

| Setting        | Values                                     |
| -------------- | ------------------------------------------ |
| Theme          | System, Light, Dark                        |
| Font size      | 14–24 px                                   |
| Content width  | Narrow, Medium, Wide, Full                 |
| Code font size | 11–20 px                                   |
| Reading font   | Sans-serif (Inter), Serif (Source Serif 4) |

**Behavior**

| Setting                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| Restore previous session  | Reopen the tabs and folder from the last run                         |
| Open files in new tab     | Otherwise the active tab is replaced                                 |
| Auto-reload changed files | Reload silently when a file changes on disk, keeping scroll position |
| Remember recent files     | Turning this off clears the list                                     |
| Show all files in folders | Show non-Markdown files in the folder tree (they are not opened)     |

**Markdown**

| Setting             | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| Syntax highlighting | Colorize code blocks                                          |
| Line numbers        | Show line numbers in code blocks                              |
| Render HTML         | Render sanitized inline HTML; when off, HTML is shown as text |
| External links      | Open directly, or ask for confirmation first                  |
| Load remote images  | When off, `https:` images are replaced with a placeholder     |

## Project structure

```text
.
├── src/                       React frontend
│   ├── app/                   App root, command registry, startup (bootstrap)
│   ├── components/
│   │   ├── layout/            Window layout, status bar, empty state
│   │   ├── sidebar/           Outline, file tree, recent files
│   │   ├── tabs/              Tab bar
│   │   ├── markdown/          Document viewer, code blocks, image lightbox
│   │   ├── search/            In-document search bar
│   │   ├── quick-open/        Quick Open palette
│   │   ├── settings/          Settings dialog
│   │   ├── dialogs/           Shortcuts and About dialogs
│   │   └── ui/                Buttons, tooltips, menus, toasts and other primitives
│   ├── features/              Actions: documents, folder, recent files, session
│   ├── hooks/                 Global shortcuts, theme, active heading tracking
│   ├── lib/
│   │   ├── platform/          The only code that talks to Tauri (IPC, dialogs, storage, logging)
│   │   ├── markdown/          HTML insertion pipeline (images, links, chunking)
│   │   ├── highlight/         Shiki Web Worker and lazy highlighter
│   │   └── search/            Text search engine
│   ├── stores/                zustand stores
│   ├── styles/                Tailwind entry, design tokens, reading typography
│   └── types/                 Shared types (mirror Rust IPC structs)
├── src-tauri/                 Tauri application (Rust)
│   ├── src/                   Commands, menu, file watcher, image protocol
│   ├── crates/mdv-core/       Platform-independent core: rendering, sanitizing, filesystem
│   ├── capabilities/          Tauri permission set for the main window
│   └── tauri.conf.json        App, window, CSP and bundle configuration
├── samples/                   Demo and test documents
├── scripts/                   Developer scripts (large document generator)
└── .github/workflows/         CI and release pipelines
```

## Performance

Markdown is parsed and sanitized in Rust, off the UI thread, in a single pass.
An early prototype rendering Markdown in JavaScript (remark/unified) took about
11 seconds for a 1 MB file and ran out of memory at 5 MB. The Rust renderer
(release build, same machine) takes roughly:

| Document size | Render + sanitize |
| ------------- | ----------------- |
| 1 MB          | ~0.19 s           |
| 10 MB         | ~1.5 s            |
| 25 MB         | ~3.7 s            |

In the frontend:

- The HTML is parsed into an inert `<template>` and inserted once. Documents
  larger than about 300 KB are inserted in chunks across animation frames, and
  each chunk uses `content-visibility: auto` so off-screen content is not laid
  out or painted.
- Code blocks are highlighted lazily in a Web Worker, only when they approach
  the viewport. Grammars are loaded on demand. Very large blocks (over 200 KB
  or 5,000 lines) are left plain.
- Documents larger than 5 MB open in **performance mode**, which disables
  syntax highlighting.
- The active heading is tracked with `IntersectionObserver`, not by
  recalculating positions on every scroll event.
- Theme changes switch CSS variables and never re-highlight code.

The maximum document size is 64 MB.

## Security

Every Markdown document is treated as untrusted. In short:

- Rendered HTML passes through a strict allow-list sanitizer. Scripts, iframes,
  forms, `<style>`, `<svg>`, event handlers and `style` attributes are removed.
  Only `http`, `https` and `mailto` links survive, plus `data:` URLs for images.
- A strict Content Security Policy blocks inline scripts and styles and any
  script not shipped with the app.
- The frontend has no direct filesystem access; it can only call a small set of
  purpose-built Rust commands.
- Local images are served through a dedicated protocol that returns image files
  only.
- External links open in the system browser. Links to non-Markdown local files
  only reveal the file in its folder; they are never executed.

See [SECURITY.md](SECURITY.md) for the full threat model and how to report a
vulnerability.

## Known limitations

- Math (LaTeX) and Mermaid diagrams are not rendered; they are shown as code.
- Search does not find text that spans element boundaries (for example, a
  phrase that is partly bold).
- Documents over 5 MB open without syntax highlighting.
- Relative links and footnotes rely on the paths the author wrote; links to
  files outside the document's folder work only if the files exist there.
- Remote images are loaded from the internet unless **Load remote images** is
  turned off. Plain `http:` images are always blocked.
- The Windows installer is built on Windows (in CI); it cannot be cross-built
  from Linux.
- macOS is not packaged yet.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the
development workflow, code style and pull request checklist. Changes are
recorded in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Muhammad Ammar Qaisar
