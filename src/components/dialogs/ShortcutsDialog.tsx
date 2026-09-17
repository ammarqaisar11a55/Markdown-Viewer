import { Fragment } from 'react';
import { commands, type Command, type CommandCategory } from '@/app/commands';
import { formatShortcut } from '@/lib/shortcuts';
import { useUi } from '@/stores/uiStore';
import { Kbd } from '@/components/ui/Kbd';
import { Modal } from '@/components/ui/Modal';

const CATEGORIES: readonly CommandCategory[] = ['File', 'Tabs', 'View', 'App'];

interface Row {
  label: string;
  shortcuts: string[];
}

const DOCUMENT_ROWS: readonly Row[] = [
  { label: 'Next match', shortcuts: ['Enter', 'F3'] },
  { label: 'Previous match', shortcuts: ['Shift+Enter', 'Shift+F3'] },
  { label: 'Close find or exit reading mode', shortcuts: ['Esc'] },
];

function rowsFor(category: CommandCategory): Row[] {
  return Object.values(commands)
    .filter((command: Command) => command.category === category && command.shortcuts.length > 0)
    .map((command) => ({
      label: command.label.replace(/…$/, ''),
      shortcuts: command.shortcuts.map((s) => formatShortcut(s)),
    }));
}

const GROUP_TITLES: Record<CommandCategory, string> = {
  File: 'Files',
  Tabs: 'Tabs',
  View: 'View',
  App: 'Application',
};

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      title="Keyboard Shortcuts"
      size="lg"
    >
      <div className="grid gap-x-8 px-5 pt-2 pb-5 sm:grid-cols-2">
        {CATEGORIES.map((category) => (
          <ShortcutGroup key={category} title={GROUP_TITLES[category]} rows={rowsFor(category)} />
        ))}
        <ShortcutGroup title="In a document" rows={DOCUMENT_ROWS} />
      </div>
    </Modal>
  );
}

function ShortcutGroup({ title, rows }: { title: string; rows: readonly Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-3 break-inside-avoid">
      <h3 className="border-b border-border pb-1.5 text-ui-sm font-semibold text-fg-muted">
        {title}
      </h3>
      <dl className="mt-1">
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-8 items-center gap-3 py-1">
            <dt className="min-w-0 flex-1 text-ui text-fg">{row.label}</dt>
            <dd className="flex shrink-0 items-center gap-1.5 text-ui-xs text-fg-subtle">
              {row.shortcuts.map((shortcut, index) => (
                <Fragment key={shortcut}>
                  {index > 0 && <span>or</span>}
                  <Kbd shortcut={shortcut} />
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
