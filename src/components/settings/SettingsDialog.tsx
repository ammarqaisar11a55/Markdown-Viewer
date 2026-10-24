import { Keyboard, Monitor, Moon, Sun } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import {
  CODE_FONT_SIZE_RANGE,
  FONT_SIZE_RANGE,
  resetSettings,
  updateSettings,
  useSettings,
} from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import { useUpdates } from '@/stores/updatesStore';
import type { ContentWidth, ExternalLinkBehavior, ReadingFont, ThemePreference } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { BooleanSetting } from './BooleanSetting';
import { SettingRow } from './SettingRow';
import { SettingsNav } from './SettingsNav';
import { UpdatesSection } from './UpdatesSection';

const THEMES: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'System', icon: <Monitor aria-hidden /> },
  { value: 'light', label: 'Light', icon: <Sun aria-hidden /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden /> },
];

const WIDTHS: readonly SegmentedOption<ContentWidth>[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
];

const FONTS: readonly SegmentedOption<ReadingFont>[] = [
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
];

const LINKS: readonly SegmentedOption<ExternalLinkBehavior>[] = [
  { value: 'open', label: 'Open directly' },
  { value: 'ask', label: 'Ask first' },
];

const px = (value: number) => `${value} px`;

interface Section {
  id: string;
  title: string;
  Rows: () => ReactNode;
}

const SECTIONS = [
  { id: 'appearance', title: 'Appearance', Rows: AppearanceRows },
  { id: 'behavior', title: 'Behavior', Rows: BehaviorRows },
  { id: 'markdown', title: 'Markdown', Rows: MarkdownRows },
  { id: 'updates', title: 'Updates', Rows: UpdatesSection },
] as const satisfies readonly Section[];

const FIRST_SECTION = SECTIONS[0];
const UPDATES_SECTION_ID = 'updates';

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const close = () => {
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Settings"
      titleSize="lg"
      description="Changes are saved automatically."
      size="lg"
      className="h-[min(620px,88vh)] max-w-[800px]!"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            icon={<Keyboard aria-hidden />}
            onClick={() => {
              setOpen(false);
              useUi.getState().setShortcutsOpen(true);
            }}
          >
            Keyboard Shortcuts
          </Button>
          <Button variant="secondary" size="sm" onClick={resetSettings}>
            Reset to Defaults
          </Button>
          <Button variant="primary" size="sm" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <SettingsPanes />
    </Modal>
  );
}

/** The two panes: the numbered section nav, and the active section's rows. */
function SettingsPanes() {
  const baseId = useId();
  // An update on offer is why the dialog was most likely opened — the toast
  // sends the user here to read what changed — so it opens on that section.
  const [active, setActive] = useState<string>(() =>
    useUpdates.getState().status === 'available' ? UPDATES_SECTION_ID : FIRST_SECTION.id,
  );
  const section = SECTIONS.find((candidate) => candidate.id === active) ?? FIRST_SECTION;
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-pane`;

  return (
    <div className="flex h-full min-h-0">
      <SettingsNav
        sections={SECTIONS}
        active={section.id}
        onSelect={setActive}
        tabId={tabId}
        panelId={panelId}
      />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(section.id)}
        tabIndex={0}
        className="focus-inset min-w-0 flex-1 overflow-y-auto px-7 pt-4.5 pb-6"
      >
        <h3 className="mv-label pb-1 text-ui-sm text-fg-muted">{section.title}</h3>
        <section.Rows />
      </div>
    </div>
  );
}

function AppearanceRows() {
  const theme = useSettings((s) => s.theme);
  const fontSize = useSettings((s) => s.fontSize);
  const contentWidth = useSettings((s) => s.contentWidth);
  const codeFontSize = useSettings((s) => s.codeFontSize);
  const readingFont = useSettings((s) => s.readingFont);

  return (
    <>
      <SettingRow label="Theme">
        {({ labelId }) => (
          <SegmentedControl
            value={theme}
            options={THEMES}
            labelledBy={labelId}
            onChange={(value) => {
              updateSettings({ theme: value });
            }}
          />
        )}
      </SettingRow>
      <SettingRow label="Font size" description="Base size of document text.">
        {({ labelId }) => (
          <Slider
            value={fontSize}
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            step={FONT_SIZE_RANGE.step}
            labelledBy={labelId}
            format={px}
            onChange={(value) => {
              updateSettings({ fontSize: value });
            }}
          />
        )}
      </SettingRow>
      <SettingRow label="Content width" description="Maximum width of the text column.">
        {({ labelId }) => (
          <SegmentedControl
            value={contentWidth}
            options={WIDTHS}
            labelledBy={labelId}
            onChange={(value) => {
              updateSettings({ contentWidth: value });
            }}
          />
        )}
      </SettingRow>
      <SettingRow label="Code font size">
        {({ labelId }) => (
          <Slider
            value={codeFontSize}
            min={CODE_FONT_SIZE_RANGE.min}
            max={CODE_FONT_SIZE_RANGE.max}
            step={CODE_FONT_SIZE_RANGE.step}
            labelledBy={labelId}
            format={px}
            onChange={(value) => {
              updateSettings({ codeFontSize: value });
            }}
          />
        )}
      </SettingRow>
      <SettingRow label="Reading font">
        {({ labelId }) => (
          <SegmentedControl
            value={readingFont}
            options={FONTS}
            labelledBy={labelId}
            onChange={(value) => {
              updateSettings({ readingFont: value });
            }}
          />
        )}
      </SettingRow>
    </>
  );
}

function BehaviorRows() {
  return (
    <>
      <BooleanSetting
        setting="restoreSession"
        label="Restore previous session"
        description="Reopen the tabs and folder from last time."
      />
      <BooleanSetting
        setting="openInNewTab"
        label="Open files in new tabs"
        description="When off, opening a file replaces the current tab."
      />
      <BooleanSetting
        setting="autoReload"
        label="Automatically reload changed files"
        description="When off, you are asked before reloading."
      />
      <BooleanSetting
        setting="rememberRecent"
        label="Remember recent files"
        description="Turning this off clears the list."
      />
      <BooleanSetting
        setting="showAllFiles"
        label="Show all files in folders"
        description="Non-Markdown files are listed but cannot be opened."
      />
    </>
  );
}

function MarkdownRows() {
  const externalLinks = useSettings((s) => s.externalLinks);

  return (
    <>
      <BooleanSetting setting="syntaxHighlighting" label="Syntax highlighting" />
      <BooleanSetting setting="lineNumbers" label="Line numbers in code blocks" />
      <BooleanSetting
        setting="renderHtml"
        label="Render raw HTML"
        description="Safe HTML only; scripts and styles are always removed."
      />
      <BooleanSetting
        setting="loadRemoteImages"
        label="Load remote images"
        description="Fetch images from https:// addresses."
      />
      <SettingRow label="External links" description="How links to websites are opened.">
        {({ labelId }) => (
          <SegmentedControl
            value={externalLinks}
            options={LINKS}
            labelledBy={labelId}
            onChange={(value) => {
              updateSettings({ externalLinks: value });
            }}
          />
        )}
      </SettingRow>
    </>
  );
}
