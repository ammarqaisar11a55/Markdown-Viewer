import { clsx } from 'clsx';
import { Moon, PanelLeftClose, Settings, Sun } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { useResolvedTheme } from '@/hooks/useThemeEffect';
import { useUi } from '@/stores/uiStore';
import { AppMark } from '@/components/ui/AppMark';
import { Tooltip } from '@/components/ui/Tooltip';
import { SIDEBAR_VIEWS } from './sidebarViews';

/**
 * The 60px icon rail: the app mark, the view switch (icon over a condensed
 * label) and the app-level buttons at the foot. It stays visible while the
 * panel beside it is collapsed.
 */
export function SidebarRail() {
  const view = useUi((s) => s.sidebarView);
  const setSidebarView = useUi((s) => s.setSidebarView);
  const theme = useResolvedTheme();
  const groupRef = useRef<HTMLDivElement>(null);

  // Arrow keys (either axis), Home and End move through the views.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = SIDEBAR_VIEWS.findIndex((v) => v.value === view);
    let next: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SIDEBAR_VIEWS.length - 1;
    else return;
    event.preventDefault();
    const wrapped = (next + SIDEBAR_VIEWS.length) % SIDEBAR_VIEWS.length;
    const target = SIDEBAR_VIEWS[wrapped];
    if (!target) return;
    setSidebarView(target.value);
    groupRef.current?.querySelectorAll<HTMLElement>('button[aria-pressed]')[wrapped]?.focus();
  };

  return (
    <nav
      aria-label="Views"
      className="theme-surface flex w-[60px] shrink-0 flex-col items-center border-r border-border bg-bg pt-[10px] pb-2"
    >
      <Tooltip label="About Markdown Viewer" side="right">
        <button
          type="button"
          aria-label="About Markdown Viewer"
          onClick={() => void runCommand('app.about')}
          className="flex"
        >
          <AppMark className="size-7" />
        </button>
      </Tooltip>

      <div
        ref={groupRef}
        role="group"
        aria-label="Sidebar views"
        className="mt-[18px] flex flex-col gap-1"
      >
        {SIDEBAR_VIEWS.map(({ value, label, icon: Icon }) => {
          const active = value === view;
          return (
            <Tooltip key={value} label={label} side="right">
              <button
                type="button"
                aria-pressed={active}
                onKeyDown={onKeyDown}
                onClick={() => {
                  setSidebarView(value);
                }}
                className={clsx(
                  'relative flex h-[50px] w-[48px] flex-col items-center justify-center gap-1',
                  'transition-colors duration-100',
                  active
                    ? 'bg-accent-subtle text-accent'
                    : 'text-fg-muted hover:bg-bg-muted hover:text-fg',
                )}
              >
                {/* The design marks the live view with a 2px rule on the rail's edge. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-2 bottom-2 -left-1.5 w-[2px] bg-accent"
                  />
                )}
                <Icon aria-hidden className="size-[19px] shrink-0" />
                <span className="font-heading text-[10px] leading-none font-semibold tracking-[0.12em] uppercase">
                  {label}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-1">
        <RailButton
          label="Hide sidebar"
          shortcut={getShortcutLabel('view.toggleSidebar')}
          icon={<PanelLeftClose />}
          onClick={() => void runCommand('view.toggleSidebar')}
        />
        <RailButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          shortcut={getShortcutLabel('view.toggleTheme')}
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          onClick={() => void runCommand('view.toggleTheme')}
        />
        <RailButton
          label="Settings"
          shortcut={getShortcutLabel('app.settings')}
          icon={<Settings />}
          onClick={() => void runCommand('app.settings')}
        />
      </div>
    </nav>
  );
}

/** A 48x40 icon button in the rail's foot. */
function RailButton({
  label,
  shortcut,
  icon,
  onClick,
}: {
  label: string;
  shortcut?: string | undefined;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="right">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={clsx(
          'flex h-[40px] w-[48px] items-center justify-center text-fg-muted',
          'transition-colors duration-100 hover:bg-bg-muted hover:text-fg [&_svg]:size-[18px]',
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
