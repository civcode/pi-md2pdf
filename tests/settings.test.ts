import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { applyPdfSettings, defaultPdfSettings, loadPdfSettings, normalizePdfSettings, savePdfSettings, settingsPath } from "../src/core/settings.js";
import { editPdfSettings, pdfSettingItems, updatePdfSetting } from "../src/ui/settings.js";
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
  it("supports preference changes, resets and explicit false overrides", () => {
    const defaults = defaultPdfSettings();
    const edited = updatePdfSetting(defaults, "toc", "true");
    expect(defaults.toc).toBe(false);
    expect(edited.toc).toBe(true);
    expect(pdfSettingItems(edited).find(item => item.id === "toc")?.currentValue).toBe("true");
    expect(updatePdfSetting(edited, "reset", "Enter")).toEqual(defaults);
    expect(applyPdfSettings({ input: "test.md", toc: false, overwrite: false }, edited))
      .toMatchObject({ toc: false, overwrite: false, paper: "a4" });
  });
  it("restores displayed values on save failure and persists reset immediately", async () => {
    const initial = { ...defaultPdfSettings(), paper: "letter" as const, toc: true };
    const persist = vi.fn().mockImplementationOnce(() => { throw new Error("read-only"); });
    type MenuComponent = { render: (width: number) => readonly string[]; handleInput: (data: string) => void };
    const ctx = { ui: { custom: async (factory: (tui: unknown, theme: unknown, kb: unknown, done: () => void) => MenuComponent, options: unknown) => {
      expect(options).toMatchObject({ overlay: true, overlayOptions: { width: 56 } });
      const menu = factory({ requestRender() {} }, { fg: (_c: string, v: string) => v, bold: (v: string) => v }, {}, () => {});
      menu.handleInput("\r"); // attempts a4, fails
      const failed = menu.render(56).join("\n");
      expect(failed).toContain("Save failed: read-only");
      expect(failed).toMatch(/Paper format\s+letter/);
      for (let i = 0; i < 4; i++) menu.handleInput("\x1b[B");
      menu.handleInput("\r"); // reset saves
      expect(persist.mock.lastCall?.[0]).toEqual(defaultPdfSettings());
      expect(menu.render(56).join("\n")).not.toContain("Save failed");
      menu.handleInput("\x1b");
    } } } as unknown as ExtensionContext;
    await editPdfSettings(ctx, initial, persist);
  });
  it("saves on change through the real settings menu and applies preferences to both Pi interfaces", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "md2pdf-settings-ui-"));
    vi.stubEnv("PI_CODING_AGENT_DIR", dir);
    convert.mockReset();
    convert.mockResolvedValue({ input: path.join(dir, "report.md"), output: path.join(dir, "report.pdf"),
      bytes: 100, browser: "test", mermaidDiagnostics: [] });
    try {
      await writeFile(path.join(dir, "report.md"), "# Report");
      const saved = { ...defaultPdfSettings(), paper: "letter" as const, toc: true, numberSections: true, mermaidErrors: "source" as const };
      type MenuComponent = { render: (width: number) => readonly string[]; handleInput: (data: string) => void };
      type MenuFactory = (tui: unknown, theme: unknown, kb: unknown, done: () => void) => MenuComponent;
      const theme = { fg: (_color: string, value: string) => value, bold: (value: string) => value };
      const custom = vi.fn((factory: MenuFactory, _options: unknown) => {
        const component = factory({ requestRender() {} }, theme, {}, () => {});
        if (custom.mock.calls.length === 1) {
          component.handleInput("\r"); // paper: letter
          expect(loadPdfSettings(dir).paper).toBe("letter"); // before closing
          component.handleInput("\x1b[B");
          component.handleInput("\r"); // toc: true
          component.handleInput("\x1b[B");
          component.handleInput("\r"); // numbering: true
          component.handleInput("\x1b[B");
          component.handleInput("\r"); // Mermaid: source
          expect(loadPdfSettings(dir)).toEqual(saved);
          expect(component.render(56).join("\n")).not.toContain("Save and close");
        }
        component.handleInput("\x1b"); // close; do not undo saved changes
        return Promise.resolve();
      });
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
