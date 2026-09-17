import {
  basename,
  dirname,
  displayPath,
  isAbsolutePath,
  isMarkdownPath,
  joinPath,
  normalizePath,
  relativePath,
  resolveRelative,
  samePath,
  setHomeDir,
  splitHash,
} from './paths';

afterEach(() => {
  setHomeDir(null);
});

describe('normalizePath', () => {
  it.each([
    ['/a/b/../c/./d.md', '/a/c/d.md'],
    ['/a//b///c', '/a/b/c'],
    ['/a/b/', '/a/b'],
    ['/../x', '/x'],
    ['/', '/'],
    ['a/../../b', '../b'],
    ['C:\\Users\\me\\..\\docs\\.\\a.md', 'C:\\Users\\docs\\a.md'],
    ['c:/Users/me/a.md', 'C:\\Users\\me\\a.md'],
    ['C:\\', 'C:\\'],
    ['\\\\server\\share\\dir\\..\\a.md', '\\\\server\\share\\a.md'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe('basename / dirname / joinPath', () => {
  it('handles POSIX paths', () => {
    expect(basename('/home/me/README.md')).toBe('README.md');
    expect(dirname('/home/me/README.md')).toBe('/home/me');
    expect(dirname('/README.md')).toBe('/');
    expect(joinPath('/home/me', 'docs', '../api.md')).toBe('/home/me/api.md');
  });

  it('handles Windows paths', () => {
    expect(basename('C:\\docs\\api.md')).toBe('api.md');
    expect(basename('C:\\docs\\')).toBe('docs');
    expect(dirname('C:\\docs\\api.md')).toBe('C:\\docs');
    expect(dirname('C:\\api.md')).toBe('C:\\');
    expect(joinPath('C:\\docs', 'img/logo.png')).toBe('C:\\docs\\img\\logo.png');
  });
});

describe('isAbsolutePath / isMarkdownPath / samePath', () => {
  it('detects absolute paths', () => {
    expect(isAbsolutePath('/x')).toBe(true);
    expect(isAbsolutePath('C:\\x')).toBe(true);
    expect(isAbsolutePath('\\\\srv\\share')).toBe(true);
    expect(isAbsolutePath('docs/x.md')).toBe(false);
  });

  it('recognizes markdown extensions case-insensitively', () => {
    for (const name of ['a.md', 'b.MARKDOWN', 'c.mdown', 'd.Mkd']) {
      expect(isMarkdownPath(name)).toBe(true);
    }
    expect(isMarkdownPath('notes.txt')).toBe(false);
    expect(isMarkdownPath('.md')).toBe(false);
  });

  it('compares Windows paths case-insensitively only', () => {
    expect(samePath('C:\\Docs\\A.md', 'c:/docs/a.md')).toBe(true);
    expect(samePath('/Docs/A.md', '/docs/a.md')).toBe(false);
    expect(samePath('/docs/./a.md', '/docs/a.md')).toBe(true);
  });
});

describe('relativePath', () => {
  it('computes relative paths', () => {
    expect(relativePath('/p', '/p/docs/api.md')).toBe('docs/api.md');
    expect(relativePath('/p/docs', '/p/README.md')).toBe('../README.md');
    expect(relativePath('C:\\p', 'c:\\P\\docs\\api.md')).toBe('docs\\api.md');
    expect(relativePath('C:\\p', 'D:\\x.md')).toBe('D:\\x.md');
  });
});

describe('splitHash / resolveRelative', () => {
  it('splits query and hash', () => {
    expect(splitHash('a.md?raw=1#Some%20Heading')).toEqual({ path: 'a.md', hash: 'Some Heading' });
    expect(splitHash('a.md#')).toEqual({ path: 'a.md', hash: null });
    expect(splitHash('#top')).toEqual({ path: '', hash: 'top' });
  });

  it('resolves relative references against a POSIX base', () => {
    expect(resolveRelative('/p/docs', '../img/My%20Logo.png')).toEqual({
      path: '/p/img/My Logo.png',
      hash: null,
    });
    expect(resolveRelative('/p/docs', './api.md#usage')).toEqual({
      path: '/p/docs/api.md',
      hash: 'usage',
    });
    expect(resolveRelative('/p/docs', '/etc/x.png').path).toBe('/etc/x.png');
    expect(resolveRelative('/p', 'file:///home/me/a%20b.png').path).toBe('/home/me/a b.png');
  });

  it('resolves relative references against a Windows base', () => {
    expect(resolveRelative('C:\\p\\docs', '../img/logo.png').path).toBe('C:\\p\\img\\logo.png');
    expect(resolveRelative('C:\\p', 'file:///D:/pics/x.png').path).toBe('D:\\pics\\x.png');
  });

  it('keeps malformed percent-encoding as-is', () => {
    expect(resolveRelative('/p', 'a%zz.md').path).toBe('/p/a%zz.md');
  });
});

describe('displayPath', () => {
  it('returns the path unchanged when home is unknown', () => {
    expect(displayPath('/home/me/a.md')).toBe('/home/me/a.md');
  });

  it('collapses the home directory', () => {
    setHomeDir('/home/me');
    expect(displayPath('/home/me/docs/a.md')).toBe('~/docs/a.md');
    expect(displayPath('/home/me')).toBe('~');
    expect(displayPath('/home/meg/a.md')).toBe('/home/meg/a.md');
  });

  it('collapses a Windows home directory case-insensitively', () => {
    setHomeDir('C:\\Users\\Me');
    expect(displayPath('c:\\users\\me\\Docs\\a.md')).toBe('~\\Docs\\a.md');
  });
});
