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
  it("handles different headings with colliding generated slugs", async () => {
    const result = await renderMarkdown("# Part\n# Part-1\n# Part", "/tmp/test.md", { toc: true, numberSections: false });
    expect(result.headings.map(h => h.id)).toEqual(["part", "part-1", "part-2"]);
  });
  it("preserves author-numbered sections without duplicating prefixes", async () => {
    const source = [
      "# UWB System Specification",
      "## 1. Purpose",
      "### 1.1 Introduction",
      "## 2. Network ports",
      "# Part I — Wire Protocol",
      "## 3. Generic header",
    ].join("\n");
    const result = await renderMarkdown(source, "/tmp/spec.md", { toc: true, numberSections: true });
    expect(result.html).toContain("1. Purpose");
    expect(result.html).toContain("1.1 Introduction");
    expect(result.html).not.toContain("1.1 1. Purpose");
    expect(result.html).not.toContain("1.1.1 1.1 Introduction");
    expect(result.html).not.toContain("1 UWB System Specification");
    expect(result.html).toContain('href="#1-purpose"');
  });
  it("still numbers headings when a year-prefixed title is not a section number", async () => {
    const result = await renderMarkdown("# 2026 Roadmap\n## Milestones", "/tmp/roadmap.md",
      { toc: false, numberSections: true });
    expect(result.html).toContain("1 2026 Roadmap");
    expect(result.html).toContain("1.1 Milestones");
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
