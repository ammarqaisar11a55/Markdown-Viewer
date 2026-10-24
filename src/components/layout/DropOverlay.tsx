import { FileDown } from 'lucide-react';
import { useUi } from '@/stores/uiStore';

export function DropOverlay() {
  const active = useUi((s) => s.dragActive);
  if (!active) return null;
  return (
    <div
      aria-hidden
      className="animate-fade-in pointer-events-none fixed inset-0 z-[70] flex bg-bg/85 p-4 backdrop-blur-[2px]"
    >
      <div className="mv-marks flex flex-1 flex-col items-center justify-center border border-dashed border-accent bg-accent-subtle/40">
        <FileDown className="size-8 text-accent" />
        <p className="mt-4 font-heading text-[28px] leading-none uppercase">Drop to open</p>
        <p className="mt-2 text-ui text-fg-muted">Markdown files and folders</p>
      </div>
    </div>
  );
}
