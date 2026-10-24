import { memo, useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { getShortcutLabel, runCommand } from '@/app/commands';
import { saveDocument, setDraft, stopEditing } from '@/features/documents/actions';
import { useDocuments, type DocumentsState } from '@/stores/documentsStore';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { indentEdit } from './indent';

/** Editor scroll position per tab, kept while the tab stays open. */
const scrollPositions = new Map<string, number>();

const findTab = (s: DocumentsState, id: string) => s.tabs.find((t) => t.id === id);

/** Monospace reading typography: code font size, zoom and content width. */
const TEXTAREA_STYLE: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'calc(var(--md-code-font-size, 13px) * var(--md-zoom, 1))',
  lineHeight: 1.7,
  // `--md-content-width: none` makes the calc invalid, which drops the
  // declaration — exactly the intended full-width behavior.
  maxWidth: 'calc(var(--md-content-width, 760px) * var(--md-zoom, 1))',
  tabSize: 2,
};

export interface MarkdownEditorProps {
  tabId: string;
  /** File name, used for the accessible name. */
  name: string;
}

function statusLabel(saving: boolean, dirty: boolean): string {
  if (saving) return 'Saving…';
  return dirty ? 'Unsaved changes' : 'Saved';
}

function EditorStatusLine({ tabId }: { tabId: string }) {
  const dirty = useDocuments((s) => findTab(s, tabId)?.dirty ?? false);
  const saving = useDocuments((s) => findTab(s, tabId)?.saving ?? false);
  const saveShortcut = getShortcutLabel('edit.save');

  return (
    <div className="theme-surface flex h-12 shrink-0 items-center gap-3.5 border-t border-border pr-3 pl-5 text-ui">
      <span
        role="status"
        aria-live="polite"
        className="flex min-w-0 shrink-0 items-center gap-2 text-fg"
      >
        {dirty && !saving && <span aria-hidden className="size-[7px] bg-accent" />}
        {statusLabel(saving, dirty)}
      </span>
      <p className="hidden min-w-0 flex-1 items-center gap-1.5 truncate text-ui-sm text-fg-muted sm:flex">
        {saveShortcut !== undefined && (
          <>
            <Kbd shortcut={saveShortcut} /> to save ·
          </>
        )}
        <Kbd shortcut="Esc" /> to go back to reading
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void stopEditing(tabId, { discard: true })}
          >
            Discard
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => void stopEditing(tabId)}>
          Back to Reading
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => void saveDocument(tabId)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function MarkdownEditorImpl({ tabId, name }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The text we last pushed into the store, so external updates (a reload, a
  // discarded draft) can be told apart from our own typing.
  const pushed = useRef<string | null>(null);

  const push = (text: string): void => {
    pushed.current = text;
    setDraft(tabId, text);
  };

  // Mount: adopt the draft, restore the scroll position and take focus.
  useEffect(() => {
    const el = textareaRef.current;
    if (el === null) return undefined;
    const draft = findTab(useDocuments.getState(), tabId)?.draft ?? '';
    pushed.current = draft;
    el.value = draft;
    el.scrollTop = scrollPositions.get(tabId) ?? 0;
    el.focus({ preventScroll: true });
    return () => {
      scrollPositions.set(tabId, el.scrollTop);
    };
  }, [tabId]);

  // Follow draft changes that did not come from this textarea.
  useEffect(
    () =>
      useDocuments.subscribe((state) => {
        const draft = findTab(state, tabId)?.draft;
        const el = textareaRef.current;
        if (el === null || draft === undefined || draft === null) return;
        if (draft === pushed.current) return;
        pushed.current = draft;
        el.value = draft;
      }),
    [tabId],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === 'Escape' && !mod && !event.altKey) {
      event.preventDefault();
      // Esc also closes find / reading mode; in the editor it only goes back.
      event.stopPropagation();
      void stopEditing(tabId);
      return;
    }
    if (mod && !event.altKey && event.key.toLowerCase() === 's') {
      // Handled here so the webview's "save page" default never wins.
      event.preventDefault();
      void runCommand('edit.save');
      return;
    }
    if (event.key === 'Tab' && !mod && !event.altKey) {
      const el = event.currentTarget;
      const edit = indentEdit(el.value, el.selectionStart, el.selectionEnd, event.shiftKey);
      event.preventDefault();
      if (edit === null) return;
      // `setRangeText` keeps the native undo history intact.
      el.setRangeText(edit.text, edit.from, edit.to, 'preserve');
      el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      push(el.value);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <textarea
        ref={textareaRef}
        aria-label={`Edit ${name}`}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="soft"
        style={TEXTAREA_STYLE}
        onChange={(event) => {
          push(event.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          scrollPositions.set(tabId, event.currentTarget.scrollTop);
        }}
        className="md-editor-column mx-auto block min-h-0 w-full flex-1 resize-none overflow-auto bg-transparent px-[clamp(20px,5vw,56px)] pt-[clamp(24px,5vh,56px)] pb-24 text-fg caret-accent outline-none"
      />
      <EditorStatusLine tabId={tabId} />
    </div>
  );
}

/**
 * The editor: a plain textarea styled like the reading view. Keyed by tab id
 * by the parent, so switching tabs mounts a fresh editor.
 */
export const MarkdownEditor = memo(MarkdownEditorImpl);
