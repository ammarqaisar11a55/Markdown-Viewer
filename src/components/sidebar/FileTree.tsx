import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { openDocument } from '@/features/documents/actions';
import { toggleFolderExpanded, useFolder } from '@/features/folder/actions';
import { samePath } from '@/lib/paths';
import { openContextMenu, type ContextMenuItem } from '@/stores/contextMenuStore';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import type { DirectoryEntry } from '@/types';
import { openFileMenuItems, pathMenuItems } from './entryMenu';
import { FileTreeNode } from './FileTreeNode';
import { flattenTree, type VisibleNode } from './flattenTree';
import { findByData } from '@/components/ui/dom';

export interface FileTreeProps {
  root: DirectoryEntry;
  label: string;
}

export function FileTree({ root, label }: FileTreeProps) {
  const expanded = useFolder((s) => s.expanded);
  const activePath = useDocuments((s) => selectActiveTab(s)?.path ?? null);
  const nodes = useMemo(() => flattenTree(root, expanded), [root, expanded]);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Keep the roving tab stop on a visible row.
  const tabStop =
    (focusedPath !== null && nodes.some((n) => n.entry.path === focusedPath)
      ? focusedPath
      : null) ??
    (activePath !== null
      ? nodes.find((n) => samePath(n.entry.path, activePath))?.entry.path
      : null) ??
    nodes[0]?.entry.path ??
    null;

  const focusPath = useCallback((path: string) => {
    setFocusedPath(path);
    const el = findByData(treeRef.current, 'path', path);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  const activate = useCallback((node: VisibleNode) => {
    const { entry } = node;
    if (entry.kind === 'directory') toggleFolderExpanded(entry.path);
    else if (entry.isMarkdown) void openDocument(entry.path);
  }, []);

  const openMenuAt = useCallback((node: VisibleNode, x: number, y: number) => {
    const { entry } = node;
    const items: ContextMenuItem[] = [];
    if (entry.kind === 'directory') {
      items.push({
        id: 'toggle',
        label: node.expanded ? 'Collapse' : 'Expand',
        onSelect: () => {
          toggleFolderExpanded(entry.path);
        },
      });
    } else if (entry.isMarkdown) {
      items.push(...openFileMenuItems(entry.path));
    }
    if (items.length > 0) items.push({ type: 'separator' });
    items.push(...pathMenuItems(entry.path));
    openContextMenu(x, y, items);
  }, []);

  const showMenu = useCallback(
    (node: VisibleNode, event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openMenuAt(node, event.clientX, event.clientY);
    },
    [openMenuAt],
  );

  const onKeyDown = useCallback(
    (node: VisibleNode, event: KeyboardEvent<HTMLElement>) => {
      const list = nodesRef.current;
      const index = list.findIndex((n) => n.entry.path === node.entry.path);
      const isDir = node.entry.kind === 'directory';
      const go = (target: VisibleNode | undefined) => {
        if (target) focusPath(target.entry.path);
      };
      switch (event.key) {
        case 'ArrowDown':
          go(list[index + 1]);
          break;
        case 'ArrowUp':
          go(list[index - 1]);
          break;
        case 'Home':
          go(list[0]);
          break;
        case 'End':
          go(list.at(-1));
          break;
        case 'ArrowRight':
          if (!isDir) return;
          if (!node.expanded) toggleFolderExpanded(node.entry.path);
          else if (list[index + 1]?.parentPath === node.entry.path) go(list[index + 1]);
          break;
        case 'ArrowLeft':
          if (isDir && node.expanded) toggleFolderExpanded(node.entry.path);
          else if (node.parentPath !== null) focusPath(node.parentPath);
          break;
        case 'Enter':
        case ' ':
          activate(node);
          break;
        case 'ContextMenu': {
          const rect = event.currentTarget.getBoundingClientRect();
          openMenuAt(node, rect.left + 24, rect.bottom);
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    },
    [activate, focusPath, openMenuAt],
  );

  return (
    <div ref={treeRef} role="tree" aria-label={label} className="flex flex-col px-2 pb-3">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.entry.path}
          node={node}
          selected={
            node.entry.kind === 'file' &&
            activePath !== null &&
            samePath(node.entry.path, activePath)
          }
          focused={node.entry.path === tabStop}
          onActivate={activate}
          onFocusNode={setFocusedPath}
          onContextMenu={showMenu}
          onKeyDown={onKeyDown}
        />
      ))}
    </div>
  );
}
