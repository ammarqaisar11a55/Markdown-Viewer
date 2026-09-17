import { closeContextMenu, openContextMenu, useContextMenu } from './contextMenuStore';

describe('contextMenuStore', () => {
  afterEach(() => {
    closeContextMenu();
  });

  it('opens at a position with items and closes again', () => {
    const onSelect = vi.fn();
    openContextMenu(12, 34, [{ id: 'a', label: 'A', onSelect }]);
    expect(useContextMenu.getState()).toMatchObject({ open: true, x: 12, y: 34 });
    expect(useContextMenu.getState().items).toHaveLength(1);

    closeContextMenu();
    expect(useContextMenu.getState()).toEqual({ open: false, x: 0, y: 0, items: [] });
  });

  it('treats an empty item list as a close', () => {
    openContextMenu(1, 1, [{ id: 'a', label: 'A', onSelect: vi.fn() }]);
    openContextMenu(5, 5, []);
    expect(useContextMenu.getState().open).toBe(false);
  });

  it('does not notify subscribers when closing an already closed menu', () => {
    const listener = vi.fn();
    const unsubscribe = useContextMenu.subscribe(listener);
    closeContextMenu();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
