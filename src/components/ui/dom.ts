/** Finds the first descendant whose `data-<key>` attribute equals `value` (no selector escaping needed). */
export function findByData(
  root: ParentNode | null | undefined,
  key: string,
  value: string,
): HTMLElement | null {
  if (!root) return null;
  const attr = `data-${key}`;
  for (const el of root.querySelectorAll<HTMLElement>(`[${attr}]`)) {
    if (el.getAttribute(attr) === value) return el;
  }
  return null;
}
