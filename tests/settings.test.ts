import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyPdfSettings, defaultPdfSettings, loadPdfSettings, normalizePdfSettings, savePdfSettings, settingsPath } from "../src/core/settings.js";
import { pdfSettingItems, updatePdfSetting } from "../src/ui/settings.js";
import piMd2Pdf from "../src/extension.js";

const convert = vi.hoisted(() => vi.fn());
vi.mock("../src/core/convert.js", () => ({ convertMarkdownToPdf: convert }));

describe("persistent Pi PDF preferences", () => {
  it("validates settings and ignores overwrite or other unrelated fields", () => {
    expect(normalizePdfSettings({ paper: "letter", toc: true, overwrite: true }))
      .toEqual({ ...defaultPdfSettings(), paper: "letter", toc: true });
    for (const bad of [null, [], { paper: "legal" }, { toc: "true" }, { numberSections: 1 }, { mermaidErrors: "wrong" }]) {
      expect(() => normalizePdfSettings(bad)).toThrow();
    }
  });
  it("reads missing defaults and persists validated preferences atomically", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-settings-"));
    try {
      expect(loadPdfSettings(dir)).toEqual(defaultPdfSettings());
      const saved = { ...defaultPdfSettings(), paper: "letter" as const, toc: true };
      await savePdfSettings(dir, saved);
      expect(loadPdfSettings(dir)).toEqual(saved);
      expect(JSON.parse(await readFile(settingsPath(dir), "utf8"))).toEqual(saved);
      expect(await readdir(path.dirname(settingsPath(dir)))).toEqual(["settings.json"]);
      await writeFile(settingsPath(dir), "{");
      expect(() => loadPdfSettings(dir)).toThrow("Invalid md2pdf settings");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("supports draft edits, resets and explicit false overrides", () => {
    const defaults = defaultPdfSettings();
    const edited = updatePdfSetting(defaults, "toc", "true");
    expect(defaults.toc).toBe(false);
    expect(edited.toc).toBe(true);
    expect(pdfSettingItems(edited).find(item => item.id === "toc")?.currentValue).toBe("true");
    expect(updatePdfSetting(edited, "reset", "Enter")).toEqual(defaults);
    expect(applyPdfSettings({ input: "test.md", toc: false, overwrite: false }, edited))
      .toMatchObject({ toc: false, overwrite: false, paper: "a4" });
  });
  it("saves through the settings command, applies preferences to both Pi interfaces, and discards cancellation", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-settings-ui-"));
    vi.stubEnv("PI_CODING_AGENT_DIR", dir);
    convert.mockReset();
    convert.mockResolvedValue({ input: path.join(dir, "report.md"), output: path.join(dir, "report.pdf"),
      bytes: 100, browser: "test", mermaidDiagnostics: [] });
    try {
      await writeFile(path.join(dir, "report.md"), "# Report");
      const saved = { ...defaultPdfSettings(), paper: "letter" as const, toc: true, numberSections: true, mermaidErrors: "source" as const };
      const custom = vi.fn().mockResolvedValueOnce(saved).mockResolvedValueOnce(null);
      const notify = vi.fn();
      const ctx = { cwd: dir, mode: "tui", hasUI: true, ui: { custom, notify } };
      let command: { handler: (args: string, ctx: unknown) => Promise<void> } | undefined;
      let tool: { execute: (...args: unknown[]) => Promise<unknown> } | undefined;
      piMd2Pdf({
        registerCommand(_name: string, value: typeof command) { command = value; },
        registerTool(value: typeof tool) { tool = value; },
      } as unknown as ExtensionAPI);
      await command!.handler("settings", ctx);
      expect(loadPdfSettings(dir)).toEqual(saved);
      expect(convert).not.toHaveBeenCalled();
      await command!.handler("report.md", ctx);
      expect(convert.mock.lastCall?.[0]).toMatchObject(saved);
      await command!.handler("report.md --no-toc --no-number-sections --paper a4", ctx);
      expect(convert.mock.lastCall?.[0]).toMatchObject({ paper: "a4", toc: false, numberSections: false, mermaidErrors: "source" });
      await tool!.execute("call", { input: "report.md", toc: false }, undefined, undefined, ctx);
      expect(convert.mock.lastCall?.[0]).toMatchObject({ ...saved, toc: false });
      await command!.handler("settings", ctx);
      expect(loadPdfSettings(dir)).toEqual(saved);
      await command!.handler("settings", { ...ctx, mode: "rpc" });
      expect(notify).toHaveBeenCalledWith(expect.stringContaining("requires interactive Pi"), "error");
      expect(custom).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
