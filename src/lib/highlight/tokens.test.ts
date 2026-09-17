import { createHighlighterCore } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import { describe, expect, it } from 'vitest';
import { GRAMMARS } from './grammars';
import { languageLabel, resolveLanguage, SUPPORTED_LANGUAGES } from './languages';
import { compactTokens, parseDeclarations } from './tokens';

describe('languages', () => {
  it('resolves aliases case-insensitively', () => {
    expect(resolveLanguage('TS')).toBe('typescript');
    expect(resolveLanguage('bash')).toBe('shellscript');
    expect(resolveLanguage('c++')).toBe('cpp');
    expect(resolveLanguage('Dockerfile')).toBe('docker');
    expect(resolveLanguage('klingon')).toBeNull();
    expect(resolveLanguage('')).toBeNull();
  });

  it('labels languages', () => {
    expect(languageLabel('js')).toBe('JavaScript');
    expect(languageLabel('bash')).toBe('Bash');
    expect(languageLabel('text')).toBe('Text');
    expect(languageLabel('mermaid')).toBe('mermaid');
    expect(languageLabel(null)).toBeNull();
  });

  it('has a grammar loader for every supported language', () => {
    expect(Object.keys(GRAMMARS).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});

describe('compactTokens', () => {
  it('parses declaration lists', () => {
    expect(parseDeclarations('--a:#fff; --b:#000;bad')).toEqual({ '--a': '#fff', '--b': '#000' });
  });

  it('produces dual-theme tokens from Shiki', async () => {
    const highlighter = await createHighlighterCore({
      engine: createJavaScriptRegexEngine({ forgiving: true }),
      themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
      langs: [GRAMMARS.typescript()],
    });
    const result = compactTokens(
      highlighter.codeToTokens('const x = 1; // hi\n\nfoo()', {
        lang: 'typescript',
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      }),
    );
    highlighter.dispose();

    expect(result.base).toEqual({ '--shiki-light': '#24292e', '--shiki-dark': '#e1e4e8' });
    expect(result.lines).toHaveLength(3);
    expect(result.lines[1]).toEqual([]);
    expect(result.lines.map((line) => line.map(([text]) => text).join(''))).toEqual([
      'const x = 1; // hi',
      '',
      'foo()',
    ]);
    const keyword = result.lines[0]![0]!;
    expect(keyword[0]).toBe('const ');
    expect(result.styles[keyword[1]]).toEqual({
      '--shiki-light': '#D73A49',
      '--shiki-dark': '#F97583',
    });
    for (const style of result.styles) {
      expect(Object.keys(style).every((key) => key.startsWith('--shiki-'))).toBe(true);
    }
  });
});
