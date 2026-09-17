import { clsx } from 'clsx';
import { ChevronRight, File, FileText, Folder, FolderOpen } from 'lucide-react';
import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import type { VisibleNode } from './flattenTree';

export interface FileTreeNodeProps {
  node: VisibleNode;
  selected: boolean;
  focused: boolean;
  onActivate: (node: VisibleNode) => void;
  onFocusNode: (path: string) => void;
  onContextMenu: (node: VisibleNode, event: MouseEvent) => void;
  onKeyDown: (node: VisibleNode, event: KeyboardEvent<HTMLElement>) => void;
}

const INDENT_PX = 12;

export const FileTreeNode = memo(function FileTreeNode({
  node,
  selected,
  focused,
  onActivate,
  onFocusNode,
  onContextMenu,
  onKeyDown,
}: FileTreeNodeProps) {
  const { entry, level, expanded } = node;
  const isDir = entry.kind === 'directory';
  const disabled = !isDir && !entry.isMarkdown;
  const Icon = isDir ? (expanded ? FolderOpen : Folder) : entry.isMarkdown ? FileText : File;

  return (
    <div
      role="treeitem"
      data-path={entry.path}
      aria-level={level}
      aria-setsize={node.setSize}
      aria-posinset={node.posInSet}
      aria-expanded={isDir ? expanded : undefined}
      aria-selected={isDir ? undefined : selected}
      aria-disabled={disabled || undefined}
      tabIndex={focused ? 0 : -1}
      title={entry.name}
      onClick={() => {
        onFocusNode(entry.path);
        onActivate(node);
      }}
      onKeyDown={(event) => {
        onKeyDown(node, event);
      }}
      onContextMenu={(event) => {
        onContextMenu(node, event);
      }}
      style={{ paddingLeft: 4 + (level - 1) * INDENT_PX }}
      className={clsx(
        'focus-inset text-ui flex h-7 min-w-0 items-center gap-1 rounded-md pr-2',
        'transition-colors duration-75',
        selected
          ? 'bg-accent-subtle text-accent'
          : disabled
            ? 'text-fg-subtle cursor-default'
            : 'text-fg hover:bg-bg-muted',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {isDir && (
          <ChevronRight
            aria-hidden
            className={clsx(
              'text-fg-subtle size-3.5 transition-transform duration-100',
              expanded && 'rotate-90',
            )}
          />
        )}
      </span>
      <Icon
        aria-hidden
        className={clsx(
          'size-4 shrink-0',
          selected ? 'text-accent' : isDir ? 'text-fg-muted' : 'text-fg-subtle',
          disabled && 'opacity-60',
        )}
      />
      <span className={clsx('min-w-0 truncate', disabled && 'opacity-80')}>{entry.name}</span>
    </div>
  );
});
