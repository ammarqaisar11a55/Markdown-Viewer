const MARGIN = 4;

/** Clamps a menu of the given size so it stays inside the viewport. */
export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  let left = x;
  let top = y;
  if (left + width > viewportWidth - MARGIN) left = Math.max(MARGIN, x - width);
  if (top + height > viewportHeight - MARGIN) top = Math.max(MARGIN, y - height);
  left = Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN));
  top = Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN));
  return { left, top };
}
