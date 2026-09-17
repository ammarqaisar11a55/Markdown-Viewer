import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HighlightedText } from './HighlightedText';
import { Kbd } from './Kbd';
import { SegmentedControl } from './SegmentedControl';
import { Switch } from './Switch';

describe('Switch', () => {
  it('toggles via click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <span id="lbl">Auto reload</span>
        <Switch checked={false} onChange={onChange} labelledBy="lbl" />
      </>,
    );
    const toggle = screen.getByRole('switch', { name: 'Auto reload' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ] as const;

  it('selects with click and arrow keys (wrapping)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl value="a" options={options} onChange={onChange} label="Letters" />);
    expect(screen.getByRole('radiogroup', { name: 'Letters' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith('b');

    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('c');
  });
});

describe('Kbd', () => {
  it('splits shortcuts into key caps', () => {
    const { container } = render(<Kbd shortcut="Ctrl+Shift+O" />);
    expect(container.querySelectorAll('kbd kbd')).toHaveLength(3);
  });

  it('keeps a literal plus key', () => {
    const { container } = render(<Kbd shortcut="Ctrl++" />);
    const keys = Array.from(container.querySelectorAll('kbd kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['Ctrl', '+']);
  });
});

describe('HighlightedText', () => {
  it('marks the given character positions', () => {
    const { container } = render(<HighlightedText text="readme.md" indices={[0, 1, 7]} />);
    expect(Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual([
      're',
      'm',
    ]);
    expect(container).toHaveTextContent('readme.md');
  });
});
