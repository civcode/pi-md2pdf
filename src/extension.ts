import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertMarkdownToPdf } from "./core/convert.js";
import { defaultOutput } from "./core/options.js";
import { HELP, parseArgs, tokenizeCommand } from "./core/argv.js";

async function exists(file: string): Promise<boolean> {
  try { await access(file, constants.F_OK); return true; } catch { return false; }
}
export default function piMd2Pdf(pi: ExtensionAPI): void {
  pi.registerCommand("md2pdf", {
    description: "Convert Markdown to a GitHub-style PDF without a model call",
    handler: async (args, ctx) => {
      try {
        const parsed = parseArgs(tokenizeCommand(args ?? ""), true);
        if (parsed.help) { ctx.ui.notify(HELP, "info"); return; }
        if (parsed.check || parsed.version) { ctx.ui.notify("For diagnostics use: md2pdf --check", "info"); return; }
        const options = parsed.options;
        options.input = path.resolve(ctx.cwd, options.input);
        options.output = path.resolve(ctx.cwd, options.output ?? defaultOutput(options.input));
        if (await exists(options.output) && !options.overwrite) {
          if (!ctx.hasUI) throw new Error("Output exists; cannot confirm overwrite in non-interactive mode.");
          const confirmed = await ctx.ui.confirm("Overwrite PDF?", options.output);
          if (!confirmed) { ctx.ui.notify("Conversion cancelled", "warning"); return; }
          options.overwrite = true;
        }
        ctx.ui.notify("Converting Markdown to PDF…", "info");
        const result = await convertMarkdownToPdf(options);
        ctx.ui.notify("Created " + result.output + " (" + result.bytes + " bytes)", "info");
      } catch (error) {
        ctx.ui.notify("md2pdf: " + (error instanceof Error ? error.message : String(error)), "error");
      }
    },
  });

  pi.registerTool(defineTool({
    name: "markdown_to_pdf",
    label: "Markdown to PDF",
    description: "Convert a local Markdown file to a polished offline GitHub-style PDF. Existing PDFs are protected unless overwrite is explicitly true.",
    parameters: Type.Object({
      input: Type.String({ description: "Markdown source path" }),
      output: Type.Optional(Type.String({ description: "PDF destination path; defaults beside source" })),
      paper: Type.Optional(Type.Union([Type.Literal("a4"), Type.Literal("letter")])),
      toc: Type.Optional(Type.Boolean()),
      numberSections: Type.Optional(Type.Boolean()),
      overwrite: Type.Optional(Type.Boolean({ description: "Overwrite existing output only if explicitly authorized" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Rendering Markdown PDF…" }] });
      const result = await convertMarkdownToPdf({
        input: path.resolve(ctx.cwd, params.input),
        output: params.output ? path.resolve(ctx.cwd, params.output) : undefined,
        paper: params.paper,
        toc: params.toc,
        numberSections: params.numberSections,
        overwrite: params.overwrite ?? false,
        signal,
      });
      return {
        content: [{ type: "text", text: "Created " + result.output + " (" + result.bytes + " bytes)" }],
        details: result,
      };
    },
  }));
}
