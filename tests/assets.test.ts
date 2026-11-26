import { describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderMarkdown } from "../src/core/markdown.js";

describe("offline local image policy", () => {
  it("inlines a PNG without a remote resource URL", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "md2pdf-image-"));
    try {
      const doc = path.join(base, "report.md");
      await writeFile(doc, "# Report");
      await writeFile(path.join(base, "one.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxnwAAAABJRU5ErkJggg==", "base64"));
      const result = await renderMarkdown("![Logo](one.png)", doc, { toc: false, numberSections: false });
      expect(result.html).toContain("data:image/png;base64,");
      expect(result.html).not.toContain("https://");
    } finally { await rm(base, { recursive: true, force: true }); }
  });
  it.skipIf(process.platform === "win32")("rejects symlink traversal outside the Markdown directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-symlink-"));
    try {
      const dir = path.join(root, "sub");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dir);
      const doc = path.join(dir, "doc.md");
      await writeFile(doc, "# Document");
      const outside = path.join(root, "outside.png");
      await writeFile(outside, Buffer.from("png"));
      await symlink(outside, path.join(dir, "link.png"));
      await expect(renderMarkdown("![secret](link.png)", doc, { toc: false, numberSections: false }))
        .rejects.toThrow("escapes Markdown directory");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
