import { enhanceCodeBlock } from './codeBlocks';
import { createElement } from './dom';
import { rewriteImage, type RenderContext } from './images';
import { classifyLink } from './links';

export type { RenderContext } from './images';

/** Parses sanitized HTML into an inert fragment (no scripts run, nothing loads). */
export function parseHtml(html: string, doc: Document = document): DocumentFragment {
  const template = doc.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function wrapTable(table: HTMLTableElement): void {
  const doc = table.ownerDocument;
  const wrapper = createElement(doc, 'div', 'md-table-wrap');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Table');
  table.replaceWith(wrapper);
  wrapper.append(table);
}

function annotateLink(anchor: HTMLAnchorElement, ctx: RenderContext): void {
  if (anchor.classList.contains('anchor')) return;
  const href = anchor.getAttribute('href');
  if (href === null) return;
  const target = classifyLink(href, ctx.docPath);
  anchor.dataset.linkType = target.type;
  if (target.type === 'external') {
    anchor.title ||= target.url;
  } else if (target.type === 'markdown' || target.type === 'local-file') {
    anchor.title ||= target.path;
  }
}

/**
 * Enhances rendered Markdown in place: rewrites images, annotates links, wraps
 * tables and code blocks. Works on any subtree (a whole fragment or a chunk).
 */
export function enhanceTree(root: ParentNode, ctx: RenderContext): void {
  for (const img of Array.from(root.querySelectorAll('img'))) rewriteImage(img, ctx);
  for (const anchor of root.querySelectorAll('a[href]'))
    annotateLink(anchor as HTMLAnchorElement, ctx);
  for (const table of Array.from(root.querySelectorAll('table'))) wrapTable(table);
  for (const pre of Array.from(root.querySelectorAll('pre'))) enhanceCodeBlock(pre);
}

/** Parses and enhances document HTML, ready to be inserted into the viewer. */
export function prepareFragment(
  html: string,
  ctx: RenderContext,
  doc: Document = document,
): DocumentFragment {
  const fragment = parseHtml(html, doc);
  enhanceTree(fragment, ctx);
  return fragment;
}
