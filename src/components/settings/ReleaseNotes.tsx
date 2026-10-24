import { useMemo, type ReactNode } from 'react';
import { parseReleaseNotes, type NoteSpan } from './releaseNotes';

export interface ReleaseNotesProps {
  /** The version the notes describe, when the server announced one. */
  version: string | null;
  /** The raw release body; anything unparseable is shown as plain text. */
  notes: string | null;
}

/**
 * "What's new" for an update that is on offer: the release notes, parsed into
 * plain data (never HTML) and drawn in a bounded, scrollable box.
 *
 * Nothing is rendered when the notes are missing or say nothing — the version
 * is already on the row below.
 */
export function ReleaseNotes({ version, notes }: ReleaseNotesProps) {
  const blocks = useMemo(() => parseReleaseNotes(notes ?? ''), [notes]);
  if (blocks.length === 0) return null;
  const title = version === null ? 'What’s new' : `What’s new in ${version}`;

  return (
    <div className="border-b border-border py-2.5">
      <p className="text-[14px] leading-5 text-fg">{title}</p>
      {/* Scrollable, so long notes cannot stretch the dialog; focusable, so
          the keyboard can scroll it too. */}
      <div
        role="group"
        aria-label={title}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be focusable
        tabIndex={0}
        className="focus-inset selectable mt-2 max-h-40 overflow-y-auto border border-border bg-bg-inset px-3 py-2"
      >
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            return (
              <h4
                key={index}
                className="mv-label mt-2.5 text-ui-xs text-fg-muted first:mt-0"
                data-level={block.level}
              >
                <Spans spans={block.spans} />
              </h4>
            );
          }
          if (block.kind === 'list') {
            return (
              <ul key={index} className="mt-1 space-y-0.5">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="relative pl-3.5 text-ui-sm text-fg before:absolute before:top-[7px] before:left-0 before:block before:size-1 before:bg-fg-subtle before:content-['']"
                  >
                    <Spans spans={item} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="mt-1.5 text-ui-sm text-fg first:mt-0">
              <Spans spans={block.spans} />
            </p>
          );
        })}
      </div>
    </div>
  );
}

function Spans({ spans }: { spans: readonly NoteSpan[] }): ReactNode {
  return spans.map((span, index) => {
    if (span.code) {
      return (
        <code key={index} className="bg-bg-subtle px-1 font-mono text-[0.92em]">
          {span.text}
        </code>
      );
    }
    if (span.strong) {
      return (
        <strong key={index} className="font-semibold">
          {span.text}
        </strong>
      );
    }
    return <span key={index}>{span.text}</span>;
  });
}
