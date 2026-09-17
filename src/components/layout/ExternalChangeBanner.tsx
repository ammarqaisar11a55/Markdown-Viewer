import { clsx } from 'clsx';
import { FileX, RefreshCw } from 'lucide-react';
import { closeTab, dismissExternalChange, reloadDocument } from '@/features/documents/actions';

export interface ExternalChangeBannerProps {
  tabId: string;
  kind: 'modified' | 'removed';
}

const actionClass =
  'h-6 rounded-sm px-2 text-ui-sm font-medium transition-colors duration-100 hover:bg-bg-muted';

export function ExternalChangeBanner({ tabId, kind }: ExternalChangeBannerProps) {
  const removed = kind === 'removed';
  const Icon = removed ? FileX : RefreshCw;
  return (
    <div
      role="status"
      className={clsx(
        'border-border text-ui flex h-9 shrink-0 items-center gap-2.5 border-b px-3',
        removed ? 'bg-danger-subtle' : 'bg-warning-subtle',
      )}
    >
      <Icon
        aria-hidden
        className={clsx('size-4 shrink-0', removed ? 'text-danger' : 'text-warning')}
      />
      <p className="text-fg min-w-0 flex-1 truncate">
        {removed ? 'File was deleted or moved.' : 'This file changed on disk.'}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {removed ? (
          <>
            <button
              type="button"
              className={clsx(actionClass, 'text-fg')}
              onClick={() => {
                closeTab(tabId);
              }}
            >
              Close
            </button>
            <button
              type="button"
              className={clsx(actionClass, 'text-fg-muted')}
              onClick={() => {
                dismissExternalChange(tabId);
              }}
            >
              Keep Open
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={clsx(actionClass, 'text-fg')}
              onClick={() => {
                dismissExternalChange(tabId);
                void reloadDocument(tabId);
              }}
            >
              Reload
            </button>
            <button
              type="button"
              className={clsx(actionClass, 'text-fg-muted')}
              onClick={() => {
                dismissExternalChange(tabId);
              }}
            >
              Ignore
            </button>
          </>
        )}
      </div>
    </div>
  );
}
