import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import type { DocumentTab } from '@/types';

/**
 * The active tab, but without re-rendering on scroll-position or draft
 * updates. `scrollTop`, `draft` and `savedText` reflect the store value at the
 * time any other field changed (e.g. a reload), which is exactly when the
 * viewer needs to restore them; the editor reads the draft from the store.
 */
export function useStableActiveTab(): DocumentTab | null {
  const fields = useDocuments(
    useShallow((s) => {
      const tab = selectActiveTab(s);
      if (!tab) return null;
      return {
        id: tab.id,
        path: tab.path,
        name: tab.name,
        status: tab.status,
        doc: tab.doc,
        error: tab.error,
        externalChange: tab.externalChange,
        revision: tab.revision,
        editing: tab.editing,
        dirty: tab.dirty,
        saving: tab.saving,
      };
    }),
  );
  return useMemo(() => {
    if (!fields) return null;
    const current = selectActiveTab(useDocuments.getState());
    const same = current !== null && current.id === fields.id;
    return {
      ...fields,
      scrollTop: same ? current.scrollTop : 0,
      draft: same ? current.draft : null,
      savedText: same ? current.savedText : null,
    };
  }, [fields]);
}
