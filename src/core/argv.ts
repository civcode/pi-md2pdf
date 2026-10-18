import { DEFAULTS, type ConversionOptions } from "./options.js";
export interface ParsedArguments { options: ConversionOptions; check?: boolean; help?: boolean; version?: boolean }
export function tokenizeCommand(input: string): string[] {
  const args: string[] = []; let part = ""; let quote: "'" | '"' | null = null; let active = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === "\\" && i + 1 < input.length && (input[i + 1] === "\\" || input[i + 1] === quote || (!quote && /\s/.test(input[i + 1]!)))) {
      part += input[++i]; active = true; continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      else part += c;
    } else if (c === '"' || c === "'") { quote = c; active = true; }
    else if (/\s/.test(c)) { if (active) { args.push(part); part = ""; active = false; } }
    else { part += c; active = true; }
  }
  if (quote) throw new Error("Unclosed quotation mark");
  if (active) args.push(part);
  return args;
}
/** The CLI retains -o; the Pi slash command deliberately does not. */
export function parseArgs(argv: string[], allowPositionalOutput = false, allowShortOutput = true): ParsedArguments {
  const options: ConversionOptions = { input: "" };
  const files: string[] = [];
  let check = false, help = false, version = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    if (flag === "--help" || flag === "-h") { help = true; continue; }
    if (flag === "--version" || flag === "-v") { version = true; continue; }
    if (flag === "--check") { check = true; continue; }
    if (flag === "--toc") { options.toc = true; continue; }
    if (flag === "--number-sections") { options.numberSections = true; continue; }
    if (flag === "--force") { options.overwrite = true; continue; }
    if (flag === "-o" && !allowShortOutput) throw new Error("Unknown option: -o (use --output or a positional PDF filename)");
    if (["-o", "--output", "--paper", "--browser-path"].includes(flag)) {
      const next = argv[++i];
      if (!next) throw new Error("Missing value for " + flag);
      if (flag === "-o" || flag === "--output") options.output = next;
      if (flag === "--paper") {
        if (next.toLowerCase() !== "a4" && next.toLowerCase() !== "letter") throw new Error("Invalid paper: " + next);
        options.paper = next.toLowerCase() as "a4" | "letter";
      }
      if (flag === "--browser-path") options.browserPath = next;
      continue;
    }
    if (flag.startsWith("-")) throw new Error("Unknown option: " + flag);
    files.push(flag);
  }
  if (files.length > (allowPositionalOutput ? 2 : 1)) throw new Error("Too many positional arguments");
  if (allowPositionalOutput && files[1]) {
    if (options.output) throw new Error("Output specified twice");
    options.output = files[1];
  }
  options.input = files[0] ?? "";
  if (!check && !help && !version && !options.input) throw new Error("Input Markdown path is required");
  return { options, check, help, version };
}
export const HELP = `Usage: md2pdf input.md [-o output.pdf] [options]

Options:
  -o, --output PATH      Explicit PDF path; fail if occupied (unless --force)\n                         Omitted: input.pdf, then input-2.pdf, input-3.pdf, ...
      --toc              Add linked table of contents (default: ${DEFAULTS.toc})
      --number-sections  Add heading numbering (default: ${DEFAULTS.numberSections})
      --paper a4|letter  Page format (default: ${DEFAULTS.paper})
      --browser-path PATH  Chrome, Chromium or Edge executable
      --force            Overwrite output (default: ${DEFAULTS.overwrite})
      --check            Test headless browser PDF rendering
  -h, --help             Show help
  -v, --version          Show version

Default theme: ${DEFAULTS.theme}. Convert as-is unless options are requested.
Environment: MD2PDF_BROWSER_PATH overrides automatic discovery.
`;

/** Slash-command help deliberately differs from CLI help: no -o shorthand. */
export const PI_HELP = `Usage: /md2pdf input.md [output.pdf] [options]

Options:
      --output PATH      Explicit PDF filename (alternative to positional output)
      --toc              Add linked table of contents (default: ${DEFAULTS.toc})
      --number-sections  Add heading numbering (default: ${DEFAULTS.numberSections})
      --paper a4|letter  Page format (default: ${DEFAULTS.paper})
      --browser-path PATH  Chrome, Chromium or Edge executable
      --force            Confirm/authorize overwrite of explicit output
      --help             Show Pi slash-command help

When output is omitted: input.pdf, then input-2.pdf, input-3.pdf, ...
For browser diagnostics, run md2pdf --check in a terminal.
`;
