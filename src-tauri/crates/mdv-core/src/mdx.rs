//! Reading MDX documents as plain Markdown.
//!
//! MDX is Markdown plus JavaScript: ESM `import`/`export` statements, JSX
//! components and `{expression}` interpolation. Evaluating any of that would
//! mean shipping a JavaScript runtime and running code that came out of a
//! document, which this viewer will never do. Instead the MDX-only syntax is
//! removed before the text enters the normal Markdown pipeline, so prose,
//! headings, code blocks and tables render exactly as they would in a `.md`
//! file and the app stays a reader.
//!
//! The simplification is deliberately textual and conservative:
//!
//! * nothing inside a fenced or indented code block — or an inline code span —
//!   is touched, so documentation *about* MDX keeps its examples intact;
//! * anything that cannot be understood (an unterminated tag, comment or fence,
//!   an English sentence that happens to start with "import") is left alone
//!   rather than guessed at, which keeps the result readable and makes the
//!   function idempotent;
//! * every scan walks the source once, so the cost stays linear in its length
//!   and a pathological document cannot make it quadratic.
//!
//! `{expression}` text is left in place: it renders literally, which is a
//! better outcome than silently dropping content the author wrote.

use std::collections::HashMap;
use std::path::Path;

/// True when `path` is an MDX document (extension compared case-insensitively).
pub fn is_mdx_path(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case("mdx"))
}

/// Turns MDX into Markdown, returning the text and whether anything was removed.
///
/// Idempotent: simplifying the result again yields the same text.
pub fn simplify_mdx(source: &str) -> (String, bool) {
    let mut out = String::with_capacity(source.len());
    // Prose is buffered so that constructs spanning several lines (a multi-line
    // tag or comment) can be removed, while code blocks interrupt the buffer and
    // are copied through verbatim.
    let mut prose = String::new();
    let mut changed = false;
    let mut fence: Option<(u8, usize)> = None;
    let mut indented_code = false;
    let mut prev_blank = true;
    let mut offset = 0;

    // Front matter is metadata for the renderer, not prose: copy it untouched.
    if source.starts_with("---\n") || source.starts_with("---\r\n") {
        offset = front_matter_end(source);
        out.push_str(&source[..offset]);
    }

    while offset < source.len() {
        let (line, next) = line_at(source, offset);
        let raw = &source[offset..next];
        let content = line.trim_end_matches('\r');
        let blank = content.trim().is_empty();

        if let Some((ch, len)) = fence {
            out.push_str(raw);
            if closes_fence(content, ch, len) {
                fence = None;
            }
        } else if indented_code && (blank || leading_indent(content).1 >= 4) {
            out.push_str(raw);
        } else if let Some(marker) = fence_marker(content) {
            indented_code = false;
            flush_prose(&mut out, &mut prose, &mut changed);
            out.push_str(raw);
            fence = Some(marker);
        } else if !blank && prev_blank && leading_indent(content).1 >= 4 {
            flush_prose(&mut out, &mut prose, &mut changed);
            out.push_str(raw);
            indented_code = true;
        } else {
            indented_code = false;
            if let Some(end) = esm_statement_end(source, offset) {
                // A removed statement is transparent: `prev_blank` still
                // describes the line before it.
                changed = true;
                offset = end;
                continue;
            }
            prose.push_str(raw);
        }
        prev_blank = blank;
        offset = next;
    }
    flush_prose(&mut out, &mut prose, &mut changed);
    (out, changed)
}

fn flush_prose(out: &mut String, prose: &mut String, changed: &mut bool) {
    if prose.is_empty() {
        return;
    }
    *changed |= strip_jsx(prose, out);
    prose.clear();
}

/// The line starting at `start` (without its ending) and the offset of the next.
fn line_at(source: &str, start: usize) -> (&str, usize) {
    let rest = &source[start..];
    match rest.find('\n') {
        Some(index) => (&rest[..index], start + index + 1),
        None => (rest, source.len()),
    }
}

/// `(byte length, visual width)` of the leading spaces and tabs of `line`.
fn leading_indent(line: &str) -> (usize, usize) {
    let mut bytes = 0;
    let mut width = 0;
    for byte in line.bytes() {
        match byte {
            b' ' => width += 1,
            b'\t' => width += 4 - width % 4,
            _ => break,
        }
        bytes += 1;
    }
    (bytes, width)
}

/// Offset just past the closing front matter delimiter, or 0 when there is none.
fn front_matter_end(source: &str) -> usize {
    let (_, mut offset) = line_at(source, 0);
    while offset < source.len() {
        let (line, next) = line_at(source, offset);
        if line.trim_end_matches('\r').trim() == "---" {
            return next;
        }
        offset = next;
    }
    0
}

/// `(fence character, length)` when `line` opens a fenced code block.
fn fence_marker(line: &str) -> Option<(u8, usize)> {
    let (indent, width) = leading_indent(line);
    if width > 3 {
        return None;
    }
    let rest = line.as_bytes().get(indent..)?;
    let ch = *rest.first()?;
    if ch != b'`' && ch != b'~' {
        return None;
    }
    let len = rest.iter().take_while(|byte| **byte == ch).count();
    if len < 3 {
        return None;
    }
    // A backtick info string may not contain a backtick.
    if ch == b'`' && rest[len..].contains(&b'`') {
        return None;
    }
    Some((ch, len))
}

fn closes_fence(line: &str, ch: u8, len: usize) -> bool {
    let (indent, width) = leading_indent(line);
    if width > 3 {
        return false;
    }
    let Some(rest) = line.as_bytes().get(indent..) else { return false };
    let run = rest.iter().take_while(|byte| **byte == ch).count();
    run >= len && rest[run..].iter().all(u8::is_ascii_whitespace)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Keyword {
    Import,
    Export,
}

/// Offset just past a top-level ESM statement starting at `start`, if there is one.
///
/// Only column zero counts: an indented `import` belongs to a list item, a
/// paragraph or a code block, never to the module.
fn esm_statement_end(source: &str, start: usize) -> Option<usize> {
    let (first, _) = line_at(source, start);
    let keyword = esm_keyword(first.trim_end_matches('\r'))?;

    let mut offset = start;
    let mut end;
    let mut depth: i32 = 0;
    loop {
        let (line, next) = line_at(source, offset);
        let content = line.trim_end_matches('\r');
        depth += bracket_delta(content);
        end = next;
        let trimmed = content.trim_end();
        // A statement ends at its semicolon, at a blank line, or as soon as it
        // cannot possibly continue on the next line.
        if depth <= 0 && trimmed.ends_with(';') {
            break;
        }
        if next >= source.len() || line_at(source, next).0.trim().is_empty() {
            break;
        }
        if depth <= 0 && !continues_statement(trimmed) {
            break;
        }
        offset = next;
    }

    // An English sentence can start with "import"; a module specifier in quotes
    // is what makes this JavaScript.
    if keyword == Keyword::Import && !has_module_specifier(&source[start..end]) {
        return None;
    }
    Some(end)
}

fn esm_keyword(line: &str) -> Option<Keyword> {
    if let Some(rest) = line.strip_prefix("import") {
        return starts_import_clause(rest).then_some(Keyword::Import);
    }
    if let Some(rest) = line.strip_prefix("export") {
        return starts_export_clause(rest).then_some(Keyword::Export);
    }
    None
}

fn starts_import_clause(rest: &str) -> bool {
    if rest.starts_with(['{', '*']) {
        return true;
    }
    if !rest.starts_with(char::is_whitespace) {
        return false;
    }
    let trimmed = rest.trim_start();
    trimmed.starts_with(['{', '*', '\'', '"'])
        || trimmed.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_' || c == '$')
}

fn starts_export_clause(rest: &str) -> bool {
    // Everything that may follow `export` at the start of a statement.
    const CLAUSES: &[&str] = &["default", "const", "let", "var", "function", "class", "async"];

    if rest.starts_with(['{', '*']) {
        return true;
    }
    if !rest.starts_with(char::is_whitespace) {
        return false;
    }
    let trimmed = rest.trim_start();
    trimmed.starts_with(['{', '*']) || CLAUSES.iter().any(|clause| starts_word(trimmed, clause))
}

/// True when `text` starts with `word` followed by something that cannot be
/// part of an identifier (so `const x` matches but `constellation` does not).
fn starts_word(text: &str, word: &str) -> bool {
    let Some(rest) = text.strip_prefix(word) else { return false };
    !rest.starts_with(|c: char| c.is_alphanumeric() || c == '_' || c == '$')
}

fn has_module_specifier(statement: &str) -> bool {
    let after_keyword = statement["import".len()..].trim_start();
    if after_keyword.starts_with(['\'', '"']) {
        return true;
    }
    statement
        .match_indices("from")
        .any(|(index, _)| statement[index + "from".len()..].trim_start().starts_with(['\'', '"']))
}

fn continues_statement(trimmed: &str) -> bool {
    matches!(trimmed.chars().last(), Some(',' | '{' | '(' | '[' | '=')) || trimmed.ends_with("from")
}

fn bracket_delta(line: &str) -> i32 {
    line.bytes().fold(0, |depth, byte| match byte {
        b'{' | b'(' | b'[' => depth + 1,
        b'}' | b')' | b']' => depth - 1,
        _ => depth,
    })
}

/// Removes JSX comments and component tags from `text`, appending to `out`.
///
/// Component tags are removed, not their contents: `<Note>**hi**</Note>`
/// becomes `**hi**`. Lowercase tags are plain HTML and are left to the existing
/// renderer and sanitizer.
fn strip_jsx(text: &str, out: &mut String) -> bool {
    let bytes = text.as_bytes();
    let mut code_spans = CodeSpans::new(text);
    let mut changed = false;
    // Offset of the first byte that still has to be copied to `out`.
    let mut copied = 0;
    let mut offset = 0;
    while offset < bytes.len() {
        match bytes[offset] {
            b'`' => offset = code_spans.skip(offset),
            b'{' if text[offset..].starts_with("{/*") => match text[offset + 3..].find("*/}") {
                Some(index) => {
                    out.push_str(&text[copied..offset]);
                    offset = offset + 3 + index + "*/}".len();
                    copied = offset;
                    changed = true;
                }
                // Unterminated: leave it as literal text rather than swallowing
                // the rest of the document.
                None => offset += 1,
            },
            b'<' => match component_tag(text, offset) {
                Some(end) => {
                    out.push_str(&text[copied..offset]);
                    offset = end;
                    copied = offset;
                    changed = true;
                }
                None => offset += 1,
            },
            _ => offset += 1,
        }
    }
    out.push_str(&text[copied..]);
    changed
}

/// Offset just past the component tag starting at `start`, if there is one.
fn component_tag(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let mut offset = start + 1;
    if bytes.get(offset) == Some(&b'/') {
        offset += 1;
    }
    // Component names start with an uppercase letter; `<div>` is HTML.
    if !bytes.get(offset)?.is_ascii_uppercase() {
        return None;
    }
    while bytes.get(offset).is_some_and(is_name_byte) {
        offset += 1;
    }
    // Only whitespace, `/` or `>` may follow a tag name, which rules out prose
    // such as `a < Big, b > c`.
    if !bytes.get(offset).is_some_and(|&byte| byte.is_ascii_whitespace() || matches!(byte, b'/' | b'>')) {
        return None;
    }
    // A `>` inside a quoted attribute value or a `{…}` expression does not end
    // the tag.
    let mut depth = 0usize;
    let mut quote: Option<u8> = None;
    while let Some(&byte) = bytes.get(offset) {
        match quote {
            Some(open) if byte == open => quote = None,
            Some(_) => {}
            None => match byte {
                b'"' | b'\'' => quote = Some(byte),
                b'{' => depth += 1,
                b'}' => depth = depth.saturating_sub(1),
                b'>' if depth == 0 => return Some(offset + 1),
                _ => {}
            },
        }
        offset += 1;
    }
    // Unterminated tag: leave the text untouched.
    None
}

fn is_name_byte(byte: &u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-' | b'$')
}

/// Backtick runs of a text, used to step over inline code spans.
///
/// A code span is closed by a run of exactly the same length, so the matching
/// run of every opener is precomputed in one backwards pass; looking one up is
/// then constant time and the whole scan stays linear.
struct CodeSpans {
    runs: Vec<Run>,
    /// For each run, the next run of the same length.
    closes: Vec<Option<usize>>,
    /// Runs before this index have been passed already.
    cursor: usize,
}

struct Run {
    start: usize,
    len: usize,
}

impl CodeSpans {
    fn new(text: &str) -> Self {
        let bytes = text.as_bytes();
        let mut runs: Vec<Run> = Vec::new();
        let mut offset = 0;
        while offset < bytes.len() {
            if bytes[offset] == b'`' {
                let start = offset;
                while bytes.get(offset) == Some(&b'`') {
                    offset += 1;
                }
                runs.push(Run { start, len: offset - start });
            } else {
                offset += 1;
            }
        }
        let mut closes = vec![None; runs.len()];
        let mut last: HashMap<usize, usize> = HashMap::new();
        for (index, run) in runs.iter().enumerate().rev() {
            closes[index] = last.get(&run.len).copied();
            last.insert(run.len, index);
        }
        Self { runs, closes, cursor: 0 }
    }

    /// Given the start of a backtick run, the offset just past the code span it
    /// opens — or just past the run itself when nothing closes it.
    fn skip(&mut self, start: usize) -> usize {
        while self.runs.get(self.cursor).is_some_and(|run| run.start < start) {
            self.cursor += 1;
        }
        let Some(run) = self.runs.get(self.cursor).filter(|run| run.start == start) else {
            return start + 1;
        };
        let open_end = run.start + run.len;
        match self.closes[self.cursor] {
            Some(close) => {
                self.cursor = close + 1;
                let run = &self.runs[close];
                run.start + run.len
            }
            None => {
                self.cursor += 1;
                open_end
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `(name, source, expected, changed)`.
    const CASES: &[(&str, &str, &str, bool)] = &[
        ("plain markdown", "# Title\n\nSome *text*.\n", "# Title\n\nSome *text*.\n", false),
        ("default import", "import Note from './Note'\n\n# Title\n", "\n# Title\n", true),
        ("named import without semicolon", "import { A, B } from 'x'\ntext\n", "text\n", true),
        ("side effect import", "import './styles.css';\n\nbody\n", "\nbody\n", true),
        ("namespace import", "import * as all from 'x'\nbody\n", "body\n", true),
        (
            "multi-line import ending at a semicolon",
            "import {\n  A,\n  B,\n} from './x';\n# T\n",
            "# T\n",
            true,
        ),
        (
            "multi-line import ending at a blank line",
            "import {\n  A,\n  B\n} from './x'\n\n# T\n",
            "\n# T\n",
            true,
        ),
        ("export default", "export default Layout\n\ntext\n", "\ntext\n", true),
        ("export const with jsx", "export const Chart = () => <div>{x}</div>;\n\ntext\n", "\ntext\n", true),
        ("export block", "export {\n  a,\n  b,\n}\n\ntext\n", "\ntext\n", true),
        (
            "prose starting with import",
            "import your notes from the sidebar\n",
            "import your notes from the sidebar\n",
            false,
        ),
        (
            "prose starting with export",
            "export your settings as JSON\n",
            "export your settings as JSON\n",
            false,
        ),
        (
            "prose starting with a near keyword",
            "exports are constellations\n",
            "exports are constellations\n",
            false,
        ),
        ("indented import is prose", "  import x from 'y'\n", "  import x from 'y'\n", false),
        ("import inside a quote is prose", "> import x from 'y'\n", "> import x from 'y'\n", false),
        ("jsx comment", "a {/* hidden */} b\n", "a  b\n", true),
        ("multi-line jsx comment", "a {/* one\ntwo */} b\n", "a  b\n", true),
        ("unterminated jsx comment", "a {/* one\ntwo\n", "a {/* one\ntwo\n", false),
        ("expression is kept", "There are {count} items.\n", "There are {count} items.\n", false),
        ("self closing component", "<Note />\n\ntext\n", "\n\ntext\n", true),
        ("paired component keeps inner markdown", "<Note>**hi**</Note>\n", "**hi**\n", true),
        (
            "paired component keeps inner block markdown",
            "<Note kind=\"tip\">\n\n# Inside\n\n</Note>\n",
            "\n\n# Inside\n\n\n",
            true,
        ),
        ("multi-line opening tag", "<Note\n  kind=\"tip\"\n>\ntext\n</Note>\n", "\ntext\n\n", true),
        ("dotted component name", "<Tabs.Panel>x</Tabs.Panel>\n", "x\n", true),
        ("greater than inside an expression", "<Chart data={a > b} />\nx\n", "\nx\n", true),
        ("greater than inside a string", "<Note title=\"a > b\" />\nx\n", "\nx\n", true),
        ("unterminated component tag", "<Note kind=\n", "<Note kind=\n", false),
        ("stray closing tag", "text\n</Note>\n", "text\n\n", true),
        ("html is left alone", "<div class=\"x\">hi</div>\n", "<div class=\"x\">hi</div>\n", false),
        ("comparison in prose", "a < Big, b > c\n", "a < Big, b > c\n", false),
        (
            "fenced code is preserved",
            "```jsx\nimport Note from './Note'\n\n<Note />\n{/* c */}\n```\n\n<Note />\n",
            "```jsx\nimport Note from './Note'\n\n<Note />\n{/* c */}\n```\n\n\n",
            true,
        ),
        ("tilde fence is preserved", "~~~\nimport x from 'y'\n~~~\n", "~~~\nimport x from 'y'\n~~~\n", false),
        (
            "nested backticks inside a fence",
            "````\n```\nimport x from 'y'\n```\n````\n",
            "````\n```\nimport x from 'y'\n```\n````\n",
            false,
        ),
        (
            "unterminated fence is preserved",
            "```js\nimport x from 'y'\n<Note />\n",
            "```js\nimport x from 'y'\n<Note />\n",
            false,
        ),
        (
            "indented code is preserved",
            "text\n\n    import x from 'y'\n    <Note />\n\ntext\n",
            "text\n\n    import x from 'y'\n    <Note />\n\ntext\n",
            false,
        ),
        ("indented continuation of a paragraph is not code", "text\n    <Note />\n", "text\n    \n", true),
        (
            "inline code is preserved",
            "Use `<Note />` and `{/* c */}` here.\n",
            "Use `<Note />` and `{/* c */}` here.\n",
            false,
        ),
        (
            "double backtick code span is preserved",
            "``<Note attr=\"`\" />`` stays\n",
            "``<Note attr=\"`\" />`` stays\n",
            false,
        ),
        ("unmatched backtick does not hide a tag", "a ` b <Note /> c\n", "a ` b  c\n", true),
        (
            "front matter is preserved",
            "---\nexport: true\nimport: false\n---\n\n<Note />\n",
            "---\nexport: true\nimport: false\n---\n\n\n",
            true,
        ),
        ("crlf line endings", "import x from 'y'\r\n# T\r\n", "# T\r\n", true),
        ("empty source", "", "", false),
        ("no trailing newline", "<Note />", "", true),
    ];

    #[test]
    fn simplifies_mdx_constructs() {
        for (name, source, expected, changed) in CASES {
            let (output, removed) = simplify_mdx(source);
            assert_eq!(output, *expected, "{name}");
            assert_eq!(removed, *changed, "{name}: changed flag");
        }
    }

    #[test]
    fn is_idempotent() {
        for (name, source, expected, _) in CASES {
            let (once, _) = simplify_mdx(source);
            let (twice, changed) = simplify_mdx(&once);
            assert_eq!(twice, *expected, "{name}");
            assert!(!changed, "{name}: second pass removed something");
        }
    }

    #[test]
    fn survives_pathological_input() {
        let inputs = [
            "<".repeat(20_000),
            "<Note".repeat(20_000),
            "{/*".repeat(20_000),
            "`".repeat(20_000),
            "```".repeat(20_000),
            "{".repeat(20_000),
            "import {".repeat(20_000),
            "</".repeat(20_000),
            "<A><B><C>".repeat(10_000),
            "import a from 'b'\n".repeat(10_000),
            "é<Nöte />\u{feff}<Note/>".repeat(10_000),
            format!("import x from 'y'{}", "\n".repeat(10_000)),
        ];
        for input in &inputs {
            let (output, _) = simplify_mdx(input);
            // The result stays valid UTF-8 text no longer than the source and
            // simplifying it again changes nothing.
            assert!(output.len() <= input.len());
            let (again, changed) = simplify_mdx(&output);
            assert_eq!(again, output);
            assert!(!changed);
        }
    }

    #[test]
    fn detects_mdx_paths() {
        for name in ["a.mdx", "b.MDX", "c.Mdx"] {
            assert!(is_mdx_path(Path::new(name)), "{name}");
        }
        for name in ["a.md", "b.markdown", "mdx", "c.mdx.bak", "d"] {
            assert!(!is_mdx_path(Path::new(name)), "{name}");
        }
    }
}
