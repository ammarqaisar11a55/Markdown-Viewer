//! Renders a Markdown file to stdout: `cargo run --release --example render -- FILE`.
fn main() {
    let path = std::env::args().nth(1).expect("usage: render FILE");
    let file = mdv_core::fs::read_markdown_file(std::path::Path::new(&path)).expect("readable Markdown file");
    let start = std::time::Instant::now();
    let doc = mdv_core::render_markdown(&file.content, &mdv_core::RenderOptions::default());
    eprintln!("{} bytes -> {} bytes, {} headings in {:?}", file.content.len(), doc.html.len(), doc.headings.len(), start.elapsed());
    println!("{}", doc.html);
}
