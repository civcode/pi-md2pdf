import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { renderMarkdown } from "../src/core/markdown.js";
import { buildHtml } from "../src/core/convert.js";
import { renderMath } from "../src/core/math.js";
const opts = { toc: false, numberSections: false };
const fixture = new URL("./fixtures/mathtest.md", import.meta.url);
describe("offline TeX math", () => {
  it("renders all math forms in the original probe and preserves Unicode and code", async () => {
    const result = await renderMarkdown(await readFile(fixture, "utf8"), "/tmp/math.md", opts);
    expect(result.html.match(/class="katex-display"/g)).toHaveLength(4);
    expect(result.html.match(/class="katex"/g)).toHaveLength(7);
    expect(result.html).toContain("π·√(R/g_s)");
    expect(result.html).toContain("T = pi * sqrt(R/g_s)");
  });
  it("renders bracket inline math, multiline matrices and math in TOC headings", async () => {
    const source = [
      String.raw`# Energy \(E=mc^2\)`, "",
      "$$", String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`, "$$", "",
      "| Value |", "| --- |", String.raw`| $\frac{1}{2}$ |`,
    ].join("\n");
    const result = await renderMarkdown(source, "/tmp/math.md", { ...opts, toc: true });
    expect(result.html.match(/class="katex"/g)).toHaveLength(4);
    expect(result.html).toContain("katex-display");
    expect(result.html).toContain("<table>");
    expect(result.html.split("</nav>")[0]).toContain('class="katex"');
  });
  it("keeps prices, escaped dollars, inline code and ordinary fenced source literal", async () => {
    const source = [String.raw`Costs $20 and $30; literal \$x\$.`, "",
      "`$x$`", "", "```tex", String.raw`\frac{a}{b}`, "```", "",
      "```js", 'const price = "$5";', "```"].join("\n");
    const result = await renderMarkdown(source, "/tmp/math.md", opts);
    expect(result.html).not.toContain('class="katex"');
    expect(result.html).toContain("$20 and $30");
    expect(result.html).toContain("<code>$x$</code>");
  });
  it("reports unsupported expressions and prevents trusted TeX commands", async () => {
    await expect(renderMarkdown(String.raw`$\notARealCommand$`, "/tmp/math.md", opts))
      .rejects.toThrow("Invalid or unsupported TeX math");
    expect(renderMath(String.raw`\href{https://example.com}{x}`, false)).not.toContain('href="https://example.com"');
  });
  it("rejects unclosed dollar display math instead of swallowing following content", async () => {
    await expect(renderMarkdown("$$\\n x^2\\n\\n# Later heading".replace(/\\n/g, "\n"), "/tmp/math.md", opts))
      .rejects.toThrow("Unclosed $$ math block");
  });
  it("embeds fonts in math HTML without enabling remote assets", async () => {
    const html = await buildHtml(String.raw`$\sqrt{x}$`, "/tmp/math.md", opts);
    expect(html).toContain("data:font/woff2;base64,");
    expect(html).not.toMatch(/url\(["\']?fonts\//);
    expect(html).not.toContain("<script");
    expect(await buildHtml("No equations.", "/tmp/plain.md", opts)).not.toContain("data:font/woff2;base64,");
  });
});
