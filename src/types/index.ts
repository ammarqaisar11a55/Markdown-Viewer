// Shared domain types. IPC types mirror the Rust structs in `src-tauri`
// (serialized with `camelCase`), so keep both sides in sync.

// ---------------------------------------------------------------------------
// IPC: documents & filesystem
// ---------------------------------------------------------------------------

export interface Heading {
  level: number;
  text: string;
  /** Element id of the heading in the rendered HTML. */
  id: string;
}

export interface RenderOptions {
  allowHtml: boolean;
}

/** How a document's source is interpreted. */
export type DocumentFlavor = 'markdown' | 'mdx';

/** Result of the `open_document` and `save_document` commands. */
export interface OpenedDocument {
  /** Canonical absolute path. */
  path: string;
  name: string;
  size: number;
  modifiedMs: number | null;
  /** Sanitized HTML. */
  html: string;
  headings: Heading[];
  wordCount: number;
  /** The file was not valid UTF-8; invalid bytes were replaced. */
  lossy: boolean;
  flavor: DocumentFlavor;
  /** MDX only: imports/exports or JSX were removed before rendering. */
  simplified: boolean;
}

/** Result of the `render_source` command (unsaved text). */
export interface RenderedSource {
  html: string;
  headings: Heading[];
  wordCount: number;
  flavor: DocumentFlavor;
  simplified: boolean;
}

/** Result of the `read_source` command. */
export interface DocumentSource {
  path: string;
  name: string;
  size: number;
  modifiedMs: number | null;
  /** Raw file text, as written on disk. */
  content: string;
  lossy: boolean;
}

export type EntryKind = 'file' | 'directory';

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: EntryKind;
  isMarkdown: boolean;
  children?: DirectoryEntry[];
}

export interface DirectoryTree {
  root: DirectoryEntry;
  markdownFileCount: number;
  truncated: boolean;
}

export type FsErrorKind =
  | 'notFound'
  | 'alreadyExists'
  | 'permissionDenied'
  | 'notAFile'
  | 'notADirectory'
  | 'unsupportedType'
  | 'tooLarge'
  | 'io';

/** Shape of errors rejected by filesystem commands. */
export interface FsErrorPayload {
  kind: FsErrorKind;
  message: string;
}

/** Payload of the `file-changed` event. */
export interface FileChangedPayload {
  path: string;
  kind: 'modified' | 'removed';
  modifiedMs: number | null;
}

// ---------------------------------------------------------------------------
// Application errors (user-facing)
// ---------------------------------------------------------------------------

export type AppErrorKind = FsErrorKind | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  /** Short, friendly title, e.g. "Unable to open this file." */
  title: string;
  /** Friendly explanation / recovery hint. */
  description: string;
  /** Technical detail — logged, never shown prominently. */
  technical: string;
}

// ---------------------------------------------------------------------------
// Settings & UI
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type ContentWidth = 'narrow' | 'medium' | 'wide' | 'full';
export type ReadingFont = 'sans' | 'serif';
export type ExternalLinkBehavior = 'open' | 'ask';

export interface Settings {
  // Appearance
  theme: ThemePreference;
  /** Reading font size in px (14–24). */
  fontSize: number;
  contentWidth: ContentWidth;
  /** Code font size in px (11–20). */
  codeFontSize: number;
  readingFont: ReadingFont;
  // Behavior
  restoreSession: boolean;
  openInNewTab: boolean;
  autoReload: boolean;
  rememberRecent: boolean;
  showAllFiles: boolean;
  // Updates
  autoCheckUpdates: boolean;
  // Markdown
  syntaxHighlighting: boolean;
  lineNumbers: boolean;
  renderHtml: boolean;
  externalLinks: ExternalLinkBehavior;
  loadRemoteImages: boolean;
}

export type SidebarView = 'outline' | 'files' | 'recent';

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
  /** Set after an existence check found the file missing. */
  missing?: boolean;
}

export interface SessionSnapshot {
  tabs: { path: string; scrollTop: number }[];
  activePath: string | null;
  folderPath: string | null;
}

export type TabStatus = 'loading' | 'ready' | 'error';

export interface DocumentTab {
  id: string;
  path: string;
  name: string;
  status: TabStatus;
  doc: OpenedDocument | null;
  error: AppError | null;
  scrollTop: number;
  /** Set when the file changed on disk and the user has not reacted yet. */
  externalChange: 'modified' | 'removed' | null;
  /** Increments on every successful (re)load; use as a render key. */
  revision: number;

  // --- Editing -------------------------------------------------------------
  /** The editor is open for this tab. */
  editing: boolean;
  /** Editor text while editing; `null` when the source has not been loaded. */
  draft: string | null;
  /** The text on disk when the draft was loaded or last saved. */
  savedText: string | null;
  /** `draft` differs from `savedText`. */
  dirty: boolean;
  /** A save is in flight. */
  saving: boolean;
}
