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

/** Bare value for a labelled status-bar cell ("1,234"). */
export function formatWordValue(words: number): string {
  return numberFormat.format(words);
}

/** Bare value for a labelled status-bar cell ("5 min"). */
export function formatReadingValue(words: number): string {
  if (words === 0) return '0 min';
  return `${numberFormat.format(Math.max(1, Math.round(words / WORDS_PER_MINUTE)))} min`;
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Status-bar text while the editor is open. */
export function formatEditingState(saving: boolean, dirty: boolean): string {
  if (saving) return 'Saving…';
  return dirty ? 'Editing — unsaved changes' : 'Editing';
}
