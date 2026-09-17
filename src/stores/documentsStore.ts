// Open documents. Mutations live in `src/features/documents/actions.ts`.
import { create } from 'zustand';
import type { DocumentTab } from '@/types';

export const MAX_CLOSED_PATHS = 20;

export interface DocumentsState {
  tabs: DocumentTab[];
  activeId: string | null;
  /** Stack of recently closed paths (last = most recent). */
  closedPaths: string[];
}

export const useDocuments = create<DocumentsState>()(() => ({
  tabs: [],
  activeId: null,
  closedPaths: [],
}));

export function selectActiveTab(state: DocumentsState): DocumentTab | null {
  if (state.activeId === null) return null;
  return state.tabs.find((tab) => tab.id === state.activeId) ?? null;
}

export function useActiveTab(): DocumentTab | null {
  return useDocuments(selectActiveTab);
}

export function getActiveTab(): DocumentTab | null {
  return selectActiveTab(useDocuments.getState());
}
