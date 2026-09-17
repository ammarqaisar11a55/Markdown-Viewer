import { Info, TriangleAlert } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { setTabScroll } from '@/features/documents/actions';
import { useActiveHeading } from '@/hooks/useActiveHeading';
import { activateLink, buildContentMenu, selectAllContent } from '@/lib/markdown/interactions';
import { classifyLink } from '@/lib/markdown/links';
import { mountDocument } from '@/lib/markdown/mount';
import { openContextMenu } from '@/stores/contextMenuStore';
import { useSettings } from '@/stores/settingsStore';
import { registerViewer, setViewerHeadings, useViewer } from '@/stores/viewerStore';
import type { DocumentTab } from '@/types';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';

/** Documents larger than this render without syntax highlighting. */
export const PERFORMANCE_MODE_BYTES = 5 * 1024 * 1024;
const SCROLL_REPORT_MS = 200;

export interface MarkdownViewProps {
  tab: DocumentTab;
}

function RenderProgressBar() {
  const progress = useViewer((s) => s.renderProgress);
  if (progress >= 1) return null;
  return (
    <div
      className="md-render-progress"
      role="progressbar"
      aria-label="Rendering document"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div className="md-render-progress-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

function openImageFrom(img: HTMLImageElement, show: (image: LightboxImage) => void): void {
  show({ src: img.currentSrc || img.src, alt: img.getAttribute('alt') ?? '' });
}

function MarkdownViewImpl({ tab }: MarkdownViewProps) {
  const doc = tab.doc;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const loadRemoteImages = useSettings((s) => s.loadRemoteImages);
  const syntaxHighlighting = useSettings((s) => s.syntaxHighlighting);
  const contentVersion = useViewer((s) => s.contentVersion);

  // Latest values for event handlers and render effects without re-subscribing.
  const tabRef = useRef(tab);
  useLayoutEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const lastScrollTop = useRef(tab.scrollTop);
  const reportedScrollTop = useRef(tab.scrollTop);
  const suppressScrollReport = useRef(true);
  const userScrolled = useRef(false);

  const performanceMode =
    doc !== null && Math.max(doc.size, doc.html.length) > PERFORMANCE_MODE_BYTES;

  useEffect(() => {
    registerViewer(container);
    return () => registerViewer(null);
  }, [container]);

  useEffect(() => {
    setViewerHeadings(doc?.headings ?? []);
    return () => setViewerHeadings([]);
  }, [doc]);

  useActiveHeading(container, doc?.headings ?? EMPTY_HEADINGS, contentVersion);

  // Render the document. Only content-affecting inputs are dependencies: theme,
  // fonts, width and line numbers are pure CSS.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (container === null || content === null || doc === null) return undefined;

    suppressScrollReport.current = true;
    userScrolled.current = false;
    // A changed `tab.scrollTop` was set by someone else (e.g. a reload that
    // resets scroll); otherwise keep the freshest position we know.
    const requested = tabRef.current.scrollTop;
    return mountDocument({
      container,
      content,
      html: doc.html,
      context: { docPath: doc.path, loadRemoteImages },
      highlight: syntaxHighlighting && !performanceMode,
      scrollTop: requested !== reportedScrollTop.current ? requested : lastScrollTop.current,
      shouldRestoreScroll: () => !userScrolled.current,
      onComplete: () => {
        lastScrollTop.current = container.scrollTop;
        suppressScrollReport.current = false;
      },
    });
  }, [container, doc, tab.revision, loadRemoteImages, syntaxHighlighting, performanceMode]);

  // Scroll position reporting (throttled, flushed on unmount).
  useEffect(() => {
    if (container === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (reportedScrollTop.current === lastScrollTop.current) return;
      reportedScrollTop.current = lastScrollTop.current;
      setTabScroll(tabRef.current.id, lastScrollTop.current);
    };
    const onScroll = () => {
      if (suppressScrollReport.current) return;
      lastScrollTop.current = container.scrollTop;
      timer ??= setTimeout(flush, SCROLL_REPORT_MS);
    };
    const onUserScroll = () => {
      userScrolled.current = true;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onUserScroll, { passive: true });
    container.addEventListener('pointerdown', onUserScroll, { passive: true });
    container.addEventListener('keydown', onUserScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', onUserScroll);
      container.removeEventListener('pointerdown', onUserScroll);
      container.removeEventListener('keydown', onUserScroll);
      clearTimeout(timer);
      flush();
    };
  }, [container]);

  const showImage = useCallback((image: LightboxImage) => {
    setLightbox(image);
  }, []);

  // Delegated content interactions.
  useEffect(() => {
    const content = contentRef.current;
    if (container === null || content === null) return undefined;

    const onActivate = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !content.contains(event.target)) return;
      if (event.type === 'auxclick' && event.button !== 1) return;
      const anchor = event.target.closest('a');
      if (anchor !== null) {
        // Never let the webview navigate away.
        event.preventDefault();
        const href = anchor.getAttribute('href');
        if (href !== null) activateLink(classifyLink(href, tabRef.current.path));
        return;
      }
      if (event.type !== 'click') return;
      const img = event.target.closest<HTMLImageElement>('img[data-zoomable]');
      if (img !== null) openImageFrom(img, showImage);
    };

    const onMouseDown = (event: MouseEvent) => {
      // Middle-click on links would otherwise start autoscroll.
      if (
        event.button === 1 &&
        event.target instanceof Element &&
        event.target.closest('a') !== null
      ) {
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllContent(content);
        return;
      }
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        target instanceof HTMLImageElement &&
        target.dataset.zoomable !== undefined
      ) {
        event.preventDefault();
        openImageFrom(target, showImage);
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      event.preventDefault();
      const selection = container.ownerDocument.getSelection();
      const selectionText =
        selection !== null && selection.rangeCount > 0 && content.contains(selection.anchorNode)
          ? selection.toString()
          : '';
      const items = buildContentMenu({
        content,
        docPath: tabRef.current.path,
        target: event.target,
        selectionText,
        onOpenImage: (img) => openImageFrom(img, showImage),
      });
      openContextMenu(event.clientX, event.clientY, items);
    };

    container.addEventListener('click', onActivate);
    container.addEventListener('auxclick', onActivate);
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('contextmenu', onContextMenu);
    return () => {
      container.removeEventListener('click', onActivate);
      container.removeEventListener('auxclick', onActivate);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('contextmenu', onContextMenu);
    };
  }, [container, showImage]);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  if (doc === null) return null;

  return (
    <div className="md-viewer-root">
      <RenderProgressBar />
      {/* The scroll container is focusable so arrow keys, Page Up/Down, Space,
          Home and End scroll the document. */}
      <div
        ref={setContainer}
        className="md-viewer"
        role="document"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be focusable
        tabIndex={0}
        aria-label={doc.name}
      >
        <div className="md-viewer-inner">
          {doc.lossy && (
            <p className="md-banner md-banner-warning" role="note">
              <TriangleAlert aria-hidden="true" className="md-banner-icon" />
              Some characters could not be decoded and were replaced. The file may not be UTF-8
              encoded.
            </p>
          )}
          {performanceMode && (
            <p className="md-banner md-banner-info" role="note">
              <Info aria-hidden="true" className="md-banner-icon" />
              Large document — performance mode. Syntax highlighting is turned off.
            </p>
          )}
          <article ref={contentRef} className="markdown-body" />
        </div>
      </div>
      {lightbox !== null && <ImageLightbox image={lightbox} onClose={closeLightbox} />}
    </div>
  );
}

const EMPTY_HEADINGS: never[] = [];

function sameRenderInputs(prev: MarkdownViewProps, next: MarkdownViewProps): boolean {
  // Scroll position updates (which we report ourselves) must not re-render.
  const a = prev.tab;
  const b = next.tab;
  return a.id === b.id && a.doc === b.doc && a.revision === b.revision && a.path === b.path;
}

/** Renders a ready document in its own scroll container. Parent keys it by tab id. */
export const MarkdownView = memo(MarkdownViewImpl, sameRenderInputs);
