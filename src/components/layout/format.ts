export const WORDS_PER_MINUTE = 230;

const numberFormat = new Intl.NumberFormat('en-US');

export function formatWordCount(words: number): string {
  return `${numberFormat.format(words)} ${words === 1 ? 'word' : 'words'}`;
}

export function formatReadingTime(words: number): string {
  if (words === 0) return '0 min read';
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${numberFormat.format(minutes)} min read`;
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
