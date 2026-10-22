import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDocuments } from '@/stores/documentsStore';
import { makeDoc, NOT_EDITING } from '@/test/state';
import type { DocumentTab } from '@/types';
import { indentEdit } from './indent';
import { MarkdownEditor } from './MarkdownEditor';

const actions = vi.hoisted(() => ({
  saveDocument: vi.fn(() => Promise.resolve()),
  setDraft: vi.fn(),
  stopEditing: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/features/documents/actions', () => actions);

const commands = vi.hoisted(() => ({
  runCommand: vi.fn(() => Promise.resolve()),
  getShortcutLabel: (id: string) => (id === 'edit.save' ? 'Ctrl+S' : undefined),
}));
vi.mock('@/app/commands', () => commands);

const TAB_ID = 'tab-1';

function editingTab(overrides: Partial<DocumentTab> = {}): DocumentTab {
  return {
    id: TAB_ID,
    path: '/docs/guide.md',
    name: 'guide.md',
    status: 'ready',
    doc: makeDoc('/docs/guide.md'),
    error: null,
    scrollTop: 0,
    externalChange: null,
    revision: 1,
    ...NOT_EDITING,
    editing: true,
    draft: '# Title\n',
    savedText: '# Title\n',
    ...overrides,
  };
}

function setTab(overrides: Partial<DocumentTab> = {}) {
  useDocuments.setState({ tabs: [editingTab(overrides)], activeId: TAB_ID, closedPaths: [] });
}

/** Mirrors what `setDraft` would do, so follow-up keystrokes see the new text. */
function syncDraft() {
  actions.setDraft.mockImplementation((...args: unknown[]) => {
    const [id, text] = args as [string, string];
    useDocuments.setState(({ tabs }) => ({
      tabs: tabs.map((tab) => (tab.id === id ? { ...tab, draft: text, dirty: true } : tab)),
    }));
  });
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Edit guide.md' });

beforeEach(() => {
  vi.clearAllMocks();
  setTab();
});

describe('MarkdownEditor', () => {
  it('shows the draft in a focused, plain textarea', () => {
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    const el = textarea();
    expect(el).toHaveValue('# Title\n');
    expect(el).toHaveFocus();
    expect(el).toHaveAttribute('spellcheck', 'false');
  });

  it('reports typing as a draft update', async () => {
    syncDraft();
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    await userEvent.type(textarea(), '!');
    expect(actions.setDraft).toHaveBeenLastCalledWith(TAB_ID, '# Title\n!');
  });

  it('saves with Mod+S without reaching the browser default', async () => {
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(commands.runCommand).toHaveBeenCalledWith('edit.save');
  });

  it('leaves the editor on Escape', async () => {
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    await userEvent.keyboard('{Escape}');
    expect(actions.stopEditing).toHaveBeenCalledWith(TAB_ID);
  });

  it('indents with Tab and outdents with Shift+Tab', async () => {
    syncDraft();
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    const el = textarea();
    el.setSelectionRange(0, 0);
    await userEvent.keyboard('{Tab}');
    expect(el).toHaveValue('  # Title\n');
    expect(actions.setDraft).toHaveBeenLastCalledWith(TAB_ID, '  # Title\n');
    expect(el).toHaveFocus();

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(el).toHaveValue('# Title\n');
  });

  it('shows the save state and the way back to reading', async () => {
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();

    act(() => {
      setTab({ draft: '# Changed', dirty: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(actions.saveDocument).toHaveBeenCalledWith(TAB_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(actions.stopEditing).toHaveBeenCalledWith(TAB_ID, { discard: true });
    await userEvent.click(screen.getByRole('button', { name: 'Back to Reading' }));
    expect(actions.stopEditing).toHaveBeenCalledWith(TAB_ID);
  });

  it('says when a save is in flight', () => {
    setTab({ dirty: true, saving: true });
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('adopts a draft that changed outside the editor', () => {
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    act(() => {
      setTab({ draft: '# From disk\n' });
    });
    expect(textarea()).toHaveValue('# From disk\n');
  });

  it('restores the scroll position per tab', () => {
    const view = render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    const el = textarea();
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
    Object.defineProperty(el, 'scrollTop', { value: 120, writable: true });
    view.unmount();
    render(<MarkdownEditor tabId={TAB_ID} name="guide.md" />);
    expect(textarea().scrollTop).toBe(120);
  });
});

describe('indentEdit', () => {
  it('inserts two spaces at the caret', () => {
    expect(indentEdit('abc', 1, 1, false)).toEqual({
      from: 1,
      to: 1,
      text: '  ',
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it('indents every line of a multi-line selection', () => {
    const edit = indentEdit('one\ntwo', 1, 5, false);
    expect(edit).toMatchObject({ from: 0, to: 7, text: '  one\n  two' });
    expect(edit?.selectionStart).toBe(3);
    expect(edit?.selectionEnd).toBe(9);
  });

  it('leaves blank lines alone', () => {
    expect(indentEdit('a\n\nb', 0, 4, false)?.text).toBe('  a\n\n  b');
  });

  it('outdents up to two spaces or a tab', () => {
    expect(indentEdit('    a', 5, 5, true)?.text).toBe('  a');
    expect(indentEdit('\ta', 2, 2, true)?.text).toBe('a');
    expect(indentEdit(' a\n  b', 0, 6, true)?.text).toBe('a\nb');
  });

  it('returns null when there is nothing to outdent', () => {
    expect(indentEdit('abc', 0, 3, true)).toBeNull();
  });
});
