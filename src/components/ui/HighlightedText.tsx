import { memo } from 'react';

export interface HighlightedTextProps {
  text: string;
  /** Sorted indices (relative to `text`) of characters to emphasize. */
  indices: readonly number[];
  className?: string;
}

/** Renders `text` with the given character positions highlighted. */
export const HighlightedText = memo(function HighlightedText({
  text,
  indices,
  className,
}: HighlightedTextProps) {
  if (indices.length === 0) return <span className={className}>{text}</span>;
  const marked = new Set(indices);
  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = marked.has(i);
    const last = parts.at(-1);
    const char = text.charAt(i);
    if (last?.hit === hit) last.text += char;
    else parts.push({ text: char, hit });
  }
  let offset = 0;
  return (
    <span className={className}>
      {parts.map((part) => {
        const key = offset;
        offset += part.text.length;
        return part.hit ? (
          <mark key={key} className="text-accent bg-transparent font-semibold">
            {part.text}
          </mark>
        ) : (
          <span key={key}>{part.text}</span>
        );
      })}
    </span>
  );
});
