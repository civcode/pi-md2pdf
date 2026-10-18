import { readFile, lstat, mkdtemp, rm, rename, link } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { renderMarkdown } from "./markdown.js";
import { DEFAULTS, prepareOptions, type ConversionOptions, type PreparedOptions } from "./options.js";
import { resolveBrowser, browserVersion } from "./browser.js";

const require = createRequire(import.meta.url);
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
async function stylesheet(): Promise<string> {
  const github = require.resolve("github-markdown-css/github-markdown-light.css");
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  // tsup places the entry points in dist/; Vitest executes src/core/convert.ts directly.
  // The CSS lives in styles/ at the package root in both cases.
  const candidates = [
    path.resolve(moduleDir, "../styles/print.css"),
    path.resolve(moduleDir, "../../styles/print.css"),
  ];
  let printCss: string | undefined;
  for (const candidate of candidates) {
    try {
      printCss = await readFile(candidate, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (printCss === undefined) {
    throw new Error("Print stylesheet missing; expected styles/print.css in the project or npm package");
  }
  return (await readFile(github, "utf8")) + "\n" + printCss;
}
export async function buildHtml(source: string, input: string, opts: { toc: boolean; numberSections: boolean }): Promise<string> {
  const rendered = await renderMarkdown(source, input, opts);
  const css = (await stylesheet()).replace(/<\/style/gi, "<\\/style");
  const title = path.basename(input).replace(/\.(md|markdown)$/i, "");
  return "<!doctype html><html lang=\"en\" data-md2pdf-theme=\"" + DEFAULTS.theme + "\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + escapeHtml(title) + "</title><style>" + css + "</style></head>" +
    '<body class="markdown-body">' + rendered.html + "</body></html>";
}
function abortError(signal?: AbortSignal): Error {
  const timedOut = (signal?.reason as { name?: string } | undefined)?.name === "TimeoutError";
  return Object.assign(new Error(timedOut ? "PDF conversion timed out" : "PDF conversion cancelled"), { name: timedOut ? "TimeoutError" : "AbortError" });
}
async function renderPdf(html: string, opts: PreparedOptions, pdfPath: string): Promise<void> {
  const browserPath = resolveBrowser(opts.browserPath);
  if (opts.signal?.aborted) throw abortError(opts.signal);
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true,
    timeout: Math.min(opts.timeoutMs, 30_000), args: ["--no-first-run", "--disable-extensions"] });
  const onAbort = () => { void browser.close(); };
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (opts.signal?.aborted) throw abortError(opts.signal);
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", request => {
      if (request.url().startsWith("data:") || request.url() === "about:blank") void request.continue();
      else void request.abort("blockedbyclient");
    });
    page.setDefaultTimeout(opts.timeoutMs);
    await page.setContent(html, { waitUntil: "load", timeout: opts.timeoutMs });
    await page.emulateMediaType("print");
    if (opts.signal?.aborted) throw abortError(opts.signal);
    await page.pdf({ path: pdfPath, format: opts.paper === "a4" ? "A4" : "Letter",
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      printBackground: true, timeout: opts.timeoutMs });
    if (opts.signal?.aborted) throw abortError(opts.signal);
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    await browser.close().catch(() => {});
  }
}
export interface ConversionResult { input: string; output: string; bytes: number; browser: string }
export async function convertMarkdownToPdf(options: ConversionOptions): Promise<ConversionResult> {
  const opts = await prepareOptions(options);
  opts.signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs)]) : AbortSignal.timeout(opts.timeoutMs);
  if (opts.signal?.aborted) throw abortError(opts.signal);
  const existing = await lstat(opts.output).then(() => true, (err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return false;
    throw err;
  });
  if (existing && !opts.overwrite) throw new Error("Output already exists (use --force to overwrite): " + opts.output);
  const browser = resolveBrowser(opts.browserPath);
  const source = await readFile(opts.input, "utf8");
  const html = await buildHtml(source, opts.input, opts);
  if (opts.signal?.aborted) throw abortError(opts.signal);
  const tmp = await mkdtemp(path.join(path.dirname(opts.output), ".md2pdf-"));
  const tempOutput = path.join(tmp, "rendered.pdf");
  try {
    await renderPdf(html, opts, tempOutput);
    const buffer = await readFile(tempOutput);
    if (buffer.byteLength < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Browser returned an invalid PDF");
    }
    if (opts.signal?.aborted) throw abortError(opts.signal);
    if (opts.overwrite) await rename(tempOutput, opts.output);
    else {
      try { await link(tempOutput, opts.output); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Output already exists: " + opts.output);
        throw error;
      }
    } // exclusive/atomic: never clobber an existing file
    return { input: opts.input, output: opts.output, bytes: buffer.byteLength, browser };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
export async function checkBrowser(pathOverride?: string): Promise<{ path: string; version: string; pdfBytes: number }> {
  const browserPath = resolveBrowser(pathOverride);
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true,
    timeout: 20_000, args: ["--no-first-run", "--disable-extensions"] });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent("<html><body><h1>md2pdf browser check</h1></body></html>");
    const pdf = await page.pdf({ format: "A4", timeout: 20_000 });
    if (Buffer.from(pdf).subarray(0, 5).toString() !== "%PDF-") throw new Error("Browser PDF check failed");
    return { path: browserPath, version: browserVersion(browserPath), pdfBytes: pdf.byteLength };
  } finally {
    await browser.close().catch(() => {});
  }
}
