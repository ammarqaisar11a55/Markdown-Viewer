import { parseInline, parseReleaseNotes } from './releaseNotesParser';

describe('parseInline', () => {
  it('keeps plain text as one span', () => {
    expect(parseInline('Faster search.')).toEqual([
      { text: 'Faster search.', code: false, strong: false },
    ]);
  });

  it('reads inline code and bold', () => {
    expect(parseInline('Use `--flag` for **speed**')).toEqual([
      { text: 'Use ', code: false, strong: false },
      { text: '--flag', code: true, strong: false },
      { text: ' for ', code: false, strong: false },
      { text: 'speed', code: false, strong: true },
    ]);
    expect(parseInline('__also bold__')).toEqual([
      { text: 'also bold', code: false, strong: true },
    ]);
  });

  it('leaves unbalanced markers alone', () => {
    expect(parseInline('a ** b ` c')).toEqual([{ text: 'a ** b ` c', code: false, strong: false }]);
  });

  it('returns nothing for an empty line', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('parseReleaseNotes', () => {
  it('reads headings, bullet lists and paragraphs', () => {
    const blocks = parseReleaseNotes(
      ['### Added', '', '- A new `thing`', '* Another one', '', 'Plus a closing note.'].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', level: 3, spans: [{ text: 'Added', code: false, strong: false }] },
      {
        kind: 'list',
        items: [
          [
            { text: 'A new ', code: false, strong: false },
            { text: 'thing', code: true, strong: false },
          ],
          [{ text: 'Another one', code: false, strong: false }],
        ],
      },
      { kind: 'text', spans: [{ text: 'Plus a closing note.', code: false, strong: false }] },
    ]);
  });

  it('starts a new list after a heading and handles CRLF', () => {
    const blocks = parseReleaseNotes('## Fixed\r\n- One\r\n### Changed\r\n- Two\r\n');
    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'list', 'heading', 'list']);
  });

  it('treats a plain-text release body as paragraphs', () => {
    const blocks = parseReleaseNotes('Faster search.\nAnd fewer crashes.\n\nSecond paragraph.');
    expect(blocks).toEqual([
      {
        kind: 'text',
        spans: [{ text: 'Faster search. And fewer crashes.', code: false, strong: false }],
      },
      { kind: 'text', spans: [{ text: 'Second paragraph.', code: false, strong: false }] },
    ]);
  });

  it('keeps syntax it does not understand as text', () => {
    const blocks = parseReleaseNotes('> quoted\n1. numbered');
    expect(blocks).toEqual([
      { kind: 'text', spans: [{ text: '> quoted 1. numbered', code: false, strong: false }] },
    ]);
  });

  it('yields no blocks for empty or blank notes', () => {
    expect(parseReleaseNotes('')).toEqual([]);
    expect(parseReleaseNotes('   \n\n  ')).toEqual([]);
    expect(parseReleaseNotes('-   ')).toEqual([]);
  });
});
