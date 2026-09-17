import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows the label and shortcut after hovering an icon button', async () => {
    const user = userEvent.setup();
    render(<IconButton label="Open file" shortcut="Ctrl+O" icon={<svg />} />);
    const button = screen.getByRole('button', { name: 'Open file' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(button);
    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 1500 });
    expect(tooltip).toHaveTextContent('Open file');
    expect(tooltip).toHaveTextContent('Ctrl+O');

    await user.unhover(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Settings">
        <button type="button">Gear</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Gear' })).toHaveFocus();
    expect(await screen.findByRole('tooltip', {}, { timeout: 1500 })).toHaveTextContent('Settings');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('never shows when disabled', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Hidden" disabled>
        <button type="button">Target</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('gives icon buttons an accessible name', () => {
    render(<IconButton label="Close tab" icon={<svg />} active />);
    expect(screen.getByRole('button', { name: 'Close tab' })).toBeInTheDocument();
  });
});
