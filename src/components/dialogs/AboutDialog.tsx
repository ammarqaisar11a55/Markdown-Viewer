import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';
import { isTauri } from '@/lib/platform/ipc';
import { logger } from '@/lib/platform/logger';
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
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getVersion().then(
      (value) => {
        if (!cancelled) setVersion(value);
      },
      (err: unknown) => {
        logger.warn('Could not read the app version', err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
      <AppMark className="size-14" />
      <p className="mt-4 font-serif text-[22px] leading-7 font-semibold tracking-[-0.01em]">
        Markdown Viewer
      </p>
      <p className="selectable text-ui-sm text-fg-muted tabular mt-1">
        {version ? `Version ${version}` : 'Development build'}
      </p>
      <p className="text-ui text-fg-muted mt-4 max-w-72">
        A fast, secure, offline reader for Markdown files on Windows and Linux.
      </p>
      <ul aria-label="Built with" className="mt-4 flex flex-wrap justify-center gap-1.5">
        {STACK.map((item) => (
          <li
            key={item}
            className="border-border bg-bg-inset text-ui-xs text-fg-muted rounded-sm border px-1.5 py-0.5"
          >
            {item}
          </li>
        ))}
      </ul>
      <p className="text-ui-xs text-fg-subtle mt-5">MIT License · © 2026 Muhammad Ammar Qaisar</p>
    </div>
  );
}
