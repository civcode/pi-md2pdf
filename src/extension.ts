import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertMarkdownToPdf } from "./core/convert.js";
import { DEFAULTS } from "./core/options.js";
import { formatMermaidDiagnostics } from "./core/mermaid.js";
import { PI_HELP, parseArgs, tokenizeCommand } from "./core/argv.js";
import { resolveWorkspacePaths } from "./core/workspace.js";
import { getMd2pdfArgumentCompletions } from "./ui/completion.js";
import { formatMd2pdfCall, formatMd2pdfResult } from "./ui/display.js";
import { Text } from "@earendil-works/pi-tui";
import { applyPdfSettings, loadPdfSettings, savePdfSettings, settingsPath } from "./core/settings.js";
import { editPdfSettings } from "./ui/settings.js";

async function exists(file: string): Promise<boolean> {
  try { await access(file, constants.F_OK); return true; } catch { return false; }
}
export default function piMd2Pdf(pi: ExtensionAPI): void {
  // Pi's autocomplete callback does not receive a command context. Track the
  // active session cwd, falling back to the process directory during startup.
  let completionCwd = process.cwd();
  if (typeof pi.on === "function") {
    pi.on("session_start", (_event, ctx) => { completionCwd = ctx.cwd; });
  }
  pi.registerCommand("md2pdf", {
    description: `/md2pdf FILE.md [OUT.pdf] [--toc] [--number-sections] [--paper a4|letter] [--mermaid-errors strict|placeholder|source] [--force] | /md2pdf settings (factory defaults: ${DEFAULTS.paper}, no TOC)`,
    getArgumentCompletions: (prefix) => getMd2pdfArgumentCompletions(prefix, completionCwd),
    handler: async (args, ctx) => {
      const report = (message: string, level: "info" | "warning" | "error") => {
        if (ctx.hasUI) ctx.ui.notify(message, level);
        else process.stderr.write(message + "\n");
      };
      try {
        const tokens = tokenizeCommand(args ?? "");
        if (tokens[0] === "settings") {
          if (tokens.length !== 1) throw new Error("Usage: /md2pdf settings");
          if (!ctx.hasUI || ctx.mode !== "tui") {
            report("/md2pdf settings requires interactive Pi TUI mode", "error");
            return;
          }
          const agentDir = getAgentDir();
          const edited = await editPdfSettings(ctx, loadPdfSettings(agentDir));
          if (edited === null) return;
          await savePdfSettings(agentDir, edited);
          report("md2pdf settings saved: " + settingsPath(agentDir), "info");
          return;
        }
        const parsed = parseArgs(tokens, true, false);
        if (parsed.help) { report(PI_HELP, "info"); return; }
        if (parsed.check || parsed.version) { report("For diagnostics use: md2pdf --check", "info"); return; }
        const options = applyPdfSettings(parsed.options, loadPdfSettings(getAgentDir()));
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
        if (result.mermaidDiagnostics.length) report(formatMermaidDiagnostics(result.mermaidDiagnostics), "warning");
      } catch (error) {
        report("md2pdf: " + (error instanceof Error ? error.message : String(error)), "error");
      }
    },
  });

  pi.registerTool(defineTool({
    name: "markdown_to_pdf",
    label: "Markdown to PDF",
    description: `Convert a local Markdown file to PDF using the ${DEFAULTS.theme} theme. Defaults: paper=${DEFAULTS.paper}, toc=${DEFAULTS.toc}, numberSections=${DEFAULTS.numberSections}, overwrite=${DEFAULTS.overwrite}, outputConflict=${DEFAULTS.outputConflict}, mermaidErrors=${DEFAULTS.mermaidErrors}. Failed Mermaid diagrams normally produce a diagnostic plus literal source and conversion continues. Do not retry successful conversions just because diagram warnings are returned. Saved /md2pdf settings override factory defaults for omitted parameters. Omit formatting options unless the user explicitly requests a per-conversion override; explicit false disables a saved true preference. IMPORTANT PATH RULE: Resolve filenames ONLY relative to Pi's current working directory. NEVER search the home directory, parent directories, or other projects for a same-named Markdown file. If the file is missing, report it without substituting another file. The agent tool refuses files outside the current working directory (including symlinks); users can explicitly use /md2pdf for cross-directory inputs. For a plain conversion request, omit toc and numberSections so the user's saved preferences apply. Only override those preferences when the user explicitly requests different formatting. When the user has not chosen an output filename and the default PDF exists, save to a new numbered filename (-2, -3, etc.) automatically without asking. If the user explicitly specifies an occupied output filename, refuse unless overwrite is authorized. Never overwrite an existing file without the user's explicit authorization.`,
    parameters: Type.Object({
      input: Type.String({ description: "Required existing Markdown path within Pi's current working directory. Relative paths resolve only against ctx.cwd. Absolute paths are allowed ONLY when within ctx.cwd. Do NOT search other directories for a matching filename." }),
      output: Type.Optional(Type.String({ description: "Optional PDF output path within Pi's current working directory. When omitted, save beside input using its basename and .pdf extension; if it already exists, automatically choose -2, -3, etc. Explicit occupied filenames are never renamed silently." })),
      paper: Type.Optional(Type.Union([Type.Literal("a4"), Type.Literal("letter")], { description: `PDF paper format. Factory default: ${DEFAULTS.paper}. Omit to use saved settings; set only if requested.` })),
      toc: Type.Optional(Type.Boolean({ description: `Override the saved table-of-contents preference ONLY if the user requests it; false explicitly disables it. Factory default: ${DEFAULTS.toc}. A TOC may add many pages.` })),
      numberSections: Type.Optional(Type.Boolean({ description: `Override saved heading numbering ONLY if the user requests it; false disables it. Factory default: ${DEFAULTS.numberSections}. Existing heading numbers are preserved.` })),
      mermaidErrors: Type.Optional(Type.Union([Type.Literal("strict"), Type.Literal("placeholder"), Type.Literal("source")], { description: "Failed Mermaid diagram policy. Omit to use saved settings. Factory default placeholder: diagnostic plus literal source, continue. source: literal source only, continue. strict: abort conversion." })),
      overwrite: Type.Optional(Type.Boolean({ description: `Overwrite an existing PDF ONLY with explicit user authorization. Default: ${DEFAULTS.overwrite}.` })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      // Check scope before Chromium runs; model-selected external paths are refused.
      const paths = await resolveWorkspacePaths(ctx.cwd, params.input, params.output);
      onUpdate?.({ content: [{ type: "text", text: "Rendering Markdown PDF…" }], details: { status: "rendering" } });
      const result = await convertMarkdownToPdf(applyPdfSettings({
        input: paths.input,
        output: paths.output,
        paper: params.paper,
        toc: params.toc,
        numberSections: params.numberSections,
        overwrite: params.overwrite,
        mermaidErrors: params.mermaidErrors,
        signal,
      }, loadPdfSettings(getAgentDir())));
      return {
        content: [{ type: "text", text: "Created " + result.output + " (" + result.bytes + " bytes)" +
          (result.mermaidDiagnostics.length ? "\n" + formatMermaidDiagnostics(result.mermaidDiagnostics) : "") }],
        details: result,
      };
    },
    renderCall(params, theme) {
      let summary: string;
      try { summary = formatMd2pdfCall(applyPdfSettings(params, loadPdfSettings(getAgentDir()))); }
      catch { summary = formatMd2pdfCall(params) + " [settings unavailable]"; }
      return new Text(
        theme.fg("toolTitle", theme.bold("markdown_to_pdf")) +
          "  " + theme.fg("accent", summary), 0, 0,
      );
    },
    renderResult(result, { expanded }, theme) {
      const fallback = result.content?.find(item => item.type === "text")?.text ?? "";
      const summary = formatMd2pdfResult(result.details, fallback, expanded);
      return new Text(theme.fg("toolOutput", summary), 0, 0);
    },
  }));
}
