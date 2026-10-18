import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piMd2Pdf from "../src/extension.js";
import { DEFAULTS } from "../src/core/options.js";

describe("Pi agent tool documentation", () => {
  it("advertises conservative defaults and only opt-in formatting", () => {
    const commands: Array<{ name: string; description: string }> = [];
    const tools: Array<{ name: string; description: string; parameters: unknown }> = [];
    piMd2Pdf({
      registerCommand(name: string, command: { description: string }) {
        commands.push({ name, description: command.description });
      },
      registerTool(tool: { name: string; description: string; parameters: unknown }) {
        tools.push(tool);
      },
    } as unknown as ExtensionAPI);

    expect(commands[0]?.name).toBe("md2pdf");
    expect(commands[0]?.description).toContain(DEFAULTS.theme);
    expect(tools[0]?.name).toBe("markdown_to_pdf");
    const description = tools[0]!.description;
    expect(description).toContain(`paper=${DEFAULTS.paper}`);
    expect(description).toContain(`toc=${DEFAULTS.toc}`);
    expect(description).toContain(`numberSections=${DEFAULTS.numberSections}`);
    expect(description).toContain(`overwrite=${DEFAULTS.overwrite}`);
    expect(description).toContain(`outputConflict=${DEFAULTS.outputConflict}`);
    expect(description).toContain("automatically without asking");
    expect(description).toContain("explicitly specifies an occupied output");
    expect(description).toContain("explicitly requests");
    expect(description).toContain("plain conversion");
    expect(description).toContain("NEVER search the home directory");
    expect(description).toContain("current working directory");
    const schemaText = JSON.stringify(tools[0]!.parameters);
    expect(schemaText).toContain("ONLY");
    expect(schemaText).toContain("user requests");
    expect(schemaText).toContain("authorization");
  });

  it("hard-blocks outside-workspace files at the Pi tool boundary", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-tool-boundary-"));
    try {
      const cwd = path.join(root, "project");
      const foreign = path.join(root, "other");
      await mkdir(cwd);
      await mkdir(foreign);
      const externalMd = path.join(foreign, "specification.md");
      await writeFile(externalMd, "# Unrelated project");
      const tools: Array<{
        name: string;
        execute: (...args: unknown[]) => Promise<unknown>;
      }> = [];
      piMd2Pdf({
        registerCommand() {},
        registerTool(tool: { name: string; execute: (...args: unknown[]) => Promise<unknown> }) {
          tools.push(tool);
        },
      } as unknown as ExtensionAPI);
      const tool = tools.find(t => t.name === "markdown_to_pdf");
      expect(tool).toBeDefined();
      await expect(tool!.execute(
        "test-call", { input: externalMd }, new AbortController().signal, undefined, { cwd },
      )).rejects.toThrow(/outside Pi's working directory/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("registers argument completion and renders tool call and result arguments", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-ui-registration-"));
    try {
      await writeFile(path.join(root, "report.md"), "# Report");
      const registered: {
        command?: { getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null };
        sessionStart?: (event: unknown, ctx: { cwd: string }) => void;
        tool?: {
          renderCall?: (params: unknown, theme: unknown) => { render(width: number): string[] };
          renderResult?: (result: unknown, options: unknown, theme: unknown) => { render(width: number): string[] };
        };
      } = {};
      piMd2Pdf({
        on(event: string, handler: (event: unknown, ctx: { cwd: string }) => void) {
          if (event === "session_start") registered.sessionStart = handler;
        },
        registerCommand(_name: string, value: typeof registered.command) { registered.command = value; },
        registerTool(value: typeof registered.tool) { registered.tool = value; },
      } as unknown as ExtensionAPI);
      expect(registered.sessionStart).toBeTypeOf("function");
      registered.sessionStart?.({}, { cwd: root });
      expect(registered.command?.getArgumentCompletions?.("report.md --")?.map(i => i.value))
        .toContain("report.md --toc");
      const theme = {
        bold(value: string) { return value; },
        fg(_style: string, value: string) { return value; },
      };
      const call = registered.tool?.renderCall?.({ input: "report.md", toc: true }, theme).render(140).join("\n");
      expect(call).toContain("report.md");
      expect(call).toContain("TOC");
      const result = registered.tool?.renderResult?.({
        content: [{ type: "text", text: "Created something" }],
        details: {
          input: path.join(root, "report.md"), output: path.join(root, "report-2.pdf"),
          bytes: 1024, browser: "/usr/bin/chromium",
        },
      }, { expanded: false }, theme).render(140).join("\n");
      expect(result).toContain("report-2.pdf");
      expect(result).toContain("1.0 KiB");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
