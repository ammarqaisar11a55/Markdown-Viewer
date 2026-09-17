import { fuzzyFilter, fuzzyScore } from './fuzzy';

describe('fuzzyScore', () => {
  it('returns null when a term does not match', () => {
    expect(fuzzyScore('xyz', 'README.md')).toBeNull();
    expect(fuzzyScore('read zz', 'README.md')).toBeNull();
  });

  it('matches case-insensitively and reports indices', () => {
    const match = fuzzyScore('rdm', 'README.md');
    expect(match).not.toBeNull();
    expect(match?.indices).toEqual([0, 3, 7]);
  });

  it('prefers consecutive and boundary matches', () => {
    const consecutive = fuzzyScore('api', 'docs/api.md');
    const scattered = fuzzyScore('api', 'docs/a-plain-index.md');
    expect(consecutive!.score).toBeGreaterThan(scattered!.score);
  });

  it('prefers basename matches over directory matches', () => {
    const inName = fuzzyScore('guide', 'x/guide.md');
    const inDir = fuzzyScore('guide', 'guide/x.md');
    expect(inName!.score).toBeGreaterThan(inDir!.score);
  });

  it('merges indices of all terms', () => {
    expect(fuzzyScore('arch md', 'Architecture.md')?.indices).toEqual([0, 1, 2, 3, 13, 14]);
  });
});

describe('fuzzyFilter', () => {
  const files = ['docs/march-notes.md', 'CHANGELOG.md', 'Architecture.md', 'docs/architecture.md'];

  it('ranks "arch md" with Architecture.md before march-notes', () => {
    const results = fuzzyFilter('arch md', files, (f) => f).map((r) => r.item);
    expect(results.indexOf('Architecture.md')).toBeLessThan(results.indexOf('docs/march-notes.md'));
    expect(results.indexOf('docs/architecture.md')).toBeLessThan(
      results.indexOf('docs/march-notes.md'),
    );
    expect(results).not.toContain('CHANGELOG.md');
  });

  it('returns items in order for an empty query, honoring the limit', () => {
    expect(fuzzyFilter('  ', files, (f) => f, 2)).toEqual([
      { item: files[0], score: 0, indices: [] },
      { item: files[1], score: 0, indices: [] },
    ]);
  });

  it('applies the limit and keeps equal scores stable', () => {
    const results = fuzzyFilter('md', ['b/x.md', 'a/x.md', 'c/x.md'], (f) => f, 2);
    expect(results.map((r) => r.item)).toEqual(['b/x.md', 'a/x.md']);
  });
});
