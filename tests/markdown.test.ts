import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderMarkdown } from "../src/core/markdown.js";
describe("Markdown HTML", () => {
  it("renders headings, unique anchors, numbering and TOC", async () => {
    const result = await renderMarkdown("# Intro\n\n## Part\n\n## Part", "/tmp/test.md",
      { toc: true, numberSections: true });
    expect(result.html).toContain('href="#part"');
    expect(result.html).toContain('href="#part-1"');
    expect(result.html).toContain("1.1 Part");
  });
  it("escapes raw HTML", async () => {
    const result = await renderMarkdown("<script>alert(1)</script>", "/tmp/test.md",
      { toc: false, numberSections: false });
    expect(result.html).not.toContain("<script>");
  });
  it("rejects remote and traversing images", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-assets-"));
    try {
      const file = path.join(dir, "doc.md");
      await writeFile(file, "# Document");
      await expect(renderMarkdown("![x](https://example.com/x.png)", file, { toc: false, numberSections: false }))
        .rejects.toThrow("Only local");
      await expect(renderMarkdown("![x](../etc/passwd)", file, { toc: false, numberSections: false }))
        .rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
