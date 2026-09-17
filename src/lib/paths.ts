// Pure path helpers that understand both POSIX (`/home/a/b.md`) and Windows
// (`C:\Users\a\b.md`, `\\server\share\b.md`) paths. The frontend has no fs
// access, so everything here is string manipulation only.

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);
const DRIVE_RE = /^[a-zA-Z]:(?:[\\/]|$)/;
const UNC_RE = /^[\\/]{2}[^\\/]/;

let homeDir: string | null = null;

export interface PathWithHash {
  path: string;
  /** Decoded fragment without the leading `#`, or `null` when absent. */
  hash: string | null;
}

export function isWindowsPath(path: string): boolean {
  return DRIVE_RE.test(path) || (UNC_RE.test(path) && path.startsWith('\\\\'));
}

function separatorOf(path: string): '/' | '\\' {
  if (isWindowsPath(path)) return '\\';
  return path.includes('\\') && !path.includes('/') ? '\\' : '/';
}

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || DRIVE_RE.test(path) || UNC_RE.test(path);
}

/** Splits a path into its root (`/`, `C:\`, `\\server\share\`, or `''`) and the rest. */
function splitRoot(path: string, sep: string): { root: string; rest: string } {
  const drive = /^([a-zA-Z]:)(?:[\\/]+|$)/.exec(path);
  if (drive?.[1] !== undefined) {
    return { root: `${drive[1].toUpperCase()}${sep}`, rest: path.slice(drive[0].length) };
  }
  const unc = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)[\\/]*/.exec(path);
  if (unc?.[1] !== undefined && unc[2] !== undefined) {
    return { root: `${sep}${sep}${unc[1]}${sep}${unc[2]}${sep}`, rest: path.slice(unc[0].length) };
  }
  if (path.startsWith('/') || path.startsWith('\\')) {
    return { root: sep, rest: path.replace(/^[\\/]+/, '') };
  }
  return { root: '', rest: path };
}

/** Collapses duplicate separators and resolves `.` / `..` segments. */
export function normalizePath(path: string): string {
  if (path === '') return '';
  const sep = separatorOf(path);
  const { root, rest } = splitRoot(path, sep);
  const out: string[] = [];
  for (const segment of rest.split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (root === '') out.push('..');
      continue;
    }
    out.push(segment);
  }
  const joined = out.join(sep);
  if (root === '') return joined === '' ? '.' : joined;
  return root + joined;
}

export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

/** Parent directory of `path`. The root is its own parent; a bare name has parent `''`. */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const sep = separatorOf(normalized);
  const { root, rest } = splitRoot(normalized, sep);
  const index = rest.lastIndexOf(sep);
  if (index === -1) return root;
  return root + rest.slice(0, index);
}

export function joinPath(base: string, ...parts: string[]): string {
  const sep = separatorOf(base);
  const segments = [base, ...parts].filter((part) => part !== '');
  return normalizePath(segments.join(sep));
}

export function extname(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  return index <= 0 ? '' : name.slice(index + 1).toLowerCase();
}

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extname(path));
}

/** Comparison key: normalized, and case-insensitive for Windows paths. */
export function pathKey(path: string): string {
  const normalized = normalizePath(path);
  return isWindowsPath(normalized) ? normalized.toLowerCase() : normalized;
}

export function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}

/** Path of `to` relative to the directory `from` (both absolute). */
export function relativePath(from: string, to: string): string {
  const sep = separatorOf(to);
  const fromNorm = normalizePath(from);
  const toNorm = normalizePath(to);
  const fromRoot = splitRoot(fromNorm, sep);
  const toRoot = splitRoot(toNorm, sep);
  const insensitive = isWindowsPath(toNorm);
  const eq = (a: string, b: string) =>
    insensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
  if (!eq(fromRoot.root, toRoot.root)) return toNorm;

  const fromParts = fromRoot.rest.split(/[\\/]/).filter(Boolean);
  const toParts = toRoot.rest.split(/[\\/]/).filter(Boolean);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    eq(fromParts[common] ?? '', toParts[common] ?? '')
  ) {
    common += 1;
  }
  const up: string[] = Array.from({ length: fromParts.length - common }, () => '..');
  const result = [...up, ...toParts.slice(common)].join(sep);
  return result === '' ? '.' : result;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Strips `?query` and `#hash` from a link target. */
export function splitHash(ref: string): PathWithHash {
  const hashIndex = ref.indexOf('#');
  const hash = hashIndex === -1 ? null : safeDecode(ref.slice(hashIndex + 1));
  const withoutHash = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  return { path, hash: hash === '' ? null : hash };
}

function fileUrlToPath(url: string): string {
  const withoutScheme = url.replace(/^file:\/\//i, '');
  // file:///C:/x → /C:/x → C:/x ; file://server/share → //server/share
  if (/^\/[a-zA-Z]:/.test(withoutScheme)) return withoutScheme.slice(1);
  if (withoutScheme.startsWith('/')) return withoutScheme;
  return `//${withoutScheme}`;
}

/**
 * Resolves a link/image reference found in a document located in `baseDir`.
 * Handles relative paths, absolute paths, `file://` URLs and percent-encoding.
 */
export function resolveRelative(baseDir: string, ref: string): PathWithHash {
  const { path: rawPath, hash } = splitHash(ref.trim());
  const isFileUrl = /^file:\/\//i.test(rawPath);
  const decoded = safeDecode(isFileUrl ? fileUrlToPath(rawPath) : rawPath);
  if (decoded === '') return { path: normalizePath(baseDir), hash };
  if (isAbsolutePath(decoded)) return { path: normalizePath(decoded), hash };
  return { path: joinPath(baseDir, decoded), hash };
}

export function setHomeDir(dir: string | null): void {
  homeDir = dir === null || dir === '' ? null : normalizePath(dir);
}

/** Human-friendly path: collapses the home directory to `~` when known. */
export function displayPath(path: string): string {
  const normalized = normalizePath(path);
  if (homeDir === null) return normalized;
  const home = homeDir;
  if (samePath(normalized, home)) return '~';
  const sep = separatorOf(normalized);
  const prefix = home.endsWith(sep) ? home : home + sep;
  const matches = isWindowsPath(normalized)
    ? normalized.toLowerCase().startsWith(prefix.toLowerCase())
    : normalized.startsWith(prefix);
  return matches ? `~${sep}${normalized.slice(prefix.length)}` : normalized;
}
