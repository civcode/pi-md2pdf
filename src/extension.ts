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
      const report = (message: string, level: "info" | "warning" | "error") => {
        if (ctx.hasUI) ctx.ui.notify(message, level);
        else process.stderr.write(message + "\n");
      };
      try {
        const parsed = parseArgs(tokenizeCommand(args ?? ""), true);
        if (parsed.help) { report(HELP, "info"); return; }
        if (parsed.check || parsed.version) { report("For diagnostics use: md2pdf --check", "info"); return; }
        const options = parsed.options;
        options.input = path.resolve(ctx.cwd, options.input);
        options.output = path.resolve(ctx.cwd, options.output ?? defaultOutput(options.input));
        if (await exists(options.output) && !options.overwrite) {
          if (!ctx.hasUI) throw new Error("Output exists; cannot confirm overwrite in non-interactive mode.");
          const confirmed = await ctx.ui.confirm("Overwrite PDF?", options.output);
          if (!confirmed) { report("Conversion cancelled", "warning"); return; }
          options.overwrite = true;
        }
        report("Converting Markdown to PDF…", "info");
        const result = await convertMarkdownToPdf({ ...options, signal: ctx.signal });
        report("Created " + result.output + " (" + result.bytes + " bytes)", "info");
      } catch (error) {
        report("md2pdf: " + (error instanceof Error ? error.message : String(error)), "error");
      }
    },
  });

  pi.registerTool(defineTool({
    name: "markdown_to_pdf",
    label: "Markdown to PDF",
    description: "Convert local Markdown to a GitHub-style PDF. For ordinary conversion, omit toc and numberSections so the original document looks like Markdown Viewer. Only enable these formatting changes when the user explicitly requests them. Existing PDFs require explicit overwrite permission.",
    parameters: Type.Object({
      input: Type.String({ description: "Markdown source path" }),
      output: Type.Optional(Type.String({ description: "PDF destination path; defaults beside source" })),
      paper: Type.Optional(Type.Union([Type.Literal("a4"), Type.Literal("letter")])),
      toc: Type.Optional(Type.Boolean({ description: "Add a potentially long table of contents ONLY if explicitly requested; otherwise omit (default false)." })),
      numberSections: Type.Optional(Type.Boolean({ description: "Add section numbers ONLY when explicitly requested. Documents with existing section numbering keep their original numbers. Default false." })),
      overwrite: Type.Optional(Type.Boolean({ description: "Overwrite existing output only if explicitly authorized" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Rendering Markdown PDF…" }], details: { status: "rendering" } });
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
