#!/usr/bin/env node
import { parseArgs, HELP } from "./core/argv.js";
import { convertMarkdownToPdf, checkBrowser } from "./core/convert.js";

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) { console.log(HELP); return 0; }
    if (parsed.version) { console.log("pi-md2pdf 0.1.0"); return 0; }
    if (parsed.check) {
      const browser = await checkBrowser(parsed.options.browserPath);
      console.log("Browser: " + browser.version + "\nExecutable: " + browser.path +
        "\nHeadless PDF: OK (" + browser.pdfBytes + " bytes)");
      return 0;
    }
    const result = await convertMarkdownToPdf(parsed.options);
    console.log("Created " + result.output + " (" + result.bytes + " bytes)");
    return 0;
  } catch (err) {
    console.error("md2pdf: " + (err instanceof Error ? err.message : String(err)));
    return 1;
  }
}
if (process.argv[1] && /(?:^|[\\/])(?:cli\.(?:js|mjs|ts)|md2pdf)$/.test(process.argv[1])) {
  void main().then(code => { process.exitCode = code; });
}
