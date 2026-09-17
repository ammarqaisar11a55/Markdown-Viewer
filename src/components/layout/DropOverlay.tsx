import { FileDown } from 'lucide-react';
import { useUi } from '@/stores/uiStore';

export function DropOverlay() {
  const active = useUi((s) => s.dragActive);
  if (!active) return null;
  return (
    <div
      aria-hidden
      className="animate-fade-in bg-bg/80 pointer-events-none fixed inset-0 z-[70] flex p-3 backdrop-blur-[2px]"
    >
      <div className="border-accent/60 bg-accent-subtle/40 flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed">
        <FileDown className="text-accent size-8" />
        <p className="text-ui-lg text-fg mt-3 font-semibold">Drop to open</p>
        <p className="text-ui text-fg-muted mt-0.5">Markdown files and folders</p>
      </div>
    </div>
  );
}
