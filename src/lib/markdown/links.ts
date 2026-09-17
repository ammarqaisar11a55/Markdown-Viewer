import { dirname, isMarkdownPath, resolveRelative, splitHash } from '@/lib/paths';

export type LinkTarget =
  | { type: 'anchor'; id: string }
  | { type: 'markdown'; path: string; hash: string | null }
  | { type: 'local-file'; path: string }
  | { type: 'external'; url: string }
  | { type: 'blocked'; reason: string };

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;
const EXTERNAL_SCHEMES = new Set(['http', 'https', 'mailto']);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function classifyPath(ref: string, docPath: string): LinkTarget {
  const { path, hash } = resolveRelative(dirname(docPath), ref);
  if (splitHash(ref).path === '') {
    return hash === null ? { type: 'blocked', reason: 'empty' } : { type: 'anchor', id: hash };
  }
  if (isMarkdownPath(path)) return { type: 'markdown', path, hash };
  return { type: 'local-file', path };
}

/**
 * Decides what activating a link inside a document should do.
 *
 * - `#id` → in-document anchor (percent-decoded).
 * - Relative / absolute / `file://` paths → markdown document or other local file,
 *   resolved against the directory of `docPath`. Windows drive paths (`C:\x`) are
 *   paths, not URL schemes.
 * - `http:`, `https:`, `mailto:` → external (opened by the OS).
 * - Protocol-relative `//host/x` → treated as `https://host/x`: in Markdown these
 *   are web links far more often than UNC shares, and upgrading to HTTPS is the
 *   safe interpretation.
 * - Every other scheme (`javascript:`, `data:`, `vbscript:`, custom handlers…)
 *   and empty links → blocked.
 */
export function classifyLink(href: string, docPath: string): LinkTarget {
  const ref = href.trim();
  if (ref === '') return { type: 'blocked', reason: 'empty' };

  if (ref.startsWith('#')) {
    const id = safeDecode(ref.slice(1));
    return id === '' ? { type: 'blocked', reason: 'empty' } : { type: 'anchor', id };
  }

  if (ref.startsWith('//')) {
    try {
      return { type: 'external', url: new URL(`https:${ref}`).href };
    } catch {
      return { type: 'blocked', reason: 'invalid-url' };
    }
  }

  if (WINDOWS_DRIVE_RE.test(ref)) return classifyPath(ref, docPath);

  const scheme = SCHEME_RE.exec(ref)?.[1]?.toLowerCase();
  if (scheme === undefined) return classifyPath(ref, docPath);
  if (scheme === 'file') return classifyPath(ref, docPath);
  if (!EXTERNAL_SCHEMES.has(scheme)) return { type: 'blocked', reason: `scheme:${scheme}` };

  try {
    const url = new URL(ref);
    return { type: 'external', url: url.href };
  } catch {
    return { type: 'blocked', reason: 'invalid-url' };
  }
}

/** Text to put on the clipboard for "Copy Link". */
export function linkCopyText(target: LinkTarget, href: string): string {
  switch (target.type) {
    case 'external':
      return target.url;
    case 'markdown':
      return target.hash === null ? target.path : `${target.path}#${target.hash}`;
    case 'local-file':
      return target.path;
    case 'anchor':
      return `#${target.id}`;
    case 'blocked':
      return href;
  }
}
