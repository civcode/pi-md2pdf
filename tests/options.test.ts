import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultOutput, prepareOptions } from "../src/core/options.js";
describe("options", () => {
  it("generates output filename", () => {
    expect(defaultOutput("/tmp/notes.md")).toBe("/tmp/notes.pdf");
  });
  it("validates file and paper", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-opts-"));
    try {
      const input = path.join(dir, "test.md");
      await writeFile(input, "# Test");
      const options = await prepareOptions({ input });
      expect(options.output).toBe(path.join(dir, "test.pdf"));
      expect(options.paper).toBe("a4");
      await expect(prepareOptions({ input, paper: "legal" as "a4" })).rejects.toThrow("Paper");
      await expect(prepareOptions({ input, output: path.join(dir, "bad.txt") })).rejects.toThrow("Output");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
