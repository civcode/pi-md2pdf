import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Keep failure testing deterministic and independent of the presence of Chromium.
// The normal tests/integration.test.ts exercises an actual installed browser.
const mocked = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock("puppeteer-core", () => ({ default: { launch: mocked.launch } }));
vi.mock("../src/core/browser.js", () => ({
  resolveBrowser: () => "/fake/chromium",
  browserVersion: () => "Fake Chromium",
}));

import { convertMarkdownToPdf } from "../src/core/convert.js";

function fakeBrowser() {
  const page = {
    setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    setDefaultTimeout: vi.fn(),
    setContent: vi.fn().mockResolvedValue(undefined),
    emulateMediaType: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(undefined),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  mocked.launch.mockResolvedValue(browser);
  return { page, browser };
}
async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-failure-"));
  const input = path.join(dir, "report.md");
  const output = path.join(dir, "report.pdf");
  await writeFile(input, "# Failure and cancellation tests");
  return { dir, input, output };
}
async function assertNoTemporaryFiles(dir: string) {
  const files = await readdir(dir);
  expect(files.filter(name => name.startsWith(".md2pdf-"))).toEqual([]);
}

describe("headless browser failure paths", () => {
  beforeEach(() => { mocked.launch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("rejects an already-aborted conversion without launching the browser", async () => {
    const { dir, input, output } = await setup();
    try {
      const abort = new AbortController();
      abort.abort();
      await expect(convertMarkdownToPdf({ input, output, signal: abort.signal }))
        .rejects.toThrow(/cancelled/);
      expect(mocked.launch).not.toHaveBeenCalled();
      await assertNoTemporaryFiles(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("cleans up temporary files if Chromium fails to launch", async () => {
    const { dir, input, output } = await setup();
    try {
      mocked.launch.mockRejectedValue(new Error("Browser startup failed"));
      await expect(convertMarkdownToPdf({ input, output }))
        .rejects.toThrow("Browser startup failed");
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
      await assertNoTemporaryFiles(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("closes Chromium and preserves existing output on PDF rendering failure", async () => {
    const { dir, input, output } = await setup();
    try {
      const { page, browser } = fakeBrowser();
      page.pdf.mockRejectedValue(new Error("Browser crashed while rendering"));
      await writeFile(output, "original PDF bytes");
      await expect(convertMarkdownToPdf({ input, output, overwrite: true }))
        .rejects.toThrow("Browser crashed while rendering");
      expect(browser.close).toHaveBeenCalled();
      expect(await readFile(output, "utf8")).toBe("original PDF bytes");
      await assertNoTemporaryFiles(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("cancels after Chromium starts, closes it, and does not publish", async () => {
    const { dir, input, output } = await setup();
    try {
      const controller = new AbortController();
      const { page, browser } = fakeBrowser();
      page.setContent.mockImplementation(async () => { controller.abort(); });
      await expect(convertMarkdownToPdf({ input, output, signal: controller.signal }))
        .rejects.toThrow(/cancelled/);
      expect(browser.close).toHaveBeenCalled();
      expect(page.pdf).not.toHaveBeenCalled();
      await assertNoTemporaryFiles(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("times out, closes the browser, and removes temporary files", async () => {
    const { dir, input, output } = await setup();
    try {
      const timeout = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
      const { page, browser } = fakeBrowser();
      page.setContent.mockImplementation(async () => {
        timeout.abort(new DOMException("Time limit reached", "TimeoutError"));
      });
      await expect(convertMarkdownToPdf({ input, output, timeoutMs: 500 }))
        .rejects.toThrow(/timed out/);
      expect(browser.close).toHaveBeenCalled();
      await assertNoTemporaryFiles(dir);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
