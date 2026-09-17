import { clsx } from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { memo } from 'react';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { useResolvedTheme } from '@/hooks/useThemeEffect';
import { displayPath } from '@/lib/paths';
import { logger } from '@/lib/platform/logger';
import { copyText } from '@/lib/platform/system';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import { toast } from '@/stores/toastStore';
import { useUi } from '@/stores/uiStore';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatReadingTime, formatWordCount, formatZoom } from './format';

const itemClass =
  'flex h-full items-center rounded-sm px-1.5 transition-colors duration-100 hover:bg-bg-muted hover:text-fg';

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
  const zoom = useUi((s) => s.zoom);
  const resetZoom = useUi((s) => s.resetZoom);
  const theme = useResolvedTheme();

  return (
    <footer
      aria-label="Status bar"
      className="theme-surface flex h-6 shrink-0 items-center gap-2 border-t border-border bg-bg-subtle px-1.5 text-ui-xs text-fg-muted"
    >
      <div className="flex h-full min-w-0 flex-1 items-center py-0.5">
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
      <div className="tabular flex h-full shrink-0 items-center gap-1 py-0.5">
        {wordCount !== null && (
          <>
            <span className="px-1.5">{formatWordCount(wordCount)}</span>
            <span className="px-1.5">{formatReadingTime(wordCount)}</span>
          </>
        )}
        <Tooltip label="Reset zoom" shortcut={getShortcutLabel('view.zoomReset')} side="top">
          <button
            type="button"
            onClick={resetZoom}
            aria-label={`Zoom ${formatZoom(zoom)}, reset zoom`}
            className={clsx(itemClass, 'w-11 justify-center')}
          >
            {formatZoom(zoom)}
          </button>
        </Tooltip>
        <IconButton
          size="sm"
          tooltipSide="top"
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          shortcut={getShortcutLabel('view.toggleTheme')}
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          onClick={() => void runCommand('view.toggleTheme')}
          className="size-5!"
        />
      </div>
    </footer>
  );
});
