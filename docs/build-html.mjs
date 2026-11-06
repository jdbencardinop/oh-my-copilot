import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Marked, Renderer } from "marked";

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = [
  { source: "landscape.md", output: "index.html", title: "Landscape overview" },
  { source: "research/01-omp-ecosystem.md", output: "omp-ecosystem.html", title: "OMP and enhancement layers" },
  { source: "research/02-native-harnesses.md", output: "native-harnesses.html", title: "Native harness capabilities" },
  { source: "research/03-oss-projects.md", output: "oss-projects.html", title: "Open-source tools to study" },
  { source: "research/04-orchestrators.md", output: "orchestrators.html", title: "Managers and orchestrators" },
];
const escape = (text) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const css = `
:root{color-scheme:light dark;--background:light-dark(#f7f8fb,#11151d);--foreground:light-dark(#202c40,#e3e9f4);--muted:light-dark(#52617a,#acb9cc);--card:light-dark(#fff,#192231);--border:light-dark(#d5ddea,#344158);--primary:light-dark(#234db6,#9bbaff);--radius:12px;--font-sans:system-ui,sans-serif;--font-mono:ui-monospace,monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}
body{margin:0;background:var(--background);color:var(--foreground);font:17px/1.7 var(--font-sans)}
a{color:var(--primary);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}
a:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.skip{position:absolute;left:12px;top:-80px;background:var(--card);padding:10px;z-index:2}.skip:focus{top:12px}
.layout{display:grid;grid-template-columns:255px minmax(0,1fr);gap:38px;max-width:1600px;margin:auto;padding:30px}
aside{position:sticky;top:24px;align-self:start;max-height:calc(100dvh - 48px);overflow:auto;font-size:14px}
aside strong{display:block;margin-bottom:12px}nav a{display:block;padding:7px 10px;border-radius:6px}
nav a[aria-current=page]{background:var(--card);font-weight:700}
summary{cursor:pointer;font-weight:650;margin-top:24px}ol.toc{padding-left:22px}.toc li{margin:7px 0}
main{min-width:0}article{max-width:1100px}.meta{color:var(--muted);font-size:14px}
h1,h2,h3,h4{line-height:1.25;scroll-margin-top:24px}h1{font-size:clamp(30px,4vw,46px);margin:18px 0 24px}
h2{font-size:27px;margin:50px 0 18px;border-bottom:1px solid var(--border);padding-bottom:10px}
h3{font-size:22px;margin-top:32px}p,ul,ol{max-width:85ch}li{margin:7px 0}
blockquote{border-left:4px solid var(--primary);margin:24px 0;padding:12px 20px;background:var(--card);border-radius:0 var(--radius) var(--radius) 0}
blockquote p{margin:8px 0}code{font:0.88em var(--font-mono);overflow-wrap:anywhere;background:var(--card);padding:2px 5px;border-radius:4px}
pre{background:var(--card);padding:18px;border:1px solid var(--border);border-radius:var(--radius);overflow:auto}pre code{padding:0;white-space:pre}
.table-scroll{overflow:auto;max-height:75dvh;border:1px solid var(--border);border-radius:var(--radius);margin:24px 0}
table{border-collapse:collapse;min-width:100%;font-size:14px;line-height:1.55}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--border);min-width:155px}
th{position:sticky;top:0;background:var(--card);z-index:1}tr:last-child td{border-bottom:0}td p{margin:0}
hr{border:0;border-top:1px solid var(--border);margin:32px 0}img{max-width:100%}footer{margin-top:50px;padding:24px 0;border-top:1px solid var(--border);font-size:14px;color:var(--muted)}
@media(max-width:850px){.layout{grid-template-columns:minmax(0,1fr);padding:18px;gap:12px}aside{position:static;max-height:none}nav{display:flex;flex-wrap:wrap;gap:4px}aside details{margin-bottom:20px}h2{font-size:24px}}
@media print{aside,.skip,.meta{display:none}.layout{display:block;padding:0}body{font-size:11pt;background:white;color:black}.table-scroll{max-height:none;overflow:visible}table{font-size:8pt}th{position:static}a{color:inherit}h2,h3{break-after:avoid}}
`;

await mkdir(path.join(root, "html"), { recursive: true });

for (const page of pages) {
  const headings = [];
  const usedIds = new Set();
  const renderer = new Renderer();
  const defaultTable = renderer.table;
  renderer.html = ({ text }) => escape(text);
  renderer.heading = function ({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const label = content.replace(/<[^>]+>/g, "");
    const base = label.toLowerCase().replace(/&[^;]+;/g, "").replace(/[^\p{L}\p{N}_ -]/gu, "").replace(/ /g, "-") || "section";
    let id = base;
    for (let count = 1; usedIds.has(id); count++) id = `${base}-${count}`;
    usedIds.add(id);
    if (depth === 2) headings.push({ label, id });
    return `<h${depth} id="${escape(id)}">${content}</h${depth}>\n`;
  };
  renderer.table = function (token) {
    return `<div class="table-scroll" role="region" aria-label="Comparison table" tabindex="0">${defaultTable.call(this, token)}</div>`;
  };
  renderer.link = function ({ href, title, tokens }) {
    let target = href;
    if (!/^[a-z][a-z\d+.-]*:|^#|^\/\//i.test(href)) {
      const [file, fragment] = href.split("#");
      const absolute = path.resolve(root, path.dirname(page.source), file);
      const destination = pages.find((candidate) => path.join(root, candidate.source) === absolute);
      target = destination
        ? destination.output
        : path.relative(path.join(root, "html"), absolute).split(path.sep).join("/");
      if (fragment !== undefined) target += `#${fragment}`;
    }
    if (/^\s*(javascript|data|vbscript):/i.test(target)) throw new Error(`Unsafe link in ${page.source}`);
    return `<a href="${escape(target)}"${title ? ` title="${escape(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
  };
  const markdown = await readFile(path.join(root, page.source), "utf8");
  const body = new Marked({ renderer, gfm: true }).parse(markdown);
  const navigation = pages.map((item) => `<a href="${item.output}"${item === page ? ' aria-current="page"' : ""}>${escape(item.title)}</a>`).join("");
  const toc = headings.map(({ id, label }) => `<li><a href="#${escape(id)}">${label}</a></li>`).join("");
  const source = path.relative(path.join(root, "html"), path.join(root, page.source)).split(path.sep).join("/");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(page.title)} | OMC research</title><style>${css}</style></head>
<body><a class="skip" href="#content">Skip to report</a><div class="layout">
<aside><strong>Oh-my-copilot research</strong><nav aria-label="Reports">${navigation}</nav>
<details open><summary>On this page</summary><ol class="toc">${toc}</ol></details></aside>
<main id="content" tabindex="-1"><p class="meta">Research snapshot: November 2026 · <a href="${escape(source)}">Markdown source</a></p>
<article>${body}</article><footer>Documentation claims are not compatibility tests. Source links and uncertainty labels are preserved from the Markdown reports. Rebuild with <code>npm run docs:html</code>.</footer>
</main></div></body></html>\n`;
  await writeFile(path.join(root, "html", page.output), html);
  console.log(`docs/html/${page.output}`);
}
