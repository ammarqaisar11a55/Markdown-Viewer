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
        <div className="bg-danger-subtle text-danger flex size-10 items-center justify-center rounded-lg">
          <FileWarning aria-hidden className="size-5" />
        </div>
        <h2 className="text-ui-lg text-fg mt-4 font-semibold">{title}</h2>
        <p className="text-ui text-fg-muted mt-1">{description}</p>
        <p className="selectable bg-bg-inset text-ui-xs text-fg-subtle mt-3 max-w-full truncate rounded-sm px-2 py-0.5 font-mono">
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
              closeTab(tabId);
            }}
          >
            Close Tab
          </Button>
        </div>
      </div>
    </div>
  );
}
