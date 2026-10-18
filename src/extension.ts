import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertMarkdownToPdf } from "./core/convert.js";
import { DEFAULTS } from "./core/options.js";
import { HELP, parseArgs, tokenizeCommand } from "./core/argv.js";

async function exists(file: string): Promise<boolean> {
  try { await access(file, constants.F_OK); return true; } catch { return false; }
}
export default function piMd2Pdf(pi: ExtensionAPI): void {
  pi.registerCommand("md2pdf", {
    description: `Convert Markdown to PDF (${DEFAULTS.theme}; ${DEFAULTS.paper}; no TOC or added numbering by default), without a model call`,
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
        // Leave output undefined for shared automatic -2/-3 collision naming.
        // An explicitly supplied output path still requires confirmation if occupied.
        if (options.output !== undefined) options.output = path.resolve(ctx.cwd, options.output);
        if (options.output && await exists(options.output) && !options.overwrite) {
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
    description: `Convert a local Markdown file to PDF using the ${DEFAULTS.theme} theme. Defaults: paper=${DEFAULTS.paper}, toc=${DEFAULTS.toc}, numberSections=${DEFAULTS.numberSections}, overwrite=${DEFAULTS.overwrite}, outputConflict=${DEFAULTS.outputConflict}. For a plain conversion request, preserve the author's headings and layout; do NOT add a TOC or section numbering, even for lengthy documents. Only set toc=true when the user explicitly requests a table of contents, and numberSections=true when the user explicitly requests automatic heading numbers. When the user has not chosen an output filename and the default PDF exists, save to a new numbered filename (-2, -3, etc.) automatically without asking. If the user explicitly specifies an occupied output filename, refuse unless overwrite is authorized. Never overwrite an existing file without the user's explicit authorization.`,
    parameters: Type.Object({
      input: Type.String({ description: "Required local Markdown file path, relative to Pi working directory or absolute." }),
      output: Type.Optional(Type.String({ description: "Optional explicitly requested PDF output path. When omitted, save beside input using its basename and .pdf extension; if it already exists, automatically choose -2, -3, etc., without asking. Explicit occupied output filenames are never renamed silently." })),
      paper: Type.Optional(Type.Union([Type.Literal("a4"), Type.Literal("letter")], { description: `PDF paper format. Default: ${DEFAULTS.paper}. Choose letter only if requested.` })),
      toc: Type.Optional(Type.Boolean({ description: `Add a linked table of contents ONLY if the user requests one. Default: ${DEFAULTS.toc}. A TOC may add many pages.` })),
      numberSections: Type.Optional(Type.Boolean({ description: `Add automatic section numbering ONLY if requested. Default: ${DEFAULTS.numberSections}. Existing heading numbers are preserved.` })),
      overwrite: Type.Optional(Type.Boolean({ description: `Overwrite an existing PDF ONLY with explicit user authorization. Default: ${DEFAULTS.overwrite}.` })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Rendering Markdown PDF…" }], details: { status: "rendering" } });
      const result = await convertMarkdownToPdf({
        input: path.resolve(ctx.cwd, params.input),
        output: params.output ? path.resolve(ctx.cwd, params.output) : undefined,
        paper: params.paper,
        toc: params.toc,
        numberSections: params.numberSections,
        overwrite: params.overwrite,
        signal,
      });
      return {
        content: [{ type: "text", text: "Created " + result.output + " (" + result.bytes + " bytes)" }],
        details: result,
      };
    },
  }));
}
