// Side effects of settings changes.
import { useSettings } from '@/stores/settingsStore';
import { rerenderAllDocuments } from '../documents/actions';
import { refreshFolder } from '../folder/actions';
import { clearRecent } from '../recent/actions';

export function startSettingsEffects(): () => void {
  return useSettings.subscribe((state, prev) => {
    if (state.renderHtml !== prev.renderHtml) void rerenderAllDocuments();
    if (state.showAllFiles !== prev.showAllFiles) void refreshFolder();
    if (!state.rememberRecent && prev.rememberRecent) clearRecent();
  });
}
