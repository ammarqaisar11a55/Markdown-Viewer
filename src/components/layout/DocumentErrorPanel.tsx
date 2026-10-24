import { FileWarning, RotateCw, X } from 'lucide-react';
import { closeTab, reloadDocument } from '@/features/documents/actions';
import { removeRecent, useRecent } from '@/features/recent/actions';
import { displayPath, samePath } from '@/lib/paths';
import type { AppError } from '@/types';
import { Button } from '@/components/ui/Button';

export interface DocumentErrorPanelProps {
  tabId: string;
  path: string;
  error: AppError | null;
}

export function DocumentErrorPanel({ tabId, path, error }: DocumentErrorPanelProps) {
  const inRecent = useRecent((s) => s.items.some((item) => samePath(item.path, path)));
  const title = error?.title ?? 'Unable to open this file.';
  const description = error?.description ?? 'Something went wrong while reading the file.';

  return (
    <div className="flex h-full min-h-0 overflow-y-auto">
      <div
        role="alert"
        className="m-auto flex max-w-md flex-col items-center px-6 py-12 text-center"
      >
        <div className="flex size-10 items-center justify-center border border-danger/40 bg-danger-subtle text-danger">
          <FileWarning aria-hidden className="size-5" />
        </div>
        <h2 className="mt-5 text-[26px] leading-none uppercase">{title}</h2>
        <p className="mt-2.5 text-ui text-fg-muted">{description}</p>
        <p className="selectable mt-4 max-w-full truncate border border-border px-2 py-1 font-mono text-ui-xs text-fg-subtle">
          {displayPath(path)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="primary"
            icon={<RotateCw aria-hidden />}
            onClick={() => void reloadDocument(tabId, { preserveScroll: false })}
          >
            Try Again
          </Button>
          {inRecent && (
            <Button
              onClick={() => {
                removeRecent(path);
              }}
            >
              Remove from Recent
            </Button>
          )}
          <Button
            variant="ghost"
            icon={<X aria-hidden />}
            onClick={() => {
              void closeTab(tabId);
            }}
          >
            Close Tab
          </Button>
        </div>
      </div>
    </div>
  );
}
