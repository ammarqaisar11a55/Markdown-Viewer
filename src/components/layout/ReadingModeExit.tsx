import { Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useContextMenu } from '@/stores/contextMenuStore';
import { useUi } from '@/stores/uiStore';
import { Kbd } from '@/components/ui/Kbd';

const HIDE_AFTER_MS = 2000;

function anyOverlayOpen(): boolean {
  const ui = useUi.getState();
  return (
    ui.searchOpen ||
    ui.quickOpenOpen ||
    ui.settingsOpen ||
    ui.shortcutsOpen ||
    ui.aboutOpen ||
    useContextMenu.getState().open
  );
}

/** Floating "Exit Reading Mode" pill; appears on pointer movement or focus. Esc exits. */
export function ReadingModeExit() {
  const setReadingMode = useUi((s) => s.setReadingMode);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, HIDE_AFTER_MS);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || anyOverlayOpen()) return;
      event.preventDefault();
      setReadingMode(false);
    };
    reveal();
    window.addEventListener('pointermove', reveal, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setReadingMode]);

  return (
    <div className="reading-exit fixed top-3 right-4 z-40" data-visible={visible}>
      <button
        type="button"
        onClick={() => {
          setReadingMode(false);
        }}
        className="border-border bg-bg-elevated/95 text-ui-sm text-fg hover:bg-bg-muted flex h-8 items-center gap-2 rounded-full border pr-1.5 pl-3 font-medium shadow-(--shadow-popover) backdrop-blur transition-colors duration-100"
      >
        <Minimize2 aria-hidden className="text-fg-muted size-3.5" />
        Exit Reading Mode
        <Kbd shortcut="Esc" />
      </button>
    </div>
  );
}
