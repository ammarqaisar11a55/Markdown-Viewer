import { clsx } from 'clsx';
import { memo } from 'react';
import { getShortcutLabel } from '@/app/commands';
import { displayPath } from '@/lib/paths';
import { logger } from '@/lib/platform/logger';
import { copyText } from '@/lib/platform/system';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import { toast } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatEditingState, formatReadingValue, formatWordValue, formatZoom } from './format';

/* The status bar reads as a spec sheet: cells divided by hairlines. */
const itemClass =
  'flex h-full items-center px-2.5 transition-colors duration-100 hover:bg-bg-muted hover:text-fg';

const cellClass = 'flex items-center gap-2 border-l border-border px-2.5';

/** A labelled status cell: condensed caption, then the value. */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className={cellClass}>
      <span className="mv-label text-fg-subtle">{label}</span>
      <span>{value}</span>
    </span>
  );
}

async function copyPath(path: string): Promise<void> {
  try {
    await copyText(path);
    toast({ title: 'Path copied', variant: 'success', id: 'path-copied', durationMs: 2000 });
  } catch (err) {
    logger.error('Copying the file path failed', err);
    toast({ title: 'Could not copy the path.', variant: 'error' });
  }
}

export const StatusBar = memo(function StatusBar() {
  const path = useDocuments((s) => selectActiveTab(s)?.path ?? null);
  const wordCount = useDocuments((s) => selectActiveTab(s)?.doc?.wordCount ?? null);
  const editing = useDocuments((s) => selectActiveTab(s)?.editing ?? false);
  const dirty = useDocuments((s) => selectActiveTab(s)?.dirty ?? false);
  const saving = useDocuments((s) => selectActiveTab(s)?.saving ?? false);
  const zoom = useUi((s) => s.zoom);
  const resetZoom = useUi((s) => s.resetZoom);

  return (
    <footer
      aria-label="Status bar"
      className="theme-surface flex h-[30px] shrink-0 items-stretch border-t border-border text-ui-xs text-fg"
    >
      <div className="flex h-full min-w-0 flex-1 items-center">
        {path && (
          <Tooltip label="Copy file path" side="top" className="min-w-0">
            <button
              type="button"
              onClick={() => void copyPath(path)}
              className={clsx(itemClass, 'min-w-0')}
            >
              <span className="truncate">{displayPath(path)}</span>
            </button>
          </Tooltip>
        )}
      </div>
      <div className="tabular flex h-full shrink-0 items-stretch">
        {editing ? (
          <Cell label="State" value={formatEditingState(saving, dirty)} />
        ) : (
          wordCount !== null && (
            <>
              <Cell label="Words" value={formatWordValue(wordCount)} />
              <Cell label="Read" value={formatReadingValue(wordCount)} />
            </>
          )
        )}
        <Tooltip label="Reset zoom" shortcut={getShortcutLabel('view.zoomReset')} side="top">
          <button
            type="button"
            onClick={resetZoom}
            aria-label={`Zoom ${formatZoom(zoom)}, reset zoom`}
            className={clsx(itemClass, 'gap-2 border-l border-border')}
          >
            <span className="mv-label text-fg-subtle">Zoom</span>
            {formatZoom(zoom)}
          </button>
        </Tooltip>
      </div>
    </footer>
  );
});
