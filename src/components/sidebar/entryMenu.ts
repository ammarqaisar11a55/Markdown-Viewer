import { openDocument } from '@/features/documents/actions';
import { logger } from '@/lib/platform/logger';
import { copyText, revealInFolder } from '@/lib/platform/system';
import type { ContextMenuItem } from '@/stores/contextMenuStore';
import { toast } from '@/stores/toastStore';

export function copyPathAction(path: string): void {
  copyText(path).then(
    () => {
      toast({ title: 'Path copied', variant: 'success', id: 'path-copied', durationMs: 2000 });
    },
    (err: unknown) => {
      logger.error('Copying a path failed', err);
      toast({ title: 'Could not copy the path.', variant: 'error' });
    },
  );
}

export function revealAction(path: string): void {
  revealInFolder(path).catch((err: unknown) => {
    logger.error('Revealing a path failed', err);
    toast({
      title: 'Could not show the file in its folder.',
      description: 'The file may have been moved or deleted.',
      variant: 'error',
    });
  });
}

/** Common context-menu entries for a file or folder on disk. */
export function pathMenuItems(path: string): ContextMenuItem[] {
  return [
    { id: 'reveal', label: 'Reveal in Folder', onSelect: () => revealAction(path) },
    { id: 'copy-path', label: 'Copy Path', onSelect: () => copyPathAction(path) },
  ];
}

export function openFileMenuItems(path: string): ContextMenuItem[] {
  return [
    { id: 'open', label: 'Open', onSelect: () => void openDocument(path) },
    {
      id: 'open-new-tab',
      label: 'Open in New Tab',
      onSelect: () => void openDocument(path, { newTab: true }),
    },
  ];
}
