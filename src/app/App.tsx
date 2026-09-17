import { AboutDialog } from '@/components/dialogs/AboutDialog';
import { ShortcutsDialog } from '@/components/dialogs/ShortcutsDialog';
import { AppShell } from '@/components/layout/AppShell';
import { QuickOpenDialog } from '@/components/quick-open/QuickOpenDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { Toaster } from '@/components/ui/Toaster';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useThemeEffect } from '@/hooks/useThemeEffect';

export function App() {
  useGlobalShortcuts();
  useThemeEffect();

  return (
    <>
      <AppShell />
      <QuickOpenDialog />
      <SettingsDialog />
      <ShortcutsDialog />
      <AboutDialog />
      <ContextMenu />
      <Toaster />
    </>
  );
}
