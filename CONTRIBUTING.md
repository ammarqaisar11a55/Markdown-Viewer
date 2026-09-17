# Contributing to Markdown Viewer

Thank you for your interest in improving Markdown Viewer. This guide explains
how to set up the project, the conventions the codebase follows, and what a
pull request needs before it can be merged.

## Project principles

1. **A reader, not an editor.** The goal is to make reading Markdown feel
   exceptionally good. Features that turn the app into an editor are out of
   scope.
2. **Fast, even for huge files.** Measure before and after changes that touch
   rendering, the viewer or scrolling. Use the generated large documents (see
   below). Avoid work on every scroll event and unnecessary React re-renders.
3. **Secure by default.** Documents are untrusted. Never relax the sanitizer,
   the CSP or the capability file without a clear justification and tests.
   Never insert unsanitized HTML, add inline scripts or styles, or give the
   frontend direct filesystem access.
4. **Calm and polished.** Consistent spacing, both themes designed with care,
   keyboard accessible, and friendly error messages instead of raw errors.
5. **Offline.** No network requests except remote images the user allows.
   Fonts and assets are bundled.
6. **Small and complete.** No dead code, commented-out code, TODO placeholders
   or unnecessary dependencies.

## Setup

Follow the prerequisites in the [README](README.md#development) (Node.js 20.19+,
Rust stable, and the platform's WebView development packages), then:

```bash
git clone https://github.com/<your-fork>/Markdown-Viewer.git
cd Markdown-Viewer
npm install
npm run tauri:dev
```

Generate large documents for performance testing (they are gitignored):

```bash
node scripts/generate-large-docs.mjs
```

Open `samples/` as a folder in the app to try the showcase, security and
cross-linked documents.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before making larger changes.

## Branches and commits

- Branch from `main` using a short descriptive name, for example
  `feat/print-support` or `fix/outline-scroll`.
- Use [Conventional Commits](https://www.conventionalcommits.org/):

  ```text
  <type>(<optional scope>): <summary in imperative mood>
  ```

  Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`,
  `ci`, `chore`. Examples:

  ```text
  feat(search): add whole-word toggle
  fix(viewer): keep scroll position after auto-reload
  perf(core): avoid copying HTML during sanitization
  test(core): cover data: URLs in image sources
  ```

- Keep commits focused. Separate refactors from behavior changes.
- Mark breaking changes with `!` (`feat!: ...`) and explain them in the body.

## Code style

### TypeScript and React

- TypeScript strict mode with `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`. Avoid `any`; use `unknown` and narrow it.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- Import from `src/` with the `@/` alias.
- ESLint (`typescript-eslint` strict type-checked, `jsx-a11y`,
  `react-hooks`) must pass with zero warnings.
- Prettier formats all files, including Tailwind class ordering.
- Only `src/lib/platform/` may import Tauri APIs. Components call feature
  actions or platform helpers, never `invoke` directly.
- State changes with side effects belong in `src/features/**` actions. Read
  store state with narrow selectors.
- Shared IPC types live in `src/types/index.ts` and must match the Rust structs
  (camelCase).
- Never set inline `style="..."` in HTML strings (blocked by the CSP); use
  `element.style.setProperty` or React's `style` prop.
- User-facing errors go through `toAppError()`; technical details go to
  `logger`.
- Accessibility: semantic elements, visible `:focus-visible` styles, keyboard
  support, labels on icon-only buttons, and respect for
  `prefers-reduced-motion`.

### Rust

- Format with `rustfmt` (configuration in `src-tauri/rustfmt.toml`).
- `cargo clippy --all-targets -- -D warnings` must be clean.
- No `unsafe` code. No `unwrap()` on values that can fail at runtime; return
  errors to the frontend as `FsErrorPayload`.
- Keep platform-independent logic in `src-tauri/crates/mdv-core` so it can be
  unit-tested without Tauri.
- New commands must be added to the capability file explicitly and accept the
  narrowest possible input.

Useful commands:

```bash
npm run lint
npm run typecheck
npm run format
cargo fmt --manifest-path src-tauri/Cargo.toml --all
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Testing

```bash
npm run test         # Vitest (jsdom)
npm run test:rust    # cargo test for the workspace
```

- Put frontend tests next to the code as `*.test.ts` or `*.test.tsx`. Use
  Testing Library and mock Tauri IPC with `mockIPC` from
  `@tauri-apps/api/mocks`.
- Every bug fix should include a test that fails without the fix.
- Changes to rendering or sanitization need Rust tests in `mdv-core`. Security
  changes must include malicious input cases (script tags, event handlers,
  `javascript:` and `data:` URLs, and similar).
- For viewer or performance changes, check the 1 MB, 10 MB and 25 MB generated
  documents manually and note the results in the pull request.
- Check `samples/showcase.md` and `samples/security-test.md` in both themes.

## Pull request checklist

Before requesting review, make sure that:

- [ ] The change is focused and described clearly (what and why).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`,
      `npm run test:rust` and `npm run build` pass.
- [ ] Rust code is formatted and clippy-clean.
- [ ] New behavior has tests; bug fixes have regression tests.
- [ ] The UI works with the keyboard and in both light and dark themes.
- [ ] No new permissions, commands, CSP relaxations or dependencies, or they
      are justified in the description.
- [ ] Performance with large documents is not worse.
- [ ] User-facing changes are added to the `Unreleased` section of
      [CHANGELOG.md](CHANGELOG.md), and documentation is updated.
- [ ] Screenshots or recordings are attached for visual changes.

## Reporting bugs and requesting features

Open a GitHub issue with the app version, operating system, steps to reproduce,
and a minimal Markdown file if relevant. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
