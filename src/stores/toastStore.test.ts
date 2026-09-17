import { dismissToast, MAX_TOASTS, toast, useToasts } from './toastStore';

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

describe('toastStore', () => {
  it('adds toasts with defaults', () => {
    const id = toast({ title: 'Saved', variant: 'success' });
    expect(useToasts.getState().toasts).toEqual([
      expect.objectContaining({ id, title: 'Saved', actions: [], durationMs: 4000 }),
    ]);
  });

  it('supports sticky toasts and replaces by id', () => {
    toast({ id: 'x', title: 'One', variant: 'info', durationMs: null });
    toast({ id: 'x', title: 'Two', variant: 'warning', description: 'd' });
    const { toasts } = useToasts.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ title: 'Two', description: 'd', durationMs: 7000 });
  });

  it('keeps at most MAX_TOASTS and dismisses', () => {
    for (let i = 0; i < MAX_TOASTS + 2; i += 1) toast({ title: `t${i}`, variant: 'info' });
    const { toasts } = useToasts.getState();
    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts[0]?.title).toBe('t2');
    dismissToast(toasts[0]!.id);
    expect(useToasts.getState().toasts).toHaveLength(MAX_TOASTS - 1);
  });
});
