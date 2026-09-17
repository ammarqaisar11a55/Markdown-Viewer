import { Monitor, Moon, Sun } from 'lucide-react';
import {
  CODE_FONT_SIZE_RANGE,
  FONT_SIZE_RANGE,
  resetSettings,
  updateSettings,
  useSettings,
} from '@/stores/settingsStore';
import { useUi } from '@/stores/uiStore';
import type { ContentWidth, ExternalLinkBehavior, ReadingFont, ThemePreference } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { BooleanSetting } from './BooleanSetting';
import { SettingRow, SettingSection } from './SettingRow';

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
      description="Changes are saved automatically."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
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
      <SettingsContent />
    </Modal>
  );
}

function SettingsContent() {
  const theme = useSettings((s) => s.theme);
  const fontSize = useSettings((s) => s.fontSize);
  const contentWidth = useSettings((s) => s.contentWidth);
  const codeFontSize = useSettings((s) => s.codeFontSize);
  const readingFont = useSettings((s) => s.readingFont);
  const externalLinks = useSettings((s) => s.externalLinks);

  return (
    <div className="pb-3">
      <SettingSection title="Appearance">
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
      </SettingSection>

      <SettingSection title="Behavior">
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
      </SettingSection>

      <SettingSection title="Markdown">
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
      </SettingSection>
    </div>
  );
}
