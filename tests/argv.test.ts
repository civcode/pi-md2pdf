import { describe, expect, it } from "vitest";
import { parseArgs, tokenizeCommand } from "../src/core/argv.js";
describe("command arguments", () => {
  it("parses CLI flags", () => {
    const args = parseArgs(["report.md", "-o", "report.pdf", "--toc", "--paper", "letter", "--number-sections"]);
    expect(args.options).toMatchObject({ input: "report.md", output: "report.pdf", paper: "letter", toc: true, numberSections: true });
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
