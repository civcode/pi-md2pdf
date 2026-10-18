import { describe, expect, it } from "vitest";
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
    expect(description).toContain("explicitly requests");
    expect(description).toContain("plain conversion");
    const schemaText = JSON.stringify(tools[0]!.parameters);
    expect(schemaText).toContain("Only");
    expect(schemaText).toContain("user requests");
    expect(schemaText).toContain("authorization");
  });
});
