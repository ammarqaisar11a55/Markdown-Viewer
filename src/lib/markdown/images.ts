import { dirname, resolveRelative } from '@/lib/paths';
import { toAssetUrl } from '@/lib/platform/system';
import { createElement, createIcon } from './dom';

export interface RenderContext {
  /** Absolute path of the document being rendered. */
  docPath: string;
  loadRemoteImages: boolean;
}

export type ImageSource =
  | { kind: 'local'; url: string; path: string }
  | { kind: 'remote'; url: string }
  | { kind: 'data'; url: string }
  | { kind: 'blocked'; message: string };

export const IMAGE_NOT_FOUND = 'Image not found';
export const REMOTE_IMAGE_BLOCKED = 'Remote image blocked';
export const INSECURE_IMAGE_BLOCKED = 'Insecure image blocked';
export const UNSUPPORTED_IMAGE = 'Unsupported image source';

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;

/** Resolves the author's image `src` to something the webview may load. */
export function resolveImageSource(src: string, ctx: RenderContext): ImageSource {
  const ref = src.trim();
  if (ref === '') return { kind: 'blocked', message: IMAGE_NOT_FOUND };

  const remote = ref.startsWith('//') ? `https:${ref}` : ref;
  const scheme = WINDOWS_DRIVE_RE.test(remote)
    ? undefined
    : SCHEME_RE.exec(remote)?.[1]?.toLowerCase();

  if (scheme === 'data') {
    return /^data:image\/(png|jpeg|gif|webp|avif)[;,]/i.test(remote)
      ? { kind: 'data', url: remote }
      : { kind: 'blocked', message: UNSUPPORTED_IMAGE };
  }
  if (scheme === 'https') {
    return ctx.loadRemoteImages
      ? { kind: 'remote', url: remote }
      : { kind: 'blocked', message: REMOTE_IMAGE_BLOCKED };
  }
  if (scheme === 'http') return { kind: 'blocked', message: INSECURE_IMAGE_BLOCKED };
  if (scheme !== undefined && scheme !== 'file')
    return { kind: 'blocked', message: UNSUPPORTED_IMAGE };

  const { path } = resolveRelative(dirname(ctx.docPath), ref);
  return { kind: 'local', url: toAssetUrl(path), path };
}

/** Accessible stand-in for an image that cannot be shown. */
export function createImagePlaceholder(
  doc: Document,
  alt: string,
  message: string,
): HTMLSpanElement {
  const box = createElement(doc, 'span', 'md-image-placeholder');
  box.setAttribute('role', 'img');
  const label = alt.trim();
  box.setAttribute('aria-label', label === '' ? message : `${label} — ${message}`);
  box.append(createIcon(doc, 'image-off', 'md-icon md-image-placeholder-icon'));
  const text = createElement(doc, 'span', 'md-image-placeholder-text');
  if (label !== '') text.append(createElement(doc, 'span', 'md-image-placeholder-alt', label));
  text.append(createElement(doc, 'span', 'md-image-placeholder-message', message));
  box.append(text);
  return box;
}

function replaceWithPlaceholder(img: HTMLImageElement, message: string): void {
  const doc = img.ownerDocument;
  const placeholder = createImagePlaceholder(doc, img.getAttribute('alt') ?? '', message);
  const picture = img.parentElement?.tagName === 'PICTURE' ? img.parentElement : null;
  (picture ?? img).replaceWith(placeholder);
}

function rewriteSrcset(source: HTMLSourceElement, ctx: RenderContext): void {
  const srcset = source.getAttribute('srcset') ?? '';
  const candidates: string[] = [];
  for (const candidate of srcset.split(',')) {
    const [url = '', ...descriptor] = candidate.trim().split(/\s+/);
    const resolved = resolveImageSource(url, ctx);
    if (resolved.kind === 'blocked') {
      source.remove();
      return;
    }
    candidates.push([resolved.url, ...descriptor].join(' '));
  }
  source.setAttribute('srcset', candidates.join(', '));
}

/** Rewrites an image in place (or replaces it with a placeholder). */
export function rewriteImage(img: HTMLImageElement, ctx: RenderContext): void {
  const original = img.getAttribute('src') ?? '';
  const resolved = resolveImageSource(original, ctx);
  if (resolved.kind === 'blocked') {
    replaceWithPlaceholder(img, resolved.message);
    return;
  }

  if (img.parentElement?.tagName === 'PICTURE') {
    for (const source of img.parentElement.querySelectorAll('source')) rewriteSrcset(source, ctx);
  }

  img.dataset.originalSrc = original;
  img.dataset.srcKind = resolved.kind;
  if (resolved.kind === 'local') img.dataset.localPath = resolved.path;
  img.setAttribute('src', resolved.url);
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');
  img.classList.add('md-image');
  img.addEventListener('error', () => replaceWithPlaceholder(img, IMAGE_NOT_FOUND), { once: true });

  // Linked images (badges, thumbnails) follow their link instead of zooming.
  if (img.closest('a') === null) {
    img.dataset.zoomable = 'true';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    const alt = img.getAttribute('alt')?.trim() ?? '';
    img.setAttribute(
      'aria-label',
      alt === '' ? 'Open image preview' : `Open image preview: ${alt}`,
    );
  }
}
