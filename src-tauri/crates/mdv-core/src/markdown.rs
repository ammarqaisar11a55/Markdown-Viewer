//! Markdown → sanitized HTML rendering.
//!
//! The pipeline is: `comrak` (GitHub-flavoured Markdown) → `ammonia`
//! (allow-list HTML sanitizer). Headings for the table of contents are
//! extracted from the same AST, using the same anchor algorithm comrak uses for
//! heading ids, so every outline entry points at a real element.

use comrak::nodes::NodeValue;
use comrak::{format_html, parse_document, Anchorizer, Arena, Options};
use serde::{Deserialize, Serialize};

use crate::sanitize::sanitize_html;

/// User-configurable rendering options.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RenderOptions {
    /// Allow (sanitized) raw HTML embedded in the Markdown source.
    pub allow_html: bool,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self { allow_html: true }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedDocument {
    /// Sanitized HTML, safe to insert into the viewer.
    pub html: String,
    pub headings: Vec<Heading>,
    pub word_count: usize,
}

fn comrak_options(render: &RenderOptions) -> Options<'static> {
    let mut options = Options::default();
    let ext = &mut options.extension;
    ext.strikethrough = true;
    ext.table = true;
    ext.autolink = true;
    ext.tasklist = true;
    ext.footnotes = true;
    ext.alerts = true;
    ext.header_id_prefix = Some(String::new());
    ext.front_matter_delimiter = Some("---".to_owned());

    options.render.tasklist_classes = true;
    // Raw HTML is passed through only to be sanitized by ammonia below. When
    // disabled, comrak escapes it so it is shown as text.
    options.render.r#unsafe = render.allow_html;
    options.render.escape = !render.allow_html;
    options
}

fn count_words(text: &str) -> usize {
    text.split_whitespace().filter(|word| word.chars().any(char::is_alphanumeric)).count()
}

/// Renders Markdown into sanitized HTML plus an outline.
pub fn render_markdown(source: &str, render: &RenderOptions) -> RenderedDocument {
    let options = comrak_options(render);
    let arena = Arena::new();
    let root = parse_document(&arena, source, &options);

    let mut anchorizer = Anchorizer::new();
    let mut headings = Vec::new();
    let mut word_count = 0;
    for node in root.descendants() {
        match &node.data().value {
            NodeValue::Heading(heading) => {
                let text = node.collect_text();
                let id = anchorizer.anchorize(&text);
                headings.push(Heading { level: heading.level, text: text.trim().to_owned(), id });
            }
            NodeValue::Text(text) => word_count += count_words(text),
            NodeValue::Code(code) => word_count += count_words(&code.literal),
            _ => {}
        }
    }

    let mut unsafe_html = String::with_capacity(source.len() + source.len() / 2);
    // Writing into a String cannot fail.
    format_html(root, &options, &mut unsafe_html).expect("formatting HTML into a String");

    RenderedDocument { html: sanitize_html(&unsafe_html), headings, word_count }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn html(md: &str) -> String {
        render_markdown(md, &RenderOptions::default()).html
    }

    #[test]
    fn renders_all_heading_levels_with_ids() {
        let doc = render_markdown(
            "# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six\n## Two\n",
            &RenderOptions::default(),
        );
        for level in 1..=6 {
            assert!(doc.html.contains(&format!("<h{level} id=")), "missing h{level}: {}", doc.html);
        }
        let ids: Vec<_> = doc.headings.iter().map(|h| h.id.as_str()).collect();
        assert_eq!(ids, ["one", "two", "three", "four", "five", "six", "two-1"]);
        assert!(doc.html.contains(r#"<h2 id="two-1">"#));
        assert_eq!(doc.headings[0], Heading { level: 1, text: "One".into(), id: "one".into() });
    }

    #[test]
    fn heading_text_ignores_inline_markup() {
        let doc = render_markdown("## Hello `world` **bold**\n", &RenderOptions::default());
        assert_eq!(doc.headings[0].text, "Hello world bold");
        assert!(doc.html.contains(&format!(r#"id="{}""#, doc.headings[0].id)));
    }

    #[test]
    fn renders_inline_formatting() {
        let out = html("**b** *i* ~~s~~ `c`\n\n> quote\n\n---\n");
        assert!(out.contains("<strong>b</strong>"));
        assert!(out.contains("<em>i</em>"));
        assert!(out.contains("<del>s</del>"));
        assert!(out.contains("<code>c</code>"));
        assert!(out.contains("<blockquote>"));
        assert!(out.contains("<hr"));
    }

    #[test]
    fn renders_nested_lists() {
        let out = html("1. one\n   - nested\n     - deeper\n2. two\n");
        assert!(out.contains("<ol>"));
        assert_eq!(out.matches("<ul>").count(), 2);
    }

    #[test]
    fn renders_tables_with_alignment() {
        let out = html("| a | b |\n|:-:|--:|\n| 1 | 2 |\n");
        assert!(out.contains("<table>"));
        assert!(out.contains("<th"));
        assert!(out.contains("<td"));
        assert!(out.contains("center"), "alignment should survive sanitization: {out}");
    }

    #[test]
    fn renders_code_blocks_with_language_class() {
        let out = html("```javascript\nconsole.log(\"<hi>\");\n```\n");
        assert!(out.contains(r#"<code class="language-javascript">"#), "{out}");
        assert!(out.contains("&lt;hi&gt;"));
    }

    #[test]
    fn renders_task_lists() {
        let out = html("- [x] done\n- [ ] todo\n");
        assert!(out.contains("task-list-item"), "{out}");
        assert_eq!(out.matches(r#"type="checkbox""#).count(), 2);
        assert!(out.contains("checked"));
        assert!(out.contains("disabled"));
    }

    #[test]
    fn renders_links_images_and_autolinks() {
        let out = html("[site](https://example.com) ![alt](img/a.png \"t\") https://auto.link\n");
        assert!(out.contains(r#"href="https://example.com""#));
        assert!(out.contains(r#"src="img/a.png""#));
        assert!(out.contains(r#"alt="alt""#));
        assert!(out.contains(r#"href="https://auto.link""#));
    }

    #[test]
    fn renders_footnotes_with_matching_anchors() {
        let out = html("Text[^1].\n\n[^1]: The note.\n");
        assert!(out.contains("footnote"), "{out}");
        assert!(out.contains(r##"href="#fn-1""##), "{out}");
        assert!(out.contains(r#"id="fn-1""#), "{out}");
    }

    #[test]
    fn renders_github_alerts() {
        let out = html("> [!WARNING]\n> Careful\n");
        assert!(out.contains("markdown-alert-warning"), "{out}");
    }

    #[test]
    fn hides_front_matter() {
        let out = html("---\ntitle: secret\n---\n\n# Body\n");
        assert!(!out.contains("secret"));
        assert!(out.contains("Body"));
    }

    #[test]
    fn keeps_safe_html() {
        let out = html("<details><summary>More</summary>\n\nHidden <kbd>Ctrl</kbd>\n\n</details>\n");
        assert!(out.contains("<details>"));
        assert!(out.contains("<summary>"));
        assert!(out.contains("<kbd>"));
    }

    #[test]
    fn escapes_html_when_disabled() {
        let doc = render_markdown("<b>raw</b>\n", &RenderOptions { allow_html: false });
        assert!(doc.html.contains("&lt;b&gt;"), "{}", doc.html);
    }

    #[test]
    fn counts_words() {
        let doc = render_markdown("# Title\n\nOne two `three`.\n", &RenderOptions::default());
        assert_eq!(doc.word_count, 4);
    }

    // --- Security -----------------------------------------------------------

    #[test]
    fn strips_script_tags() {
        for md in [
            "<script>alert(1)</script>",
            "<SCRIPT SRC=//x.js></SCRIPT>",
            "<div><script>alert(1)</script></div>",
            "<scr<script>ipt>alert(1)</script>",
        ] {
            let out = html(md);
            assert!(!out.to_lowercase().contains("<script"), "{md} -> {out}");
        }
    }

    #[test]
    fn strips_event_handlers_and_styles() {
        let out = html(
            "<img src=x onerror=alert(1)><a href=\"#\" onclick=\"x()\">a</a><p style=\"position:fixed\">p</p>",
        );
        assert!(!out.contains("onerror"), "{out}");
        assert!(!out.contains("onclick"), "{out}");
        assert!(!out.contains("position:fixed"), "{out}");
    }

    #[test]
    fn strips_dangerous_elements() {
        let out = html(
            "<iframe src=\"https://evil\"></iframe><object data=x></object><embed src=x>\
             <form action=x><input name=a></form><style>body{}</style><base href=x>\
             <meta http-equiv=refresh content=0><link rel=stylesheet href=x><svg onload=alert(1)></svg>",
        );
        for tag in ["<iframe", "<object", "<embed", "<form", "<style", "<base", "<meta", "<link", "<svg"] {
            assert!(!out.contains(tag), "{tag} survived: {out}");
        }
    }

    #[test]
    fn blocks_dangerous_url_schemes() {
        for md in [
            "[x](javascript:alert(1))",
            "[x](JaVaScRiPt:alert(1))",
            "[x](vbscript:msgbox)",
            "[x](data:text/html;base64,PHNjcmlwdD4=)",
            "<a href=\"javascript&colon;alert(1)\">x</a>",
            "<a href=\"  javascript:alert(1)\">x</a>",
            "![x](javascript:alert(1))",
            "[x](tauri://localhost)",
            "[x](file:///etc/passwd)",
        ] {
            let out = html(md).to_lowercase();
            for bad in ["javascript", "vbscript", "data:text", "tauri:", "file:"] {
                assert!(!out.contains(&format!("href=\"{bad}")), "{md} -> {out}");
                assert!(!out.contains(&format!("src=\"{bad}")), "{md} -> {out}");
            }
        }
    }

    #[test]
    fn allows_safe_url_schemes() {
        let out = html("[a](https://x.y) [b](mailto:a@b.c) [c](./doc.md) [d](#top)");
        assert!(out.contains(r#"href="https://x.y""#));
        assert!(out.contains(r#"href="mailto:a@b.c""#));
        assert!(out.contains(r#"href="./doc.md""#));
        assert!(out.contains(r##"href="#top""##));
    }

    #[test]
    fn allows_only_image_data_uris_on_images() {
        let out = html("![a](data:image/png;base64,iVBORw0KGgo=)");
        assert!(out.contains("src=\"data:image/png"), "{out}");
        let out = html("<img src=\"data:text/html,<script>1</script>\">");
        assert!(!out.contains("data:text"), "{out}");
    }

    #[test]
    fn restricts_class_names() {
        let out = html("<div class=\"fixed inset-0 z-50 markdown-alert\">x</div>");
        assert!(!out.contains("fixed"), "{out}");
        assert!(!out.contains("inset-0"), "{out}");
        assert!(out.contains("markdown-alert"), "{out}");
    }

    #[test]
    fn restricts_input_elements_to_disabled_checkboxes() {
        let out = html("<input type=\"text\" value=\"x\">");
        assert!(!out.contains("type=\"text\""), "{out}");
        assert!(!out.contains("value="), "{out}");
    }

    #[test]
    fn external_links_get_safe_rel() {
        let out = html("[x](https://example.com)");
        assert!(out.contains("noopener"), "{out}");
    }

    #[test]
    fn handles_large_documents() {
        let block = "## Section\n\nSome *text* with a [link](https://example.com).\n\n```rust\nfn main() {}\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n";
        let source = block.repeat(1024 * 1024 / block.len());
        let start = std::time::Instant::now();
        let doc = render_markdown(&source, &RenderOptions::default());
        assert!(doc.headings.len() > 5_000);
        assert!(doc.html.len() > source.len());
        // Generous bound: debug builds on slow CI machines.
        assert!(start.elapsed().as_secs() < 30);
    }
}
