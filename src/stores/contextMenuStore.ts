import { create } from 'zustand';

export type ContextMenuItem =
  | {
      type?: 'item';
      id: string;
      label: string;
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      onSelect: () => void;
    }
  | { type: 'separator' };

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const INITIAL: ContextMenuState = { open: false, x: 0, y: 0, items: [] };

export const useContextMenu = create<ContextMenuState>()(() => INITIAL);

/** Opens the application context menu at viewport coordinates. */
export function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
  if (items.length === 0) {
    closeContextMenu();
    return;
  }
  useContextMenu.setState({ open: true, x, y, items });
}

export function closeContextMenu(): void {
  if (!useContextMenu.getState().open) return;
  useContextMenu.setState(INITIAL);
}
