import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeContextMenu, openContextMenu, useContextMenu } from '@/stores/contextMenuStore';
import { ContextMenu } from './ContextMenu';
import { clampMenuPosition } from './menuPosition';

function openMenu() {
  const copy = vi.fn();
  const disabled = vi.fn();
  const remove = vi.fn();
  act(() => {
    openContextMenu(40, 50, [
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onSelect: copy },
      { id: 'disabled', label: 'Unavailable', disabled: true, onSelect: disabled },
      { type: 'separator' },
      { id: 'remove', label: 'Remove', danger: true, onSelect: remove },
    ]);
  });
  return { copy, disabled, remove };
}

describe('ContextMenu', () => {
  afterEach(() => {
    act(() => {
      closeContextMenu();
    });
  });

  it('renders nothing while closed', () => {
    render(<ContextMenu />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders items, separators and shortcuts, and focuses the menu', () => {
    render(<ContextMenu />);
    openMenu();
    const menu = screen.getByRole('menu');
    expect(menu).toHaveFocus();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Unavailable' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('navigates with arrow keys, skipping disabled items, and selects with Enter', async () => {
    const user = userEvent.setup();
    render(<ContextMenu />);
    const { copy, remove } = openMenu();
    const menu = screen.getByRole('menu');

    await user.keyboard('{ArrowDown}');
    expect(menu).toHaveAttribute(
      'aria-activedescendant',
      screen.getByText('Copy').parentElement!.id,
    );
    await user.keyboard('{ArrowDown}');
    expect(menu).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'Remove' }).id,
    );
    await user.keyboard('{ArrowDown}');
    expect(menu).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: /Copy/ }).id,
    );
    await user.keyboard('{ArrowUp}{Enter}');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(copy).not.toHaveBeenCalled();
    expect(useContextMenu.getState().open).toBe(false);
  });

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup();
    render(<ContextMenu />);
    const { copy } = openMenu();
    await user.keyboard('{ArrowDown}{Escape}');
    expect(copy).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('selects on click and ignores disabled items', async () => {
    const user = userEvent.setup();
    render(<ContextMenu />);
    const { copy, disabled } = openMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Unavailable' }));
    expect(disabled).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /Copy/ }));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside pointer down', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <ContextMenu />
      </>,
    );
    openMenu();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not open for an empty item list', () => {
    render(<ContextMenu />);
    act(() => {
      openContextMenu(0, 0, []);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('clampMenuPosition', () => {
  it('keeps the requested position when the menu fits', () => {
    expect(clampMenuPosition(100, 100, 200, 150, 1280, 720)).toEqual({ left: 100, top: 100 });
  });

  it('flips left and up when the menu would overflow the viewport', () => {
    expect(clampMenuPosition(1200, 700, 200, 150, 1280, 720)).toEqual({ left: 1000, top: 550 });
  });

  it('clamps into the viewport when flipping is not enough', () => {
    expect(clampMenuPosition(150, 100, 400, 800, 500, 600)).toEqual({ left: 4, top: 4 });
  });
});
