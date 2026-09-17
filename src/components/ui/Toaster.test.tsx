import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast, useToasts } from '@/stores/toastStore';
import { Toaster } from './Toaster';

describe('Toaster', () => {
  beforeEach(() => {
    useToasts.setState({ toasts: [] });
  });

  it('renders toasts with status or alert roles', () => {
    render(<Toaster />);
    act(() => {
      toast({ title: 'Saved', variant: 'success' });
      toast({ title: 'Unable to open this file.', description: 'It was moved.', variant: 'error' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unable to open this file.');
    expect(alert).toHaveTextContent('It was moved.');
  });

  it('runs an action and dismisses the toast', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    render(<Toaster />);
    act(() => {
      toast({
        title: 'File changed externally.',
        variant: 'info',
        durationMs: null,
        actions: [
          { label: 'Reload', onClick: reload, primary: true },
          { label: 'Ignore', onClick: vi.fn() },
        ],
      });
    });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('File changed externally.')).not.toBeInTheDocument();
  });

  it('dismisses with the close button', async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast({ title: 'Hello', variant: 'info', durationMs: null });
    });
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(useToasts.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after its duration', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => {
        toast({ title: 'Brief', variant: 'info', durationMs: 1000 });
      });
      expect(screen.getByText('Brief')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.queryByText('Brief')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps sticky toasts', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => {
        toast({ title: 'Sticky', variant: 'warning', durationMs: null });
      });
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByText('Sticky')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
