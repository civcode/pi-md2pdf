import { describe, expect, it } from "vitest";
import { formatMd2pdfCall, formatMd2pdfResult } from "../src/ui/display.js";

describe("Pi tool argument and result display", () => {
  it("shows the source and conservative defaults without inventing options", () => {
    expect(formatMd2pdfCall({ input: "report.md" }))
      .toBe("report.md  [A4 · no TOC · preserve numbering]");
  });
  it("shows an explicit output and requested options", () => {
    expect(formatMd2pdfCall({
      input: "docs/report.md", output: "build/report.pdf", paper: "letter",
      toc: true, numberSections: true, overwrite: true,
    })).toBe("docs/report.md → build/report.pdf  [LETTER · TOC · number sections · overwrite authorized]");
  });
  it("displays the actual collision-free output filename", () => {
    const details = {
      input: "/project/report.md",
      output: "/project/report-3.pdf",
      bytes: 1560003,
      browser: "/usr/bin/chromium",
    };
    expect(formatMd2pdfResult(details, "fallback")).toBe("Created report-3.pdf (1523.4 KiB)");
    const expanded = formatMd2pdfResult(details, "fallback", true);
    expect(expanded).toContain("Output: /project/report-3.pdf");
    expect(expanded).toContain("Input: /project/report.md");
    expect(expanded).toContain("Browser: /usr/bin/chromium");
  });
  it("handles progress, errors, and missing details without crashing", () => {
    expect(formatMd2pdfResult({ status: "rendering" }, "fallback"))
      .toBe("Rendering Markdown PDF…");
    expect(formatMd2pdfResult(undefined, "Permission denied")).toBe("Permission denied");
    expect(formatMd2pdfResult({ output: null }, "Failed")).toBe("Failed");
  });
});
