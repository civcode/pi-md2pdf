import { describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../src/core/markdown.js";
import { localMermaidModule, validateMermaidSource } from "../src/core/mermaid.js";
const opts = { toc: false, numberSections: false };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="0" y="20">Diagram</text></svg>';
const block = "```mermaid\nflowchart LR\n  A --> B\n```";
describe("Mermaid Markdown integration", () => {
  it("renders diagram fences as inert SVG images and preserves math and code", async () => {
    const renderMermaid = vi.fn().mockResolvedValue(svg);
    const result = await renderMarkdown(block + "\n\n$x^2$\n\n```text\nflowchart LR\n```", "/tmp/diagram.md", { ...opts, renderMermaid });
    expect(renderMermaid).toHaveBeenCalledWith("flowchart LR\n  A --> B\n");
    expect(result.html).toContain("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"));
    expect(result.html).toContain('class="md2pdf-mermaid"');
    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain("<code>flowchart LR");
    expect(result.html).not.toContain("<svg");
  });
  it("never calls the renderer for documents without Mermaid fences", async () => {
    const renderMermaid = vi.fn();
    await renderMarkdown("# Plain\n\n`mermaid`", "/tmp/plain.md", { ...opts, renderMermaid });
    expect(renderMermaid).not.toHaveBeenCalled();
  });
  it("reports the source line and preserves the original error", async () => {
    const renderMermaid = vi.fn().mockRejectedValue(new Error("parse failed"));
    await expect(renderMarkdown("# Heading\n\n" + block, "/tmp/bad.md", { ...opts, renderMermaid }))
      .rejects.toThrow("Mermaid diagram at line 3: parse failed");
  });
  it("rejects configuration overrides, empty or oversized source", () => {
    for (const source of ["%%{init: {securityLevel: loose}}%%\nflowchart LR\nA-->B", "---\nconfig:\n  securityLevel: loose\n---\nflowchart LR\nA-->B", "", "x".repeat(50_001)]) {
      expect(() => validateMermaidSource(source)).toThrow();
    }
  });
  it("only maps local Mermaid JS modules, never external resources", () => {
    expect(localMermaidModule("https://md2pdf-mermaid.invalid/chunks/mermaid.esm.min/chunk-ABC.mjs")).toBe("chunks/mermaid.esm.min/chunk-ABC.mjs");
    for (const url of ["https://example.com/evil.js", "file:///etc/passwd", "https://md2pdf-mermaid.invalid/%2e%2e%2fsecret.js", "https://md2pdf-mermaid.invalid/other.png", "https://md2pdf-mermaid.invalid/mermaid.esm.min.mjs?remote=1"]) {
      expect(localMermaidModule(url)).toBeUndefined();
    }
  });
  it("requires the isolated renderer and limits diagram count", async () => {
    await expect(renderMarkdown(block, "/tmp/bad.md", opts)).rejects.toThrow("isolated Chromium renderer");
    await expect(renderMarkdown(Array(51).fill(block).join("\n\n"), "/tmp/bad.md", opts)).rejects.toThrow("Too many Mermaid diagrams");
  });
});
