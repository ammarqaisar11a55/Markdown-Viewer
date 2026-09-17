// Curated set of languages the highlighter supports, with aliases and display
// labels. Kept free of grammar imports so the main thread can use it cheaply;
// the grammar loaders live in `grammars.ts` (worker only).

export const SUPPORTED_LANGUAGES = [
  'astro',
  'bat',
  'c',
  'clojure',
  'cmake',
  'cpp',
  'csharp',
  'css',
  'csv',
  'dart',
  'diff',
  'docker',
  'elixir',
  'erlang',
  'fish',
  'fsharp',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'hcl',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'json5',
  'jsonc',
  'jsx',
  'julia',
  'kotlin',
  'latex',
  'less',
  'lua',
  'make',
  'markdown',
  'nginx',
  'nix',
  'objective-c',
  'ocaml',
  'perl',
  'php',
  'powershell',
  'prisma',
  'proto',
  'python',
  'r',
  'regex',
  'ruby',
  'rust',
  'scala',
  'scss',
  'shellscript',
  'solidity',
  'sql',
  'svelte',
  'swift',
  'terraform',
  'toml',
  'tsx',
  'typescript',
  'vue',
  'xml',
  'yaml',
  'zig',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const SUPPORTED = new Set<string>(SUPPORTED_LANGUAGES);

const ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  sh: 'shellscript',
  bash: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  console: 'shellscript',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  cmd: 'bat',
  batch: 'bat',
  py: 'python',
  python3: 'python',
  rs: 'rust',
  golang: 'go',
  kt: 'kotlin',
  kts: 'kotlin',
  'c++': 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  'c#': 'csharp',
  rb: 'ruby',
  yml: 'yaml',
  md: 'markdown',
  htm: 'html',
  xhtml: 'html',
  svg: 'xml',
  plist: 'xml',
  dockerfile: 'docker',
  makefile: 'make',
  mk: 'make',
  gql: 'graphql',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  tf: 'terraform',
  tfvars: 'terraform',
  objc: 'objective-c',
  pl: 'perl',
  protobuf: 'proto',
  tex: 'latex',
  jl: 'julia',
  clj: 'clojure',
  erl: 'erlang',
  ml: 'ocaml',
  fs: 'fsharp',
  'f#': 'fsharp',
  sol: 'solidity',
  cfg: 'ini',
  conf: 'ini',
  properties: 'ini',
};

const LABELS: Partial<Record<SupportedLanguage, string>> = {
  bat: 'Batch',
  c: 'C',
  cmake: 'CMake',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  csv: 'CSV',
  docker: 'Dockerfile',
  fsharp: 'F#',
  graphql: 'GraphQL',
  hcl: 'HCL',
  html: 'HTML',
  ini: 'INI',
  javascript: 'JavaScript',
  json: 'JSON',
  json5: 'JSON5',
  jsonc: 'JSONC',
  jsx: 'JSX',
  latex: 'LaTeX',
  make: 'Makefile',
  nginx: 'Nginx',
  'objective-c': 'Objective-C',
  ocaml: 'OCaml',
  php: 'PHP',
  powershell: 'PowerShell',
  proto: 'Protobuf',
  r: 'R',
  scss: 'SCSS',
  shellscript: 'Shell',
  sql: 'SQL',
  toml: 'TOML',
  tsx: 'TSX',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
};

/** Maps an info-string language (`TS`, `js`, `c++`…) to a supported grammar id. */
export function resolveLanguage(lang: string | null | undefined): SupportedLanguage | null {
  if (lang === null || lang === undefined) return null;
  const key = lang.trim().toLowerCase();
  if (key === '') return null;
  if (SUPPORTED.has(key)) return key as SupportedLanguage;
  return ALIASES[key] ?? null;
}

const SHELL_LABELS: Record<string, string> = { bash: 'Bash', zsh: 'Zsh', console: 'Console' };

const TEXT_LANGS = new Set(['text', 'txt', 'plain', 'plaintext']);

/** Human-friendly label for a code block's language, or `null` for none. */
export function languageLabel(lang: string | null | undefined): string | null {
  if (lang === null || lang === undefined) return null;
  const raw = lang.trim();
  if (raw === '') return null;
  if (TEXT_LANGS.has(raw.toLowerCase())) return 'Text';
  const resolved = resolveLanguage(raw);
  if (resolved === null) return raw;
  const shellLabel = SHELL_LABELS[raw.toLowerCase()];
  if (shellLabel !== undefined) return shellLabel;
  return LABELS[resolved] ?? resolved.charAt(0).toUpperCase() + resolved.slice(1);
}
