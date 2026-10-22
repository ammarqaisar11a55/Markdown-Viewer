// Tab / Shift+Tab indentation for the plain-textarea editor. Pure so the
// component only has to apply the edit and move the caret.

export const INDENT = '  ';

export interface IndentEdit {
  /** Replace `[from, to)` of the text with `text`. */
  from: number;
  to: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const LEADING_INDENT = /^(?: {1,2}|\t)/;

/**
 * Computes the edit for indenting (or outdenting) the selection. Returns
 * `null` when there is nothing to change, e.g. outdenting a line that has no
 * leading whitespace.
 */
export function indentEdit(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): IndentEdit | null {
  const spansLines = value.slice(start, end).includes('\n');
  if (!outdent && !spansLines) {
    const caret = start + INDENT.length;
    return { from: start, to: end, text: INDENT, selectionStart: caret, selectionEnd: caret };
  }

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextNewline = value.indexOf('\n', end);
  const blockEnd = nextNewline === -1 ? value.length : nextNewline;

  let firstDelta = 0;
  let totalDelta = 0;
  const lines = value.slice(lineStart, blockEnd).split('\n');
  const indented = lines.map((line, index) => {
    let next = line;
    let delta = 0;
    if (outdent) {
      const match = LEADING_INDENT.exec(line);
      if (match !== null) {
        next = line.slice(match[0].length);
        delta = -match[0].length;
      }
    } else if (line !== '' || lines.length === 1) {
      // Never leave trailing whitespace on blank lines.
      next = INDENT + line;
      delta = INDENT.length;
    }
    if (index === 0) firstDelta = delta;
    totalDelta += delta;
    return next;
  });
  if (totalDelta === 0) return null;

  return {
    from: lineStart,
    to: blockEnd,
    text: indented.join('\n'),
    selectionStart: Math.max(lineStart, start + firstDelta),
    selectionEnd: Math.max(lineStart, end + totalDelta),
  };
}
