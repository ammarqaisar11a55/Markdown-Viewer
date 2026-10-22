//! Renders a Markdown or MDX file to stdout: `cargo run --release --example render -- FILE`.
fn main() {
    let arg = std::env::args().nth(1).expect("usage: render FILE");
    let path = std::path::Path::new(&arg);
    let file = mdv_core::fs::read_markdown_file(path).expect("readable Markdown file");
    let start = std::time::Instant::now();
    let doc = mdv_core::render_source(path, &file.content, &mdv_core::RenderOptions::default());
    eprintln!(
        "{} bytes -> {} bytes, {} headings, {:?}{} in {:?}",
        file.content.len(),
        doc.html.len(),
        doc.headings.len(),
        doc.flavor,
        if doc.simplified { " (simplified)" } else { "" },
        start.elapsed()
    );
    println!("{}", doc.html);
}
