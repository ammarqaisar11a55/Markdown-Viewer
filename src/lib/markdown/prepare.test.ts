import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '@/lib/platform/system';
import { getCodeBlockInfo } from './codeBlocks';
import { prepareFragment, type RenderContext } from './prepare';

vi.mock('@/lib/platform/system', () => ({
  toAssetUrl: vi.fn((path: string) => `mdasset://localhost/${encodeURIComponent(path)}`),
  copyText: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/platform/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ctx: RenderContext = { docPath: '/home/u/docs/README.md', loadRemoteImages: true };

function render(html: string, context: RenderContext = ctx): HTMLElement {
  const host = document.createElement('div');
  host.append(prepareFragment(html, context));
  document.body.replaceChildren(host);
  return host;
}

describe('prepareFragment — images', () => {
  it('rewrites relative images to asset URLs', () => {
    const root = render('<p><img src="img/a%20b.png" alt="Diagram"></p>');
    const img = root.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(
      `mdasset://localhost/${encodeURIComponent('/home/u/docs/img/a b.png')}`,
    );
    expect(img.dataset.localPath).toBe('/home/u/docs/img/a b.png');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.dataset.zoomable).toBe('true');
    expect(img.tabIndex).toBe(0);
  });

  it('rewrites absolute paths and file URLs', () => {
    const root = render('<img src="/var/pic.png" alt=""><img src="file:///C:/x/y.jpg" alt="">');
    const [a, b] = Array.from(root.querySelectorAll('img'));
    expect(a!.dataset.localPath).toBe('/var/pic.png');
    expect(b!.dataset.localPath).toBe('C:\\x\\y.jpg');
  });

  it('keeps https images and data URIs', () => {
    const root = render(
      '<img src="https://example.com/a.png" alt="r"><img src="data:image/png;base64,AAAA" alt="d">',
    );
    const [remote, data] = Array.from(root.querySelectorAll('img'));
    expect(remote!.getAttribute('src')).toBe('https://example.com/a.png');
    expect(remote!.dataset.srcKind).toBe('remote');
    expect(data!.dataset.srcKind).toBe('data');
  });

  it('blocks https images when remote images are disabled', () => {
    const root = render('<p><img src="https://example.com/a.png" alt="Logo"></p>', {
      ...ctx,
      loadRemoteImages: false,
    });
    expect(root.querySelector('img')).toBeNull();
    const placeholder = root.querySelector('.md-image-placeholder')!;
    expect(placeholder).toHaveAttribute('role', 'img');
    expect(placeholder).toHaveAttribute('aria-label', 'Logo — Remote image blocked');
  });

  it('always blocks insecure http images', () => {
    const root = render('<img src="http://example.com/a.png" alt="x">');
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Insecure image blocked');
  });

  it('replaces an image that fails to load with a placeholder', () => {
    const root = render('<p>Before <img src="missing.png" alt="Architecture"> after</p>');
    const img = root.querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    expect(root.querySelector('img')).toBeNull();
    const placeholder = root.querySelector('p > .md-image-placeholder')!;
    expect(placeholder.textContent).toContain('Architecture');
    expect(placeholder.textContent).toContain('Image not found');
    expect(placeholder.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not make linked images zoomable', () => {
    const root = render('<a href="https://ci"><img src="https://ci/badge.svg" alt="CI"></a>');
    expect(root.querySelector('img')!.dataset.zoomable).toBeUndefined();
  });
});

describe('prepareFragment — tables and links', () => {
  it('wraps tables in a focusable scroll region', () => {
    const root = render('<table><thead><tr><th>a</th></tr></thead></table>');
    const wrap = root.querySelector('.md-table-wrap')!;
    expect(wrap.firstElementChild?.tagName).toBe('TABLE');
    expect(wrap).toHaveAttribute('tabindex', '0');
    expect(wrap).toHaveAttribute('role', 'region');
  });

  it('annotates links with their type', () => {
    const root = render(
      '<a href="https://x.org">x</a><a href="b.md">b</a><a href="javascript:alert(1)">j</a>',
    );
    const [ext, md, bad] = Array.from(root.querySelectorAll('a'));
    expect(ext!.dataset.linkType).toBe('external');
    expect(ext!.title).toBe('https://x.org/');
    expect(md!.dataset.linkType).toBe('markdown');
    expect(bad!.dataset.linkType).toBe('blocked');
  });
});

describe('prepareFragment — code blocks', () => {
  beforeEach(() => {
    vi.mocked(copyText).mockClear();
  });

  it('wraps code with a header, language label, copy button and lines', () => {
    const root = render(
      '<pre><code class="language-ts">const a = 1;\nconst b = &lt;T&gt;() =&gt; 2;\n</code></pre>',
    );
    const block = root.querySelector<HTMLElement>('.md-code-block')!;
    expect(block.dataset.lang).toBe('ts');
    expect(block.querySelector('.md-code-lang')?.textContent).toBe('TypeScript');
    const lines = block.querySelectorAll('pre.md-code code .line');
    expect(lines).toHaveLength(2);
    expect(lines[1]?.textContent).toBe('const b = <T>() => 2;');
    expect(block.querySelector('pre')!.style.getPropertyValue('--md-line-digits')).toBe('2');
    expect(getCodeBlockInfo(block)).toEqual({
      code: 'const a = 1;\nconst b = <T>() => 2;\n',
      lang: 'ts',
      highlightable: true,
    });
  });

  it('uses a floating header without a language', () => {
    const root = render('<pre><code>plain\n</code></pre>');
    expect(root.querySelector('.md-code-header-floating')).not.toBeNull();
    expect(root.querySelector('.md-code-lang')).toBeNull();
    expect(root.querySelector<HTMLElement>('.md-code-block')!.dataset.lang).toBeUndefined();
  });

  it('copies the original code and shows feedback', async () => {
    const root = render('<pre><code class="language-py">print("hi")\n</code></pre>');
    const button = root.querySelector<HTMLButtonElement>('.md-code-copy')!;
    expect(button).toHaveAccessibleName('Copy code');
    button.click();
    expect(copyText).toHaveBeenCalledWith('print("hi")\n');
    await vi.waitFor(() => expect(button.dataset.copied).toBe('true'));
    expect(button.textContent).toContain('Copied');
  });

  it('does not split oversized blocks into lines', () => {
    const big = 'x\n'.repeat(5001);
    const root = render(`<pre><code class="language-js">${big}</code></pre>`);
    const block = root.querySelector<HTMLElement>('.md-code-block')!;
    expect(block.querySelector('.line')).toBeNull();
    expect(block.querySelector('pre')).toHaveClass('md-code-plain');
    expect(getCodeBlockInfo(block)?.highlightable).toBe(false);
  });
});
