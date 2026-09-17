import { MarkdownView } from '@/components/markdown/MarkdownView';
import { SearchBar } from '@/components/search/SearchBar';
import { useDocuments } from '@/stores/documentsStore';
import { DocumentErrorPanel } from './DocumentErrorPanel';
import { EmptyState } from './EmptyState';
import { DOCUMENT_PANEL_ID } from './ids';
import { ExternalChangeBanner } from './ExternalChangeBanner';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useStableActiveTab } from './useStableActiveTab';

export function MainArea() {
  const hasTabs = useDocuments((s) => s.tabs.length > 0);
  const tab = useStableActiveTab();

  if (!hasTabs || !tab) {
    return (
      <main className="relative min-h-0 flex-1 bg-bg">
        <EmptyState />
      </main>
    );
  }

  return (
    <main
      id={DOCUMENT_PANEL_ID}
      role="tabpanel"
      aria-labelledby={`tab-${tab.id}`}
      className="relative flex min-h-0 flex-1 flex-col bg-bg"
    >
      {tab.externalChange && <ExternalChangeBanner tabId={tab.id} kind={tab.externalChange} />}
      <div className="relative min-h-0 flex-1">
        {tab.status === 'loading' && !tab.doc && <LoadingSkeleton />}
        {tab.status === 'error' && (
          <DocumentErrorPanel tabId={tab.id} path={tab.path} error={tab.error} />
        )}
        {tab.status !== 'error' && tab.doc && (
          <>
            <MarkdownView key={tab.id} tab={tab} />
            <SearchBar />
          </>
        )}
      </div>
    </main>
  );
}
