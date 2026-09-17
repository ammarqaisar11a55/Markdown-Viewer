//! Allow-list HTML sanitization of rendered Markdown.

use std::borrow::Cow;
use std::collections::HashSet;
use std::sync::OnceLock;

use ammonia::{Builder, UrlRelative};

/// Class names produced by the Markdown renderer. User-supplied classes are
/// dropped so that raw HTML cannot borrow the application's own styles (for
/// example to draw a fake full-window overlay).
const ALLOWED_CLASSES: &[&str] = &[
    "anchor",
    "contains-task-list",
    "task-list-item",
    "task-list-item-checkbox",
    "footnotes",
    "footnote-definition",
    "footnote-reference",
    "footnote-backref",
    "markdown-alert",
    "markdown-alert-title",
    "markdown-alert-note",
    "markdown-alert-tip",
    "markdown-alert-important",
    "markdown-alert-warning",
    "markdown-alert-caution",
];

const EXTRA_TAGS: &[&str] = &[
    "details",
    "summary",
    "input",
    "section",
    "kbd",
    "mark",
    "sup",
    "sub",
    "ins",
    "del",
    "s",
    "figure",
    "figcaption",
    "picture",
    "source",
    "abbr",
    "var",
    "samp",
    "dl",
    "dt",
    "dd",
];

const IMAGE_DATA_PREFIXES: &[&str] =
    &["data:image/png", "data:image/jpeg", "data:image/gif", "data:image/webp", "data:image/avif"];

fn builder() -> &'static Builder<'static> {
    static BUILDER: OnceLock<Builder<'static>> = OnceLock::new();
    BUILDER.get_or_init(|| {
        let mut builder = Builder::default();
        builder
            .add_tags(EXTRA_TAGS)
            .add_generic_attributes(["id", "class", "title", "aria-label", "aria-hidden", "dir", "lang"])
            .add_tag_attributes("a", ["data-footnote-ref", "data-footnote-backref", "data-heading-content"])
            .add_tag_attributes("section", ["data-footnotes"])
            .add_tag_attributes("img", ["src", "alt", "width", "height", "align", "loading"])
            .add_tag_attributes("source", ["srcset", "media", "type"])
            .add_tag_attributes("input", ["type", "checked", "disabled"])
            .add_tag_attributes("details", ["open"])
            .add_tag_attributes("ol", ["start", "type"])
            .add_tag_attributes("li", ["value"])
            .add_tag_attributes("th", ["align", "colspan", "rowspan"])
            .add_tag_attributes("td", ["align", "colspan", "rowspan"])
            .add_tag_attributes("p", ["align"])
            .add_tag_attributes("div", ["align"])
            .add_tag_attributes("abbr", ["title"])
            .set_tag_attribute_value("input", "disabled", "")
            .url_schemes(HashSet::from(["http", "https", "mailto", "data"]))
            .url_relative(UrlRelative::PassThrough)
            .link_rel(Some("noopener noreferrer"))
            .strip_comments(true)
            .attribute_filter(filter_attribute);
        builder
    })
}

fn filter_attribute<'u>(element: &str, attribute: &str, value: &'u str) -> Option<Cow<'u, str>> {
    match (element, attribute) {
        (_, "class") => {
            let kept: Vec<&str> = value
                .split_ascii_whitespace()
                .filter(|class| {
                    ALLOWED_CLASSES.contains(class) || (element == "code" && is_language_class(class))
                })
                .collect();
            (!kept.is_empty()).then(|| Cow::Owned(kept.join(" ")))
        }
        ("img", "src") | ("source", "srcset") => {
            if has_scheme(value, "data") && !is_image_data_uri(value) {
                None
            } else {
                Some(Cow::Borrowed(value))
            }
        }
        // `data:` is only ever acceptable for images.
        (_, "href") if has_scheme(value, "data") => None,
        ("input", "type") => (value.eq_ignore_ascii_case("checkbox")).then_some(Cow::Borrowed(value)),
        _ => Some(Cow::Borrowed(value)),
    }
}

fn is_language_class(class: &str) -> bool {
    class.strip_prefix("language-").is_some_and(|lang| {
        !lang.is_empty()
            && lang.len() <= 40
            && lang.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '+' | '#' | '.'))
    })
}

fn has_scheme(url: &str, scheme: &str) -> bool {
    let trimmed = url.trim_start();
    trimmed.get(..scheme.len()).is_some_and(|prefix| prefix.eq_ignore_ascii_case(scheme))
        && trimmed.as_bytes().get(scheme.len()) == Some(&b':')
}

fn is_image_data_uri(url: &str) -> bool {
    let lower = url.trim_start().get(..16).map(str::to_ascii_lowercase).unwrap_or_default();
    IMAGE_DATA_PREFIXES.iter().any(|prefix| lower.starts_with(prefix))
}

pub(crate) fn sanitize_html(html: &str) -> String {
    builder().clean(html).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn language_classes() {
        assert!(is_language_class("language-rust"));
        assert!(is_language_class("language-c++"));
        assert!(!is_language_class("language-"));
        assert!(!is_language_class("fixed"));
        assert!(!is_language_class("language-a b"));
    }

    #[test]
    fn scheme_detection() {
        assert!(has_scheme("data:image/png;base64,", "data"));
        assert!(has_scheme("  DATA:text/html", "data"));
        assert!(!has_scheme("database.png", "data"));
        assert!(!has_scheme("data", "data"));
    }
}
