import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import katex from "katex";
import { tex } from "@mdit/plugin-tex";
import type MarkdownIt from "markdown-it";

const require = createRequire(import.meta.url);

export function renderMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source.trim(), {
      displayMode, output: "htmlAndMathml", trust: false,
      throwOnError: true, strict: "warn", maxExpand: 1000, maxSize: 50,
      macros: {},
    });
  } catch (error) {
    throw new Error("Invalid or unsupported TeX math: " +
      (error instanceof Error ? error.message : String(error)), { cause: error });
  }
}

export function enableMath(md: MarkdownIt): void {
  md.use(tex, { delimiters: "all", mathFence: true, allowInlineWithSpace: false, render: renderMath });
  // The upstream dollar block parser can consume the rest of a document
  // without a closing marker. Reject that case instead of losing text.
  md.core.ruler.after("block", "check_closed_math", state => {
    const lines = state.src.split("\n");
    for (const token of state.tokens) {
      if (token.type !== "math_block" || token.markup !== "$$" || !token.map) continue;
      const [start, end] = token.map;
      const last = (lines[end - 1] ?? "").trimEnd();
      if (!last.endsWith("$$") || (end === start + 1 && !last.slice(0, -2).includes("$$"))) {
        throw new Error("Unclosed $$ math block at line " + (start + 1));
      }
    }
  });
  // Treat a bare latex fence as a display equation, just like a math fence.
  // Other fence labels (including tex) still render as source code.
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, self) =>
    tokens[index]!.info.trim() === "latex"
      ? renderMath(tokens[index]!.content, true)
      : fence(tokens, index, options, env, self);
}

// Chromium is intentionally offline and cannot load package-relative fonts.
// Embed every font reference in KaTeX's installed stylesheet as a data URI.
export async function mathStylesheet(): Promise<string> {
  const cssPath = require.resolve("katex/dist/katex.min.css");
  const css = await readFile(cssPath, "utf8");
  const urls = [...css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)];
  const assets = new Map<string, string>();
  for (const match of urls) {
    const url = match[2]!.trim();
    if (assets.has(url)) continue;
    if (!/^fonts\/[A-Za-z0-9_.-]+\.(?:woff2|woff|ttf)$/.test(url)) {
      throw new Error("Unexpected KaTeX stylesheet asset: " + url);
    }
    const extension = path.extname(url).slice(1);
    const data = await readFile(path.join(path.dirname(cssPath), url));
    assets.set(url, "data:font/" + extension + ";base64," + data.toString("base64"));
  }
  if (!assets.size) throw new Error("KaTeX stylesheet contains no math fonts");
  return css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g,
    (_match, _quote, url: string) => 'url("' + assets.get(url.trim()) + '")');
}
