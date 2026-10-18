import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import Token from "markdown-it/lib/token.mjs";
import { inlineLocalImages } from "./assets.js";

export interface RenderOptions { toc: boolean; numberSections: boolean }
export interface RenderResult { html: string; headings: { level: number; title: string; id: string }[] }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function slug(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
}
const md = new MarkdownIt({
  html: false, linkify: true, typographer: false,
  highlight(code, lang) {
    let highlighted: string;
    try { highlighted = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : escapeHtml(code); }
    catch { highlighted = escapeHtml(code); }
    return '<pre class="hljs"><code>' + highlighted + "</code></pre>";
  },
});
export async function renderMarkdown(source: string, input: string, opts: RenderOptions): Promise<RenderResult> {
  const env = {};
  const tokens = md.parse(source, env);
  const used = new Map<string, number>();
  const counters = [0, 0, 0, 0, 0, 0];
  const headings: RenderResult["headings"] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== "heading_open") continue;
    const inline = tokens[i + 1];
    if (!inline || inline.type !== "inline") continue;
    const level = Number(token.tag.slice(1));
    const title = inline.content;
    const base = slug(title), seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen ? base + "-" + seen : base;
    token.attrSet("id", id);
    headings.push({ level, title, id });
    if (opts.numberSections && level >= 1 && level <= 6) {
      counters[level - 1]!++;
      counters.fill(0, level);
      const number = counters.slice(0, level).filter(n => n > 0).join(".");
      const label = new Token("text", "", 0); label.content = number + " ";
      inline.children?.unshift(label);
    }
  }
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      if (child.type !== "link_open") continue;
      const href = child.attrGet("href") ?? "";
      if (!/^(https?:\/\/|mailto:|#)/i.test(href)) throw new Error("Unsupported hyperlink target: " + href);
    }
  }
  await inlineLocalImages(tokens, input);
  const body = md.renderer.render(tokens, md.options, env);
  const toc = opts.toc && headings.length
    ? '<nav class="md2pdf-toc" aria-label="Table of contents"><h2>Table of contents</h2><ul>' +
      headings.map(h => '<li class="toc-level-' + h.level + '"><a href="#' + encodeURIComponent(h.id) + '">' + escapeHtml(h.title) + "</a></li>").join("") + "</ul></nav>"
    : "";
  return { html: toc + body, headings };
}
