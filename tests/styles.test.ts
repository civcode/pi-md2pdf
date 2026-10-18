import { describe, expect, it } from "vitest";
import { buildHtml } from "../src/core/convert.js";

describe("stylesheet loading", () => {
  it("includes GitHub Light and project print CSS when run from TypeScript sources", async () => {
    const html = await buildHtml("# PDF style check", "/tmp/example.md", {
      toc: false,
      numberSections: false,
    });

    expect(html).toContain('class="markdown-body"');
    expect(html).toContain("PDF style check");
    expect(html).toContain("print-color-adjust");
    expect(html).toContain(".markdown-body table");
    expect(html).toContain("font-size: 13.2px; line-height: 1.5;");
    expect(html).toContain(".markdown-body pre code { font-size: 100%; }");
  });
});
