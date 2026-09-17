// Converts Shiki's dual-theme tokens into the compact wire format.

import type { ThemedToken, TokensResult } from '@shikijs/core';
import type { HighlightResult, WireToken } from './protocol';

/** Parses a `--a:#fff;--b:#000` declaration list into a map. */
export function parseDeclarations(value: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === undefined) return out;
  for (const part of value.split(';')) {
    const index = part.indexOf(':');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const val = part.slice(index + 1).trim();
    if (key.startsWith('--') && val !== '') out[key] = val;
  }
  return out;
}

function styleKey(style: Record<string, string>): string {
  return Object.keys(style)
    .sort()
    .map((key) => `${key}:${style[key] ?? ''}`)
    .join(';');
}

function tokenStyle(token: ThemedToken): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(token.htmlStyle ?? {})) {
    if (key.startsWith('--') && !key.endsWith('-bg')) out[key] = value;
  }
  return out;
}

export function compactTokens(result: TokensResult): HighlightResult {
  const base = parseDeclarations(result.fg);
  const baseKey = styleKey(base);
  const styles: Record<string, string>[] = [];
  const index = new Map<string, number>();

  const lines = result.tokens.map((line) => {
    const out: WireToken[] = [];
    for (const token of line) {
      const style = tokenStyle(token);
      const key = styleKey(style);
      let styleIndex = -1;
      if (key !== '' && key !== baseKey) {
        const known = index.get(key);
        if (known === undefined) {
          styleIndex = styles.length;
          styles.push(style);
          index.set(key, styleIndex);
        } else {
          styleIndex = known;
        }
      }
      // Whitespace never shows color; merge it into the previous token.
      const previous = out[out.length - 1];
      if (previous !== undefined && (previous[1] === styleIndex || token.content.trim() === '')) {
        previous[0] += token.content;
      } else {
        out.push([token.content, styleIndex]);
      }
    }
    return out;
  });

  return { base, styles, lines };
}
