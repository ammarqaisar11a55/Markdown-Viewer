/*
 * A deliberately small Markdown subset for release notes.
 *
 * The text comes from the update server, so it is never handed to an HTML
 * renderer: it is parsed into plain data here and drawn with React elements.
 * Only what a CHANGELOG section uses is understood — headings, bullet lists,
 * `inline code` and bold. Everything else stays literal text.
 */

export interface NoteSpan {
  text: string;
  code: boolean;
  strong: boolean;
}

export type NoteBlock =
  | { kind: 'heading'; level: number; spans: NoteSpan[] }
  | { kind: 'list'; items: NoteSpan[][] }
  | { kind: 'text'; spans: NoteSpan[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^ {0,3}[-*+] +(.*)$/;
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__/g;

/** Splits one line into plain, code and bold runs. */
export function parseInline(line: string): NoteSpan[] {
  const spans: NoteSpan[] = [];
  const plain = (text: string) => {
    if (text !== '') spans.push({ text, code: false, strong: false });
  };
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, code, boldStars, boldUnderscores] = match;
    plain(line.slice(last, match.index));
    if (code === undefined) {
      spans.push({ text: boldStars ?? boldUnderscores ?? '', code: false, strong: true });
    } else {
      spans.push({ text: code, code: true, strong: false });
    }
    last = match.index + whole.length;
  }
  plain(line.slice(last));
  return spans;
}

/**
 * Parses release notes into blocks. Unknown syntax is kept as the text it was
 * written as, and empty input yields no blocks at all.
 */
export function parseReleaseNotes(input: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const spans = parseInline(paragraph.join(' '));
    paragraph = [];
    if (spans.length > 0) blocks.push({ kind: 'text', spans });
  };
  const flushList = () => {
    if (items.length === 0) return;
    const parsed = items.map((item) => parseInline(item)).filter((spans) => spans.length > 0);
    items = [];
    if (parsed.length > 0) blocks.push({ kind: 'list', items: parsed });
  };

  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const spans = parseInline((heading[2] ?? '').trim());
      if (spans.length > 0)
        blocks.push({ kind: 'heading', level: (heading[1] ?? '#').length, spans });
      continue;
    }
    const bullet = BULLET.exec(raw);
    if (bullet) {
      flushParagraph();
      items.push((bullet[1] ?? '').trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
