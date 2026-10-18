import path from "node:path";
import { stat, realpath } from "node:fs/promises";

export type Paper = "a4" | "letter";

/**
 * Single source of truth for behavior shared by the CLI, Pi slash command,
 * and agent-callable tool. All optional formatting is opt-in.
 * Only GitHub Light is supported in v1.
 */
export const DEFAULTS = {
  paper: "a4",
  toc: false,
  numberSections: false,
  overwrite: false,
  theme: "github-light",
} as const;

export interface ConversionOptions {
  input: string;
  output?: string;
  paper?: Paper;
  toc?: boolean;
  numberSections?: boolean;
  overwrite?: boolean;
  browserPath?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
export interface PreparedOptions extends Required<Omit<ConversionOptions, "signal" | "browserPath">> {
  browserPath?: string;
  signal?: AbortSignal;
}
export const LIMITS = { markdown: 10 * 1024 * 1024, image: 10 * 1024 * 1024, imagesTotal: 30 * 1024 * 1024, timeout: 60_000 } as const;

export function defaultOutput(input: string): string {
  const p = path.parse(input);
  return path.join(p.dir, p.name + ".pdf");
}
export async function prepareOptions(opts: ConversionOptions): Promise<PreparedOptions> {
  if (!opts.input || typeof opts.input !== "string") throw new Error("Input Markdown path is required");
  const input = path.resolve(opts.input);
  const output = path.resolve(opts.output ?? defaultOutput(input));
  const paper = opts.paper ?? DEFAULTS.paper;
  if (paper !== "a4" && paper !== "letter") throw new Error("Paper must be a4 or letter");
  const info = await stat(input);
  if (!info.isFile()) throw new Error("Input must be a regular file");
  if (info.size > LIMITS.markdown) throw new Error("Markdown exceeds 10 MiB limit");
  if (path.extname(input).toLowerCase() !== ".md" && path.extname(input).toLowerCase() !== ".markdown") {
    throw new Error("Input must end in .md or .markdown");
  }
  if (path.extname(output).toLowerCase() !== ".pdf") throw new Error("Output must end in .pdf");
  if (input === output || await realpath(input) === await realpath(output).catch(() => "")) {
    throw new Error("Input and output cannot be the same file");
  }
  const timeoutMs = opts.timeoutMs ?? LIMITS.timeout;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000) throw new Error("Invalid conversion timeout");
  return { input, output, paper,
    toc: opts.toc ?? DEFAULTS.toc,
    numberSections: opts.numberSections ?? DEFAULTS.numberSections,
    overwrite: opts.overwrite ?? DEFAULTS.overwrite,
    browserPath: opts.browserPath, signal: opts.signal, timeoutMs };
}
