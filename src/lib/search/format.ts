import { DEFAULT_MATCH_LIMIT } from './findMatches';

const numberFormat = new Intl.NumberFormat('en-US');

/** "3 of 42", "1 of 10,000+" or "No results". `current` is 0-based. */
export function formatMatchCount(current: number, total: number, limitReached: boolean): string {
  if (total === 0) return 'No results';
  const totalLabel = limitReached
    ? `${numberFormat.format(DEFAULT_MATCH_LIMIT)}+`
    : numberFormat.format(total);
  return `${numberFormat.format(current + 1)} of ${totalLabel}`;
}
