import { checkForUpdates } from '@/features/updates/actions';
import { useAppVersion } from '@/features/updates/useAppVersion';
import { useUi } from '@/stores/uiStore';
import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const STACK = ['Tauri 2', 'Rust', 'React 19', 'TypeScript', 'Shiki'];

export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen);
  const setOpen = useUi((s) => s.setAboutOpen);
  const close = () => {
    setOpen(false);
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="About Markdown Viewer"
      hideTitle
      size="sm"
      footer={
        <Button variant="primary" size="sm" onClick={close}>
          Close
        </Button>
      }
    >
      <AboutContent />
    </Modal>
  );
}

function AboutContent() {
  const version = useAppVersion();

  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
      <AppMark className="size-14" />
      <p className="mt-4 font-heading text-[26px] leading-none font-semibold tracking-[0.02em] uppercase">
        Markdown Viewer
      </p>
      <p className="selectable tabular mt-1 text-ui-sm text-fg-muted">
        {version ? `Version ${version}` : 'Development build'}
      </p>
      <button
        type="button"
        className="mt-1 text-ui-sm text-link hover:text-link-hover hover:underline"
        onClick={() => void checkForUpdates({ manual: true })}
      >
        Check for updates
      </button>
      <p className="mt-4 max-w-72 text-ui text-fg-muted">
        A fast, secure, offline reader for Markdown files on Windows and Linux.
      </p>
      <ul aria-label="Built with" className="mt-4 flex flex-wrap justify-center gap-1.5">
        {STACK.map((item) => (
          <li
            key={item}
            className="border border-border bg-bg-inset px-2 py-0.5 text-ui-xs text-fg-muted"
          >
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-ui-xs text-fg-subtle">MIT License · © 2026 Muhammad Ammar Qaisar</p>
    </div>
  );
}
