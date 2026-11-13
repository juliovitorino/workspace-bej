import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pages = [
  { slug: "terms", title: "Termos de Uso", source: "src/content/terms-of-use.md" },
  { slug: "privacy", title: "Política de Privacidade", source: "src/content/privacy-policy.md" },
];

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function markdownToHtml(markdown) {
  const output = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push("<p>" + inline(paragraph.join(" ")) + "</p>");
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push("<ul>" + list.map(item => "<li>" + inline(item) + "</li>").join("") + "</ul>");
    list = [];
  };
  const flushQuote = () => {
    if (quote.length) output.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>");
    quote = [];
  };
  const flush = () => { flushParagraph(); flushList(); flushQuote(); };
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      output.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
    } else if (/^---+$/.test(line)) {
      flush();
      output.push("<hr>");
    } else if (line.startsWith("- ")) {
      flushParagraph(); flushQuote();
      list.push(line.slice(2));
    } else if (line.startsWith("> ")) {
      flushParagraph(); flushList();
      quote.push(line.slice(2));
    } else {
      flushList(); flushQuote();
      paragraph.push(line);
    }
  }
  flush();
  return output.join("\n");
}

const css = [
  ":root { color-scheme: light dark; font-family: system-ui, -apple-system, sans-serif; }",
  "* { box-sizing: border-box; }",
  "body { margin: 0; background: #f6f8fb; color: #192638; line-height: 1.7; }",
  "header { background: #122d55; color: white; padding: 20px max(20px, calc((100vw - 850px)/2)); }",
  "header a { color: white; font-weight: 750; text-decoration: none; }",
  "main { max-width: 850px; margin: 30px auto; padding: 28px 36px; background: white; border: 1px solid #dce3ee; border-radius: 14px; }",
  "h1, h2, h3 { line-height: 1.3; color: #14396c; }",
  "h1 { font-size: clamp(1.5rem, 4vw, 2.1rem); }",
  "h2 { margin-top: 30px; font-size: 1.2rem; }",
  "a { color: #155eae; overflow-wrap: anywhere; }",
  "code { overflow-wrap: anywhere; background: #edf2f8; padding: 1px 4px; border-radius: 4px; }",
  "blockquote { margin: 16px 0; padding: 8px 16px; border-left: 4px solid #407bc3; background: #edf4ff; }",
  "footer { max-width: 850px; margin: 0 auto 30px; padding: 0 20px; color: #46566a; font-size: .92rem; }",
  "footer a { margin-right: 20px; }",
  "@media (max-width: 600px) { main { margin: 0; padding: 20px; border: 0; border-radius: 0; } }",
  "@media (prefers-color-scheme: dark) {",
  "body { background: #0d1726; color: #e4e9f2; }",
  "main { background: #16253b; border-color: #35445a; }",
  "h1, h2, h3 { color: #a9ceff; }",
  "a { color: #91c4ff; }",
  "code, blockquote { background: #253a58; }",
  "footer { color: #b8c7db; }",
  "}"
].join("\n");

function htmlPage(page, content) {
  const title = escapeHtml(page.title);
  return [
    "<!doctype html>",
    '<html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="description" content="' + title + ' do Brazilian English Journey (BEJ).">',
    '<meta name="robots" content="index, follow">',
    '<link rel="canonical" href="https://bejapp.com.br/' + page.slug + '">',
    "<title>" + title + " | Brazilian English Journey</title>",
    "<style>" + css + "</style></head><body>",
    '<header><a href="/">Brazilian English Journey</a></header>',
    "<main>" + markdownToHtml(content) + "</main>",
    '<footer><a href="/terms">Termos de Uso</a> <a href="/privacy">Política de Privacidade</a> <a href="/">Voltar ao BEJ</a></footer>',
    "</body></html>",
    ""
  ].join("\n");
}

for (const page of pages) {
  const content = await readFile(join(process.cwd(), page.source), "utf8");
  const destination = join(process.cwd(), "public", page.slug + ".html");
  await writeFile(destination, htmlPage(page, content), "utf8");
  console.log("Generated " + destination + " from " + page.source);
}
