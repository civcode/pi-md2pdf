import { describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../src/core/markdown.js";
import { localMermaidModule, normalizeMermaidSource, validateMermaidSource, MermaidDiagramError } from "../src/core/mermaid.js";
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
    const renderMermaid = vi.fn().mockRejectedValue(new MermaidDiagramError("parse failed"));
    await expect(renderMarkdown("# Heading\n\n" + block, "/tmp/bad.md", { ...opts, renderMermaid, mermaidErrors: "strict" }))
      .rejects.toThrow("Mermaid diagram at line 3: parse failed");
  });
  it("defaults to diagnostics plus escaped original source and continues in order", async () => {
    const bad = "flowchart LR\nA[<script>alert(1)</script>]";
    const renderMermaid = vi.fn()
      .mockResolvedValueOnce(svg)
      .mockRejectedValueOnce(new MermaidDiagramError("<bad>"))
      .mockResolvedValueOnce(svg);
    const source = block + "\n\n" + "\x60\x60\x60mermaid\n" + bad + "\n\x60\x60\x60\n\n" + block;
    const result = await renderMarkdown(source, "/tmp/test.md", { ...opts, renderMermaid });
    expect(result.mermaidDiagnostics).toEqual([{ line: 6, message: "<bad>" }]);
    expect(result.html).toContain("md2pdf-mermaid-error");
    expect(result.html).toContain("&lt;bad&gt;");
    expect(result.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.html.match(/class="md2pdf-mermaid"/g)).toHaveLength(2);
    const first = result.html.indexOf('class="md2pdf-mermaid"');
    const failure = result.html.indexOf('class="md2pdf-mermaid-error"');
    expect(first).toBeLessThan(failure);
    expect(result.html.lastIndexOf('class="md2pdf-mermaid"')).toBeGreaterThan(failure);
  });
  it("source mode preserves source without a visible diagnostic; returns diagnostics", async () => {
    const renderMermaid = vi.fn().mockRejectedValue(new MermaidDiagramError("invalid"));
    const result = await renderMarkdown(block, "/tmp/bad.md", { ...opts, renderMermaid, mermaidErrors: "source" });
    expect(result.html).toContain("md2pdf-mermaid-source");
    expect(result.html).toContain("flowchart LR");
    expect(result.html).not.toContain("md2pdf-mermaid-error");
    expect(result.html).not.toContain("invalid");
    expect(result.mermaidDiagnostics).toEqual([{ line: 1, message: "invalid" }]);
  });
  it("never falls back on untyped browser or resource failures", async () => {
    for (const mode of ["strict", "placeholder", "source"] as const) {
      const renderMermaid = vi.fn().mockRejectedValue(new Error("Target closed"));
      await expect(renderMarkdown(block, "/tmp/bad.md", { ...opts, renderMermaid, mermaidErrors: mode }))
        .rejects.toThrow("Target closed");
      const oversized = "\x60\x60\x60mermaid\n" + "x".repeat(50_001) + "\n\x60\x60\x60";
      await expect(renderMarkdown(oversized, "/tmp/bad.md", { ...opts, renderMermaid, mermaidErrors: mode }))
        .rejects.toThrow("source limit");
    }
  });
  it("accepts bounded hand-drawn seeds and explicit SVG-only labels", () => {
    const source = (config: string) => "%%{init: " + config + "}%%\nflowchart LR\nA-->B";
    expect(normalizeMermaidSource(source('{"look":"handDrawn","handDrawnSeed":42,"htmlLabels":false,"flowchart":{"htmlLabels":false}}')))
      .toContain('"handDrawnSeed":42');
    for (const seed of ["-1", "1.5", "2147483648", '"42"']) {
      expect(() => normalizeMermaidSource(source('{"handDrawnSeed":' + seed + '}'))).toThrow("handDrawnSeed");
    }
    for (const config of ['{"htmlLabels":true}', '{"flowchart":{"htmlLabels":true}}']) {
      expect(() => normalizeMermaidSource(source(config))).toThrow("requires native SVG text labels");
    }
  });
  it("rejects configuration overrides, empty or oversized source", () => {
    for (const source of ["%%{init: {securityLevel: loose}}%%\nflowchart LR\nA-->B", "---\nconfig:\n  securityLevel: loose\n---\nflowchart LR\nA-->B", "", "x".repeat(50_001)]) {
      expect(() => validateMermaidSource(source)).toThrow();
    }
  });
  it("accepts titles, safe frontmatter and legacy init configuration", () => {
    const source = "---\ntitle: System architecture\nconfig:\n  theme: neutral\n  flowchart:\n    curve: linear\n---\nflowchart LR\nA-->B";
    const result = normalizeMermaidSource(source);
    expect(result).toContain('"title":"System architecture"');
    expect(result).toContain('"theme":"neutral"');
    expect(result).toContain('"curve":"linear"');
    expect(result).toContain("flowchart LR\nA-->B");
    expect(normalizeMermaidSource("%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#aabbcc'}}}%%\nflowchart LR\nA-->B"))
      .toContain('"primaryColor":"#aabbcc"');
  });
  it("rejects unsafe nested config, unknown keys, CSS, duplicate keys and aliases", () => {
    for (const value of [
      "flowchart: {htmlLabels: true}", "securityLevel: loose", "themeCSS: 'body {color:red}'",
      "themeVariables: {primaryColor: 'url(https://example.com)'}", "secure: []",
      "theme: default\n  theme: dark", "theme: &x neutral\n  look: *x",
      "constructor: {prototype: {polluted: true}}",
    ]) {
      expect(() => normalizeMermaidSource("---\nconfig:\n  " + value + "\n---\nflowchart LR\nA-->B")).toThrow();
    }
  });
  it("only maps local Mermaid JS modules, never external resources", () => {
    expect(localMermaidModule("https://md2pdf-mermaid.invalid/chunks/mermaid.esm.min/chunk-ABC.mjs")).toBe("chunks/mermaid.esm.min/chunk-ABC.mjs");
    expect(localMermaidModule("https://md2pdf-mermaid.invalid/mermaid.esm.min.mjs")).toBe("mermaid.esm.min.mjs");
    for (const url of ["https://md2pdf-mermaid.invalid/other.js", "https://example.com/evil.js", "file:///etc/passwd", "https://md2pdf-mermaid.invalid/%2e%2e%2fsecret.js", "https://md2pdf-mermaid.invalid/other.png", "https://md2pdf-mermaid.invalid/mermaid.esm.min.mjs?remote=1"]) {
      expect(localMermaidModule(url)).toBeUndefined();
    }
  });
  it("requires the isolated renderer and limits diagram count", async () => {
    await expect(renderMarkdown(block, "/tmp/bad.md", opts)).rejects.toThrow("isolated Chromium renderer");
    await expect(renderMarkdown(Array(51).fill(block).join("\n\n"), "/tmp/bad.md", opts)).rejects.toThrow("Too many Mermaid diagrams");
  });
});
