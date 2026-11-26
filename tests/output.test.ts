import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { numberedOutput, publishPdf } from "../src/core/output.js";

describe("atomic non-destructive PDF naming", () => {
  it("adds -2, -3 before the extension", () => {
    expect(numberedOutput("/tmp/my-report.pdf", 2)).toBe("/tmp/my-report-2.pdf");
    expect(numberedOutput("/tmp/my-report.pdf", 3)).toBe("/tmp/my-report-3.pdf");
    expect(() => numberedOutput("/tmp/report.pdf", 1)).toThrow();
  });

  it("keeps original outputs and picks first available number", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-output-"));
    try {
      const requested = path.join(dir, "report.pdf");
      const temporary = path.join(dir, "rendered.pdf");
      await writeFile(requested, "existing report");
      await writeFile(numberedOutput(requested, 2), "existing report 2");
      await writeFile(temporary, "new report");
      const result = await publishPdf(temporary, requested, { overwrite: false, increment: true });
      expect(result).toBe(path.join(dir, "report-3.pdf"));
      expect(await readFile(requested, "utf8")).toBe("existing report");
      expect(await readFile(numberedOutput(requested, 2), "utf8")).toBe("existing report 2");
      expect(await readFile(result, "utf8")).toBe("new report");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses occupied explicit outputs without overwrite permission", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-explicit-"));
    try {
      const requested = path.join(dir, "final.pdf");
      const temporary = path.join(dir, "rendered.pdf");
      await writeFile(requested, "original");
      await writeFile(temporary, "new");
      await expect(publishPdf(temporary, requested, { overwrite: false, increment: false }))
        .rejects.toThrow("Output already exists");
      expect(await readFile(requested, "utf8")).toBe("original");
      expect(await readFile(temporary, "utf8")).toBe("new");
      const overwritten = await publishPdf(temporary, requested, { overwrite: true, increment: false });
      expect(overwritten).toBe(requested);
      expect(await readFile(requested, "utf8")).toBe("new");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reserves distinct filenames even for simultaneous conversions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-race-"));
    try {
      const requested = path.join(dir, "report.pdf");
      const temporary = path.join(dir, "rendered.pdf");
      await writeFile(temporary, "new");
      const names = await Promise.all(
        Array.from({ length: 8 }, () =>
          publishPdf(temporary, requested, { overwrite: false, increment: true })
        ),
      );
      expect(new Set(names).size).toBe(8);
      expect(names.map(name => path.basename(name)).sort()).toEqual([
        "report-2.pdf", "report-3.pdf", "report-4.pdf", "report-5.pdf",
        "report-6.pdf", "report-7.pdf", "report-8.pdf", "report.pdf",
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
