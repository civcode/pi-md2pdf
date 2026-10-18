import { readdirSync } from "node:fs";
import path from "node:path";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

const FLAGS: AutocompleteItem[] = [
  { value: "--toc", label: "--toc", description: "Add linked table of contents (off by default)" },
  { value: "--number-sections", label: "--number-sections", description: "Add heading numbers (off by default)" },
  { value: "--paper", label: "--paper", description: "Paper size: a4 (default) or letter" },
  { value: "-o", label: "-o", description: "Explicit PDF output filename" },
  { value: "--output", label: "--output", description: "Explicit PDF output filename" },
  { value: "--browser-path", label: "--browser-path", description: "Use a particular Chromium/Chrome/Edge binary" },
  { value: "--force", label: "--force", description: "Overwrite an explicit output (use cautiously)" },
  { value: "--help", label: "--help", description: "Show md2pdf usage" },
];

const VALUE_FLAGS = new Set(["--paper", "-o", "--output", "--browser-path"]);

interface CursorTokens {
  previous: string[];
  current: string;
  start: number;
}

/** Read incomplete, optionally quoted shell-like arguments without rejecting an open quote. */
function cursorTokens(input: string): CursorTokens {
  const previous: string[] = [];
  let current = "";
  let start = 0;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === "\\" && i + 1 < input.length &&
        (input[i + 1] === "\\" || input[i + 1] === quote || (!quote && /\s/.test(input[i + 1]!)))) {
      current += input[++i];
    } else if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current || i > start) previous.push(current);
      current = "";
      start = i + 1;
    } else {
      current += ch;
    }
  }
  return { previous, current, start };
}

function quotePath(value: string): string {
  return /[\s"'\\]/.test(value)
    ? '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'
    : value;
}

function optionSuggestions(
  candidates: AutocompleteItem[], typed: string, before: string,
  consumed: string[],
): AutocompleteItem[] | null {
  // Pi may consume Enter while a completion remains open. Never offer the
  // exact token the user has already finished typing.
  if (candidates.some(item => item.value.toLowerCase() === typed.toLowerCase())) return null;
  const used = new Set(consumed);
  const matching = candidates.filter(item =>
    item.value.toLowerCase().startsWith(typed.toLowerCase()) &&
    !used.has(item.value),
  );
  return matching.length
    ? matching.map(item => ({ ...item, value: before + item.value }))
    : null;
}

function hasInput(previous: string[]): boolean {
  for (let i = 0; i < previous.length; i++) {
    if (VALUE_FLAGS.has(previous[i]!)) { i++; continue; }
    if (!previous[i]!.startsWith("-")) return true;
  }
  return false;
}

function markdownPathSuggestions(
  token: string, before: string, cwd: string,
): AutocompleteItem[] | null {
  // Do not scan absolute paths, parent directories, home folders or symlinks.
  // Completion is read-only, bounded and restricted to the current project.
  if (path.isAbsolute(token) || token.startsWith("~") || token.includes("\0")) return null;
  const normalized = token.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const parent = slash === -1 ? "" : normalized.slice(0, slash + 1);
  const fragment = slash === -1 ? normalized : normalized.slice(slash + 1);
  if (parent.split("/").includes("..") || parent.startsWith("/")) return null;
  const folder = path.resolve(cwd, parent);
  const relative = path.relative(path.resolve(cwd), folder);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) return null;

  let entries: ReturnType<typeof readdirSync>;
  try { entries = readdirSync(folder, { withFileTypes: true }); }
  catch { return null; }

  const results: AutocompleteItem[] = [];
  for (const entry of entries) {
    if (results.length >= 40) break;
    if (entry.name.startsWith(".") && !fragment.startsWith(".")) continue;
    if (!entry.name.toLowerCase().startsWith(fragment.toLowerCase())) continue;
    // Deliberately do not follow symlinks, which could point outside cwd.
    const directory = entry.isDirectory();
    if (!directory && !(entry.isFile() && /\.(?:md|markdown)$/i.test(entry.name))) continue;
    const candidate = parent + entry.name + (directory ? "/" : "");
    if (candidate.toLowerCase() === normalized.toLowerCase()) continue;
    results.push({
      value: before + quotePath(candidate),
      label: entry.name + (directory ? "/" : ""),
      description: directory ? "Directory" : "Local Markdown file",
    });
  }
  return results.length ? results.sort((a, b) => a.label!.localeCompare(b.label!)) : null;
}

/**
 * Pi replaces the current argument prefix with AutocompleteItem.value.
 * Always preserve earlier arguments, including quoted filenames and flags.
 */
export function getMd2pdfArgumentCompletions(
  prefix: string, cwd = process.cwd(),
): AutocompleteItem[] | null {
  const args = prefix.replace(/^\/?md2pdf(?:\s+|$)/i, "");
  const { previous, current, start } = cursorTokens(args);
  const before = args.slice(0, start);
  const last = previous.at(-1);
  if (last === "--paper") {
    return optionSuggestions([
      { value: "a4", label: "a4", description: "A4 (default)" },
      { value: "letter", label: "letter", description: "US Letter" },
    ], current, before, []);
  }
  if (last && VALUE_FLAGS.has(last)) return null;

  if (current.startsWith("-") || hasInput(previous)) {
    if (!current.startsWith("-") && current !== "") return null;
    return optionSuggestions(FLAGS, current, before, previous);
  }
  return markdownPathSuggestions(current, before, cwd);
}
