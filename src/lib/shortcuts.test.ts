import { formatShortcut, matchesShortcut, parseShortcut, type KeyEventLike } from './shortcuts';

function key(init: Partial<KeyEventLike> & { key: string }): KeyEventLike {
  return { code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init };
}

describe('parseShortcut', () => {
  it('parses modifiers and keys', () => {
    expect(parseShortcut('Mod+Shift+O')).toEqual({ key: 'o', mod: true, shift: true, alt: false });
    expect(parseShortcut('F5')).toEqual({ key: 'F5', mod: false, shift: false, alt: false });
    expect(parseShortcut('Mod+PageDown').key).toBe('PageDown');
    expect(parseShortcut('Alt+Tab')).toMatchObject({ key: 'Tab', alt: true });
  });

  it('parses the plus key', () => {
    expect(parseShortcut('Mod++')).toEqual({ key: '+', mod: true, shift: false, alt: false });
    expect(parseShortcut('Mod+-').key).toBe('-');
    expect(parseShortcut('Mod+=').key).toBe('=');
  });

  it('rejects unknown modifiers', () => {
    expect(() => parseShortcut('Hyper+K')).toThrow();
  });
});

describe('matchesShortcut', () => {
  const modO = parseShortcut('Mod+O');

  it('uses Ctrl on Windows/Linux and Cmd on mac', () => {
    expect(matchesShortcut(key({ key: 'o', ctrlKey: true }), modO, 'linux')).toBe(true);
    expect(matchesShortcut(key({ key: 'o', metaKey: true }), modO, 'linux')).toBe(false);
    expect(matchesShortcut(key({ key: 'o', metaKey: true }), modO, 'mac')).toBe(true);
    expect(matchesShortcut(key({ key: 'o', ctrlKey: true }), modO, 'mac')).toBe(false);
  });

  it('requires exact Shift/Alt for letters', () => {
    const shifted = parseShortcut('Mod+Shift+O');
    expect(
      matchesShortcut(key({ key: 'O', ctrlKey: true, shiftKey: true }), shifted, 'linux'),
    ).toBe(true);
    expect(matchesShortcut(key({ key: 'O', ctrlKey: true, shiftKey: true }), modO, 'linux')).toBe(
      false,
    );
    expect(matchesShortcut(key({ key: 'o', ctrlKey: true, altKey: true }), modO, 'linux')).toBe(
      false,
    );
  });

  it('ignores Shift for punctuation such as + and =', () => {
    const plus = parseShortcut('Mod++');
    const equals = parseShortcut('Mod+=');
    expect(matchesShortcut(key({ key: '+', ctrlKey: true, shiftKey: true }), plus, 'linux')).toBe(
      true,
    );
    expect(matchesShortcut(key({ key: '+', ctrlKey: true }), plus, 'linux')).toBe(true);
    expect(matchesShortcut(key({ key: '=', ctrlKey: true, shiftKey: true }), equals, 'linux')).toBe(
      true,
    );
  });

  it('falls back to event.code on non-Latin layouts only', () => {
    expect(matchesShortcut(key({ key: 'щ', code: 'KeyO', ctrlKey: true }), modO, 'linux')).toBe(
      true,
    );
    // AZERTY: the physical Q key produces "a" — must not trigger Mod+Q.
    const quit = parseShortcut('Mod+Q');
    expect(matchesShortcut(key({ key: 'a', code: 'KeyQ', ctrlKey: true }), quit, 'linux')).toBe(
      false,
    );
    const zero = parseShortcut('Mod+0');
    expect(matchesShortcut(key({ key: 'à', code: 'Digit0', ctrlKey: true }), zero, 'linux')).toBe(
      true,
    );
  });

  it('matches function and named keys', () => {
    expect(matchesShortcut(key({ key: 'F5' }), parseShortcut('F5'), 'linux')).toBe(true);
    expect(
      matchesShortcut(
        key({ key: 'Tab', ctrlKey: true, shiftKey: true }),
        parseShortcut('Mod+Shift+Tab'),
        'windows',
      ),
    ).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('formats for Windows/Linux', () => {
    expect(formatShortcut('Mod+Shift+O', 'windows')).toBe('Ctrl+Shift+O');
    expect(formatShortcut('Mod++', 'linux')).toBe('Ctrl+Plus');
    expect(formatShortcut('F11', 'linux')).toBe('F11');
    expect(formatShortcut(parseShortcut('Mod+,'), 'linux')).toBe('Ctrl+,');
  });

  it('formats with symbols on mac', () => {
    expect(formatShortcut('Mod+Shift+O', 'mac')).toBe('⇧⌘O');
    expect(formatShortcut('Mod+Tab', 'mac')).toBe('⌘⇥');
  });
});
