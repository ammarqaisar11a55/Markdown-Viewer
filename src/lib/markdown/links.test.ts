import { describe, expect, it } from 'vitest';
import { classifyLink, linkCopyText } from './links';

const DOC = '/home/user/docs/guide/README.md';
const WIN_DOC = 'C:\\Users\\me\\notes\\index.md';

describe('classifyLink', () => {
  it('classifies in-document anchors and decodes them', () => {
    expect(classifyLink('#install', DOC)).toEqual({ type: 'anchor', id: 'install' });
    expect(classifyLink('#caf%C3%A9', DOC)).toEqual({ type: 'anchor', id: 'café' });
    expect(classifyLink('#', DOC).type).toBe('blocked');
  });

  it('resolves relative markdown links with hashes', () => {
    expect(classifyLink('../api/auth.md#tokens', DOC)).toEqual({
      type: 'markdown',
      path: '/home/user/docs/api/auth.md',
      hash: 'tokens',
    });
    expect(classifyLink('./other.markdown', DOC)).toEqual({
      type: 'markdown',
      path: '/home/user/docs/guide/other.markdown',
      hash: null,
    });
    expect(classifyLink('my%20notes.md?plain=1', DOC)).toEqual({
      type: 'markdown',
      path: '/home/user/docs/guide/my notes.md',
      hash: null,
    });
  });

  it('handles absolute and file:// markdown paths', () => {
    expect(classifyLink('/etc/notes.md', DOC)).toEqual({
      type: 'markdown',
      path: '/etc/notes.md',
      hash: null,
    });
    expect(classifyLink('file:///tmp/a.md#x', DOC)).toEqual({
      type: 'markdown',
      path: '/tmp/a.md',
      hash: 'x',
    });
  });

  it('treats Windows drive paths as paths, not schemes', () => {
    expect(classifyLink('D:\\docs\\readme.md', WIN_DOC)).toEqual({
      type: 'markdown',
      path: 'D:\\docs\\readme.md',
      hash: null,
    });
    expect(classifyLink('..\\img\\diagram.png', WIN_DOC)).toEqual({
      type: 'local-file',
      path: 'C:\\Users\\me\\img\\diagram.png',
    });
    expect(classifyLink('sub/page.md', WIN_DOC)).toMatchObject({
      type: 'markdown',
      path: 'C:\\Users\\me\\notes\\sub\\page.md',
    });
  });

  it('classifies other local files', () => {
    expect(classifyLink('assets/report.pdf', DOC)).toEqual({
      type: 'local-file',
      path: '/home/user/docs/guide/assets/report.pdf',
    });
  });

  it('classifies http(s) and mailto as external', () => {
    expect(classifyLink('https://example.com/a?b=1#c', DOC)).toEqual({
      type: 'external',
      url: 'https://example.com/a?b=1#c',
    });
    expect(classifyLink('HTTP://Example.com', DOC)).toEqual({
      type: 'external',
      url: 'http://example.com/',
    });
    expect(classifyLink('mailto:me@example.com', DOC)).toEqual({
      type: 'external',
      url: 'mailto:me@example.com',
    });
  });

  it('upgrades protocol-relative links to https', () => {
    expect(classifyLink('//cdn.example.com/x', DOC)).toEqual({
      type: 'external',
      url: 'https://cdn.example.com/x',
    });
  });

  it('blocks dangerous and unknown schemes', () => {
    for (const href of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:msgbox',
      'tauri://localhost',
      'ftp://example.com',
      '',
    ]) {
      expect(classifyLink(href, DOC).type, href).toBe('blocked');
    }
  });
});

describe('linkCopyText', () => {
  it('returns the resolved target', () => {
    expect(linkCopyText(classifyLink('a.md#b', DOC), 'a.md#b')).toBe(
      '/home/user/docs/guide/a.md#b',
    );
    expect(linkCopyText(classifyLink('#x', DOC), '#x')).toBe('#x');
    expect(linkCopyText(classifyLink('javascript:x', DOC), 'javascript:x')).toBe('javascript:x');
  });
});
