import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { selectActiveTab, useDocuments } from '@/stores/documentsStore';
import type { DocumentTab } from '@/types';

/**
 * The active tab, but without re-rendering on scroll-position updates.
 * `scrollTop` reflects the store value at the time any other field changed
 * (e.g. a reload), which is exactly when the viewer needs to restore it.
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
      };
    }),
  );
  return useMemo(() => {
    if (!fields) return null;
    const current = selectActiveTab(useDocuments.getState());
    return { ...fields, scrollTop: current?.id === fields.id ? current.scrollTop : 0 };
  }, [fields]);
}
