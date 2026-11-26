import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkBrowser, convertMarkdownToPdf } from "../src/core/convert.js";
import { resolveBrowser } from "../src/core/browser.js";
import puppeteer from "puppeteer-core";
import { createMermaidRenderer } from "../src/core/mermaid.js";

// Mermaid may split labels into several nested SVG tspan elements. Check
// the text of each SVG text element rather than its serialized markup.
function svgLabels(svg: string): string[] {
  return Array.from(svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g), match =>
    match[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

const available = (() => { try { resolveBrowser(); return true; } catch { return false; } })();
describe.skipIf(!available)("headless PDF rendering (requires installed Chromium)", () => {
  it("renders a Mermaid diagram to valid SVG inside a separate context", async () => {
    const browser = await puppeteer.launch({ executablePath: resolveBrowser(), headless: true });
    try {
      const renderer = await createMermaidRenderer(browser, 30_000);
      try {
        const svg = await renderer.render("flowchart LR\n  A[Start] --> B[Finish]");
        expect(svg).toContain("<svg");
        expect(svgLabels(svg)).toContain("Start");
        expect(svgLabels(svg)).toContain("Finish");
        expect(svg).not.toMatch(/<script|<foreignObject/i);
        const second = await renderer.render("sequenceDiagram\n  Alice->>Bob: Second diagram");
        expect(svgLabels(second)).toContain("Second diagram");
        const configured = await renderer.render("---\ntitle: Configured flow\nconfig:\n  theme: neutral\n  flowchart:\n    curve: linear\n---\nflowchart LR\nA[Configured start] --> B[Configured end]");
        expect(svgLabels(configured)).toEqual(expect.arrayContaining(["Configured start", "Configured end", "Configured flow"]));
        expect(configured).not.toMatch(/<script|<foreignObject/i);
        const legacy = await renderer.render("%%{init: {'theme':'base'}}%%\nflowchart LR\nA[Legacy configuration] --> B");
        expect(svgLabels(legacy)).toContain("Legacy configuration");
        await expect(renderer.render("not a Mermaid diagram")).rejects.toThrow();
      } finally { await renderer.close(); }
    } finally { await browser.close(); }
  }, 90_000);
  it("prints Mermaid diagrams and math together and rejects invalid diagrams", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-mermaid-"));
    try {
      const input = path.join(dir, "mermaidtest.md");
      const output = path.join(dir, "mermaidtest.pdf");
      await writeFile(input, await readFile(new URL("./fixtures/mermaidtest.md", import.meta.url)));
      await convertMarkdownToPdf({ input, output, toc: true, timeoutMs: 120_000 });
      const pdf = await readFile(output);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toMatch(/KaTeX[_-]/);
      const bad = path.join(dir, "bad.md");
      const badPdf = path.join(dir, "bad.pdf");
      await writeFile(bad, "```mermaid\nnot a diagram\n```");
      await expect(convertMarkdownToPdf({ input: bad, output: badPdf })).rejects.toThrow("Mermaid diagram at line 1");
      await expect(readFile(badPdf)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 180_000);
  it("prints the math probe with locally embedded fonts", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-math-"));
    try {
      const input = path.join(dir, "mathtest.md");
      const output = path.join(dir, "mathtest.pdf");
      await writeFile(input, await readFile(new URL("./fixtures/mathtest.md", import.meta.url)));
      await convertMarkdownToPdf({ input, output });
      const pdf = await readFile(output);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toMatch(/KaTeX[_-]/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 90_000);
  it("starts browser and generates a real PDF", async () => {
    const check = await checkBrowser();
    expect(check.pdfBytes).toBeGreaterThan(200);
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-pdf-"));
    try {
      const input = path.join(dir, "demo.md");
      const output = path.join(dir, "demo.pdf");
      await writeFile(input, "# Demo\n\n| One | Two |\n|---|---|\n| 1 | 2 |");
      await convertMarkdownToPdf({ input, output, toc: true, numberSections: true });
      const pdf = await readFile(output);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      await expect(convertMarkdownToPdf({ input, output })).rejects.toThrow("exists");
      const implicit = await convertMarkdownToPdf({ input });
      const numbered = await convertMarkdownToPdf({ input });
      expect(implicit.output).toBe(path.join(dir, "demo-2.pdf"));
      expect(numbered.output).toBe(path.join(dir, "demo-3.pdf"));
      expect((await readFile(implicit.output)).subarray(0, 5).toString()).toBe("%PDF-");
      expect((await readFile(numbered.output)).subarray(0, 5).toString()).toBe("%PDF-");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 90_000);
});
