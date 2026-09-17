// User interactions with rendered content: link activation and the content
// context menu. Kept framework-free so it can be unit-tested.

import { openDocument } from '@/features/documents/actions';
import { formatShortcut } from '@/lib/shortcuts';
import { logger } from '@/lib/platform/logger';
import { copyText, openExternalUrl, revealInFolder } from '@/lib/platform/system';
import type { ContextMenuItem } from '@/stores/contextMenuStore';
import {
  scrollToElement,
  setPendingAnchor,
  takePendingAnchor,
  useViewer,
} from '@/stores/viewerStore';
import { getCodeBlockInfo } from './codeBlocks';
import { classifyLink, linkCopyText, type LinkTarget } from './links';

function report(action: string) {
  return (error: unknown) => logger.error(action, error);
}

async function openMarkdownLink(path: string, hash: string | null): Promise<void> {
  setPendingAnchor(hash);
  await openDocument(path, { newTab: true });
  if (hash === null) return;
  // When the target was already open (no re-render), scroll right away.
  requestAnimationFrame(() => {
    if (useViewer.getState().renderProgress < 1) return;
    const id = takePendingAnchor();
    if (id !== null) scrollToElement(id);
  });
}

/** Performs the action for an activated link. */
export function activateLink(target: LinkTarget): void {
  switch (target.type) {
    case 'anchor':
      if (!scrollToElement(target.id)) logger.debug(`Anchor not found: #${target.id}`);
      return;
    case 'markdown':
      openMarkdownLink(target.path, target.hash).catch(report('Failed to open linked document'));
      return;
    case 'local-file':
      revealInFolder(target.path).catch(report('Failed to reveal linked file'));
      return;
    case 'external':
      openExternalUrl(target.url).catch(report('Failed to open external link'));
      return;
    case 'blocked':
      logger.debug(`Blocked link (${target.reason})`);
      return;
  }
}

export interface ContentMenuOptions {
  /** The `.markdown-body` element. */
  content: HTMLElement;
  docPath: string;
  target: Element;
  selectionText: string;
  onOpenImage: (img: HTMLImageElement) => void;
}

/** Selects the whole document (and nothing outside it). */
export function selectAllContent(content: HTMLElement): void {
  const selection = content.ownerDocument.getSelection();
  if (selection === null) return;
  const range = content.ownerDocument.createRange();
  range.selectNodeContents(content);
  selection.removeAllRanges();
  selection.addRange(range);
}

function copy(text: string): void {
  copyText(text).catch(report('Failed to copy to the clipboard'));
}

/** Builds the context menu for a right-click inside the document. */
export function buildContentMenu({
  content,
  docPath,
  target,
  selectionText,
  onOpenImage,
}: ContentMenuOptions): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  if (selectionText !== '') {
    items.push({
      id: 'copy',
      label: 'Copy',
      shortcut: formatShortcut('Mod+C'),
      onSelect: () => copy(selectionText),
    });
  }

  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (anchor !== null && content.contains(anchor)) {
    const href = anchor.getAttribute('href') ?? '';
    const link = classifyLink(href, docPath);
    if (link.type !== 'blocked') {
      if (items.length > 0) items.push({ type: 'separator' });
      items.push(
        {
          id: 'open-link',
          label: link.type === 'local-file' ? 'Reveal Linked File' : 'Open Link',
          onSelect: () => activateLink(link),
        },
        { id: 'copy-link', label: 'Copy Link', onSelect: () => copy(linkCopyText(link, href)) },
      );
    }
  }

  const img = target.closest<HTMLImageElement>('img.md-image');
  if (img !== null && content.contains(img)) {
    const localPath = img.dataset.localPath;
    const address = localPath ?? img.getAttribute('src') ?? '';
    if (items.length > 0) items.push({ type: 'separator' });
    items.push({ id: 'view-image', label: 'View Image', onSelect: () => onOpenImage(img) });
    items.push(
      localPath === undefined
        ? {
            id: 'open-image',
            label: 'Open Image in Browser',
            disabled: img.dataset.srcKind !== 'remote',
            onSelect: () => {
              openExternalUrl(address).catch(report('Failed to open image'));
            },
          }
        : {
            id: 'open-image',
            label: 'Reveal Image in Folder',
            onSelect: () => {
              revealInFolder(localPath).catch(report('Failed to reveal image'));
            },
          },
    );
    items.push({
      id: 'copy-image-address',
      label: localPath === undefined ? 'Copy Image Address' : 'Copy Image Path',
      disabled: img.dataset.srcKind === 'data',
      onSelect: () => copy(address),
    });
  }

  const block = target.closest<HTMLElement>('.md-code-block');
  const info = block === null ? undefined : getCodeBlockInfo(block);
  if (info !== undefined) {
    if (items.length > 0) items.push({ type: 'separator' });
    items.push({ id: 'copy-code', label: 'Copy Code Block', onSelect: () => copy(info.code) });
  }

  if (items.length > 0) items.push({ type: 'separator' });
  items.push({
    id: 'select-all',
    label: 'Select All',
    shortcut: formatShortcut('Mod+A'),
    onSelect: () => selectAllContent(content),
  });
  return items;
}
