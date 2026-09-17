const LINES = [
  'w-2/5 h-6 mb-6',
  'w-full',
  'w-11/12',
  'w-4/5',
  'w-0 mb-4',
  'w-full',
  'w-10/12',
  'w-3/5',
];

/** Placeholder shown while a document loads; fades in late to avoid flashing. */
export function LoadingSkeleton() {
  return (
    <div className="h-full overflow-hidden" aria-busy="true">
      <span className="sr-only" role="status">
        Loading document…
      </span>
      <div
        aria-hidden
        className="animate-fade-in mx-auto w-full max-w-[var(--md-content-width,760px)] px-8 pt-14 [animation-delay:150ms]"
      >
        {LINES.map((line, index) => (
          <div
            // The skeleton is static; its index is its identity.
            key={index}
            className={`animate-shimmer mb-3 h-3.5 rounded-sm bg-bg-muted ${line}`}
          />
        ))}
      </div>
    </div>
  );
}
