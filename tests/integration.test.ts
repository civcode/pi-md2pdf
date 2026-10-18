import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkBrowser, convertMarkdownToPdf } from "../src/core/convert.js";
import { resolveBrowser } from "../src/core/browser.js";

const available = (() => { try { resolveBrowser(); return true; } catch { return false; } })();
describe.skipIf(!available)("headless PDF rendering (requires installed Chromium)", () => {
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
