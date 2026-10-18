import path from "node:path";
import { DEFAULTS } from "../core/options.js";

export interface DisplayArguments {
  input?: string;
  output?: string;
  paper?: "a4" | "letter";
  toc?: boolean;
  numberSections?: boolean;
  overwrite?: boolean;
}
interface DisplayResult {
  input?: string;
  output?: string;
  bytes?: number;
  browser?: string;
  status?: string;
}

export function formatMd2pdfCall(args: DisplayArguments): string {
  const input = args.input || "(input missing)";
  const output = args.output ? " → " + args.output : "";
  const flags = [
    (args.paper ?? DEFAULTS.paper).toUpperCase(),
    args.toc ? "TOC" : "no TOC",
    args.numberSections ? "number sections" : "preserve numbering",
    ...(args.overwrite ? ["overwrite authorized"] : []),
  ];
  return input + output + "  [" + flags.join(" · ") + "]";
}

export function formatMd2pdfResult(
  details: unknown, fallback: string, expanded = false,
): string {
  if (!details || typeof details !== "object") return fallback;
  const result = details as DisplayResult;
  if (result.status === "rendering") return "Rendering Markdown PDF…";
  if (!result.output || typeof result.output !== "string") return fallback;
  const basename = path.basename(result.output);
  const bytes = typeof result.bytes === "number" && Number.isFinite(result.bytes)
    ? " (" + (result.bytes / 1024).toFixed(1) + " KiB)" : "";
  const title = "Created " + basename + bytes;
  if (!expanded) return title;
  return [
    title,
    "Output: " + result.output,
    ...(result.input ? ["Input: " + result.input] : []),
    ...(result.browser ? ["Browser: " + result.browser] : []),
  ].join("\n");
}
