// Generates large Markdown documents for manual performance testing.
// Usage: node scripts/generate-large-docs.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'samples/large';
const sizesKb = [100, 500, 1024, 5120, 10240, 25600];

function section(i) {
  return `## Section ${i}

Paragraph ${i} with **bold**, *italic*, ~~strike~~, \`inline code\` and a [link](https://example.com/${i}).
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.

- [x] Completed task ${i}
- [ ] Open task
  - Nested item

| Column A | Column B | Column C |
| :------- | :------: | -------: |
| ${i}     | beta     | gamma    |

\`\`\`typescript
export function section${i}(value: number): string {
  return \`value: \${value * ${i}}\`;
}
\`\`\`

> A blockquote in section ${i}.

`;
}

mkdirSync(outDir, { recursive: true });
for (const kb of sizesKb) {
  const parts = [`# Large document (${kb} KB)\n\n`];
  let size = parts[0].length;
  for (let i = 1; size < kb * 1024; i++) {
    const s = section(i);
    parts.push(s);
    size += s.length;
  }
  const file = join(outDir, `large-${kb >= 1024 ? `${kb / 1024}mb` : `${kb}kb`}.md`);
  writeFileSync(file, parts.join(''));
  console.info(`wrote ${file}`);
}
