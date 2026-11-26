import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULTS, parseMermaidErrorMode, type ConversionOptions, type Paper, type MermaidErrorMode } from "./options.js";

/** User-owned Pi preferences; never persist output paths or overwrite consent. */
export interface PdfSettings {
  paper: Paper;
  toc: boolean;
  numberSections: boolean;
  mermaidErrors: MermaidErrorMode;
}

export function defaultPdfSettings(): PdfSettings {
  return {
    paper: DEFAULTS.paper, toc: DEFAULTS.toc,
    numberSections: DEFAULTS.numberSections, mermaidErrors: DEFAULTS.mermaidErrors,
  };
}

export function settingsPath(agentDir: string): string {
  return path.join(agentDir, "md2pdf", "settings.json");
}

/** Reject malformed known fields; ignore unknown fields, including overwrite. */
export function normalizePdfSettings(value: unknown): PdfSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings must be a JSON object");
  }
  const input = value as Record<string, unknown>;
  const result = defaultPdfSettings();
  if (Object.hasOwn(input, "paper")) {
    if (input.paper !== "a4" && input.paper !== "letter") throw new Error("Invalid paper setting");
    result.paper = input.paper;
  }
  if (Object.hasOwn(input, "toc")) {
    if (typeof input.toc !== "boolean") throw new Error("Invalid toc setting");
    result.toc = input.toc;
  }
  if (Object.hasOwn(input, "numberSections")) {
    if (typeof input.numberSections !== "boolean") throw new Error("Invalid numberSections setting");
    result.numberSections = input.numberSections;
  }
  if (Object.hasOwn(input, "mermaidErrors")) result.mermaidErrors = parseMermaidErrorMode(input.mermaidErrors);
  return result;
}

export function loadPdfSettings(agentDir: string): PdfSettings {
  const file = settingsPath(agentDir);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultPdfSettings();
    throw new Error("Cannot read md2pdf settings: " + file, { cause: error });
  }
  try {
    return normalizePdfSettings(JSON.parse(raw));
  } catch (error) {
    throw new Error("Invalid md2pdf settings at " + file + ": " +
      (error instanceof Error ? error.message : String(error)), { cause: error });
  }
}

/** Save only validated preference fields; replace atomically in the same directory. */
export async function savePdfSettings(agentDir: string, value: PdfSettings): Promise<void> {
  const settings = normalizePdfSettings(value);
  const file = settingsPath(agentDir);
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = await mkdtemp(path.join(dir, ".settings-"));
  try {
    const candidate = path.join(temp, "settings.json");
    await writeFile(candidate, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await rename(candidate, file);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

/** Explicit per-conversion arguments win, including false boolean overrides. */
export function applyPdfSettings<T extends Partial<ConversionOptions>>(options: T, defaults: PdfSettings): T & PdfSettings {
  return {
    ...options,
    paper: options.paper ?? defaults.paper,
    toc: options.toc ?? defaults.toc,
    numberSections: options.numberSections ?? defaults.numberSections,
    mermaidErrors: options.mermaidErrors ?? defaults.mermaidErrors,
  };
}
