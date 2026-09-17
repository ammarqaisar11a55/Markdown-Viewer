import { FileDown } from 'lucide-react';
import { useUi } from '@/stores/uiStore';

export function DropOverlay() {
  const active = useUi((s) => s.dragActive);
  if (!active) return null;
  return (
    <div
      aria-hidden
      className="animate-fade-in pointer-events-none fixed inset-0 z-[70] flex bg-bg/80 p-3 backdrop-blur-[2px]"
    >
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-accent/60 bg-accent-subtle/40">
        <FileDown className="size-8 text-accent" />
        <p className="mt-3 text-ui-lg font-semibold text-fg">Drop to open</p>
        <p className="mt-0.5 text-ui text-fg-muted">Markdown files and folders</p>
      </div>
    </div>
  );
}
