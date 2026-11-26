import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import Token from "markdown-it/lib/token.mjs";
import { inlineLocalImages } from "./assets.js";
import { enableMath, renderMath } from "./math.js";
import { MERMAID_LIMITS, validateMermaidSource, MermaidDiagramError, type MermaidDiagnostic } from "./mermaid.js";
import { DEFAULTS, parseMermaidErrorMode, type MermaidErrorMode } from "./options.js";

export interface RenderOptions {
  toc: boolean; numberSections: boolean;
  renderMermaid?: (source: string) => Promise<string>;
  mermaidErrors?: MermaidErrorMode;
}
export interface RenderResult { html: string; headings: { level: number; title: string; id: string }[]; mermaidDiagnostics: MermaidDiagnostic[] }

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
enableMath(md);
md.renderer.rules.mermaid_image = (tokens, index) =>
  '<figure class="md2pdf-mermaid"><img alt="Mermaid diagram" src="' +
  escapeHtml(tokens[index]!.content) + '"></figure>\n';
md.renderer.rules.mermaid_source = (tokens, index) =>
  '<pre class="md2pdf-mermaid-source"><code>' + escapeHtml(tokens[index]!.content) + '</code></pre>\n';
md.renderer.rules.mermaid_failure = (tokens, index) => {
  const token = tokens[index]!;
  const diagnostic = token.meta as MermaidDiagnostic;
  return '<aside class="md2pdf-mermaid-error" role="note"><strong>Mermaid rendering failed (line ' +
    diagnostic.line + ')</strong><p>' + escapeHtml(diagnostic.message) +
    '</p></aside>\n<pre class="md2pdf-mermaid-source"><code>' + escapeHtml(token.content) + '</code></pre>\n';
};
export async function renderMarkdown(source: string, input: string, opts: RenderOptions): Promise<RenderResult> {
  const env = {};
  const tokens = md.parse(source, env);
  const used = new Set<string>();
  const counters = [0, 0, 0, 0, 0, 0];
  const headings: RenderResult["headings"] = [];
  const tocTitles = new Map<string, string>();
  // Existing structured section numbers belong to the author, not the converter.
  // If a document is already numbered, adding generated prefixes would produce
  // headings such as "1.1 1. Purpose" and obscure the original organization.
  const hasExistingNumbering = tokens.some((token, index) =>
    token.type === "heading_open" && tokens[index + 1]?.type === "inline" &&
    /^\s*(?:\d+\.\s+|\d+(?:\.\d+)+\.?\s+)\S/.test(tokens[index + 1]!.content),
  );
  const autoNumber = opts.numberSections && !hasExistingNumbering;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== "heading_open") continue;
    const inline = tokens[i + 1];
    if (!inline || inline.type !== "inline") continue;
    const level = Number(token.tag.slice(1));
    const title = inline.content;
    const base = slug(title);
    let id = base, suffix = 1;
    while (used.has(id)) id = base + "-" + suffix++;
    used.add(id);
    token.attrSet("id", id);
    headings.push({ level, title, id });
    // Render math in TOC titles without introducing nested links or raw HTML.
    if (opts.toc && inline.children?.some(child => child.type === "math_inline")) {
      tocTitles.set(id, inline.children.map(child =>
        child.type === "math_inline" ? renderMath(child.content, false) :
        child.type === "softbreak" || child.type === "hardbreak" ? " " :
        child.nesting === 0 ? escapeHtml(child.content) : "",
      ).join(""));
    }
    if (autoNumber && level >= 1 && level <= 6) {
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
  const diagrams = tokens.filter(t => t.type === "fence" && t.info.trim() === "mermaid");
  if (diagrams.length > MERMAID_LIMITS.diagrams) throw new Error("Too many Mermaid diagrams (maximum 50)");
  let diagramBytes = 0;
  const mermaidDiagnostics: MermaidDiagnostic[] = [];
  const mode = parseMermaidErrorMode(opts.mermaidErrors ?? DEFAULTS.mermaidErrors);
  for (const token of diagrams) {
    const line = (token.map?.[0] ?? 0) + 1;
    try {
      validateMermaidSource(token.content);
      if (!opts.renderMermaid) throw new Error("Mermaid requires the isolated Chromium renderer");
      const svg = await opts.renderMermaid(token.content);
      const bytes = Buffer.from(svg, "utf8");
      if (bytes.length > MERMAID_LIMITS.svg) throw new Error("Mermaid SVG exceeds size limit");
      diagramBytes += bytes.length;
      if (diagramBytes > MERMAID_LIMITS.total) throw new Error("Mermaid diagrams exceed total size limit");
      token.type = "mermaid_image";
      token.content = "data:image/svg+xml;base64," + bytes.toString("base64");
    } catch (error) {
      // Only explicitly typed, document-local errors qualify for fallback.
      const message = error instanceof Error ? error.message : String(error);
      if (!(error instanceof MermaidDiagramError) || mode === "strict") {
        throw new Error("Mermaid diagram at line " + line + ": " + message, { cause: error });
      }
      const diagnostic = { line, message };
      mermaidDiagnostics.push(diagnostic);
      token.type = mode === "placeholder" ? "mermaid_failure" : "mermaid_source";
      token.meta = diagnostic;
      // Original source remains intact and is escaped by the fallback renderer.
    }
  }
  const body = md.renderer.render(tokens, md.options, env);
  const toc = opts.toc && headings.length
    ? '<nav class="md2pdf-toc" aria-label="Table of contents"><h2>Table of contents</h2><ul>' +
      headings.map(h => '<li class="toc-level-' + h.level + '"><a href="#' + encodeURIComponent(h.id) + '">' + (tocTitles.get(h.id) ?? escapeHtml(h.title)) + "</a></li>").join("") + "</ul></nav>"
    : "";
  return { html: toc + body, headings, mermaidDiagnostics };
}
