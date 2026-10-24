// Prints the CHANGELOG section for one version, for use as the release body
// and as the "what's new" text the in-app updater shows.
// Usage: node scripts/release-notes.mjs v1.4.0
import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
const version = tag.replace(/^v/, '');
if (version === '') {
  console.error('usage: release-notes.mjs <version|vVersion>');
  process.exit(2);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split('\n');
const heading = (line) => /^## \[/.test(line);
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));

if (start === -1) {
  // Never fail a release over release notes.
  console.log(`Markdown Viewer ${version}. See CHANGELOG.md for the full history.`);
  process.exit(0);
}

const rest = lines.slice(start + 1);
const end = rest.findIndex(heading);
const body = (end === -1 ? rest : rest.slice(0, end))
  .join('\n')
  .replace(/^\n+/, '')
  .replace(/\n+$/, '');

console.log(body === '' ? `Markdown Viewer ${version}.` : body);
