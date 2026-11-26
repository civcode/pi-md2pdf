import { describe, expect, it } from "vitest";
import { HELP, PI_HELP, parseArgs, tokenizeCommand } from "../src/core/argv.js";
import { DEFAULTS } from "../src/core/options.js";
describe("command arguments", () => {
  it("leaves absent CLI options unset for shared normalization", () => {
    const parsed = parseArgs(["report.md"]);
    expect(parsed.options).toEqual({ input: "report.md" });
    expect(HELP).toContain(`default: ${DEFAULTS.paper}`);
    expect(HELP).toContain(`default: ${DEFAULTS.toc}`);
    expect(HELP).toContain(`default: ${DEFAULTS.numberSections}`);
    expect(HELP).toContain(`default: ${DEFAULTS.overwrite}`);
    expect(HELP).toContain(DEFAULTS.theme);
    expect(HELP).toContain("input-2.pdf, input-3.pdf");
    expect(HELP).toContain("fail if occupied");
  });
  it("parses CLI flags", () => {
    const args = parseArgs(["report.md", "-o", "report.pdf", "--toc", "--paper", "letter", "--number-sections"]);
    expect(args.options).toMatchObject({ input: "report.md", output: "report.pdf", paper: "letter", toc: true, numberSections: true });
  });
  it("accepts -o for the CLI but rejects it for the Pi slash command", () => {
    expect(parseArgs(["report.md", "-o", "cli.pdf"]).options.output).toBe("cli.pdf");
    expect(() => parseArgs(["report.md", "-o", "pi.pdf"], true, false))
      .toThrow(/Unknown option: -o/);
    expect(parseArgs(["report.md", "--output", "pi.pdf"], true, false).options.output)
      .toBe("pi.pdf");
    expect(parseArgs(["report.md", "pi.pdf"], true, false).options.output)
      .toBe("pi.pdf");
    expect(PI_HELP).toContain("--output PATH");
    expect(PI_HELP).not.toMatch(/(?:^|\s)-o(?:\s|,|$)/);
    expect(HELP).toContain("-o, --output");
  });

  it("parses Mermaid policies for CLI and Pi", () => {
    for (const mode of ["strict", "placeholder", "source"]) {
      expect(parseArgs(["report.md", "--mermaid-errors", mode]).options.mermaidErrors).toBe(mode);
      expect(parseArgs(["report.md", "--mermaid-errors", mode], true, false).options.mermaidErrors).toBe(mode);
    }
    expect(() => parseArgs(["report.md", "--mermaid-errors", "invalid"])).toThrow("Invalid Mermaid error mode");
    expect(() => parseArgs(["report.md", "--mermaid-errors"])).toThrow("Missing value");
    expect(HELP).toContain("--mermaid-errors");
    expect(PI_HELP).toContain("--mermaid-errors");
  });
  it("supports explicit false overrides for saved preferences", () => {
    expect(parseArgs(["report.md", "--no-toc", "--no-number-sections"], true, false).options)
      .toMatchObject({ toc: false, numberSections: false });
    expect(parseArgs(["report.md", "--toc", "--no-toc"]).options.toc).toBe(false);
    expect(PI_HELP).toContain("/md2pdf settings");
  });
  it("parses quoted Pi command paths", () => {
    const args = parseArgs(tokenizeCommand('"some report.md" "final report.pdf" --toc'), true);
    expect(args.options).toMatchObject({ input: "some report.md", output: "final report.pdf", toc: true });
  });
  it("preserves native Windows paths", () => {
    expect(tokenizeCommand('"C:\\Users\\Jane\\My Report.md"')).toEqual(["C:\\Users\\Jane\\My Report.md"]);
  });
  it("rejects unknown flags and missing arguments", () => {
    expect(() => parseArgs(["-wat"])).toThrow("Unknown");
    expect(() => parseArgs([])).toThrow("Input");
    expect(() => tokenizeCommand('"unterminated')).toThrow("Unclosed");
  });
  it("rejects invalid page sizes and double output", () => {
    expect(() => parseArgs(["a.md", "--paper", "tabloid"])).toThrow("Invalid");
    expect(() => parseArgs(["a.md", "b.pdf", "-o", "c.pdf"], true)).toThrow("twice");
  });
});
