import { readFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

/** Save tiny validated JSON synchronously and atomically, so a menu change is either saved or rolled back before the next keypress. */
export function savePdfSettings(agentDir: string, value: PdfSettings): void {
  const settings = normalizePdfSettings(value);
  const file = settingsPath(agentDir);
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = mkdtempSync(path.join(dir, ".settings-"));
  try {
    const candidate = path.join(temp, "settings.json");
    writeFileSync(candidate, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(candidate, file);
  } finally {
    rmSync(temp, { recursive: true, force: true });
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
