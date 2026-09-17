// Small DOM helpers shared by the Markdown pipeline.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Escapes a string for use as a CSS identifier (`CSS.escape` when available). */
export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value
    .replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, (ch) => `\\${ch}`)
    .replace(/^(\d)/, '\\3$1 ');
}

/**
 * Finds an element by id inside `root` only. Document ids are author-controlled
 * and may collide with application element ids, so never use
 * `document.getElementById` for them.
 */
export function findElementById(root: ParentNode, id: string): HTMLElement | null {
  if (id === '') return null;
  return root.querySelector<HTMLElement>(`#${cssEscape(id)}`);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Scrolls only `container` (never its ancestors, unlike `scrollIntoView`) so
 * that `target`'s top sits at the container top, minus its `scroll-margin-top`.
 */
export function scrollToTarget(
  container: HTMLElement,
  target: Element,
  behavior: ScrollBehavior,
): void {
  const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const top =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    margin;
  container.scrollTo({ top: Math.max(0, top), behavior });
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  if (className !== undefined) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

type IconName = 'copy' | 'check' | 'image-off';

// Path data from Lucide (ISC license), drawn on a 24×24 grid.
const ICONS: Record<IconName, [string, Record<string, string>][]> = {
  copy: [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  'image-off': [
    ['line', { x1: '2', x2: '22', y1: '2', y2: '22' }],
    ['path', { d: 'M10.41 10.41a2 2 0 1 1-2.83-2.83' }],
    ['line', { x1: '13.5', x2: '6', y1: '13.5', y2: '21' }],
    ['line', { x1: '18', x2: '21', y1: '12', y2: '15' }],
    ['path', { d: 'M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59' }],
    ['path', { d: 'M21 15V5a2 2 0 0 0-2-2H9' }],
  ],
};

/** Builds a decorative inline SVG icon imperatively (no innerHTML). */
export function createIcon(doc: Document, name: IconName, className = 'md-icon'): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  for (const [tag, attrs] of ICONS[name]) {
    const child = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) child.setAttribute(key, value);
    svg.append(child);
  }
  return svg;
}
