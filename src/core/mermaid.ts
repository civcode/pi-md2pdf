import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { parseDocument } from "yaml";
import type { Browser, BrowserContext, HTTPRequest, Page } from "puppeteer-core";

const require = createRequire(import.meta.url);
const ORIGIN = "https://md2pdf-mermaid.invalid";
const BOOTSTRAP_URL = ORIGIN + "/bootstrap.mjs";
// This literal module is served directly to Chromium, never transformed by
// Vitest/Vite or tsup. Only installed Mermaid code is imported.
const BOOTSTRAP = 'import mermaid from "./mermaid.esm.min.mjs";\n' +
  'mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });\n' +
  'globalThis.__md2pdfMermaid = mermaid;\n';
type MermaidGlobal = typeof globalThis & { __md2pdfMermaid?: typeof import("mermaid").default };
const HTML = "<!doctype html><html><head><meta charset=\"utf-8\">" +
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; " +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; " +
  "object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'\">" +
  '<script type="module" src="/bootstrap.mjs"></script></head><body></body></html>';

export const MERMAID_LIMITS = { diagrams: 50, source: 50_000, svg: 5 * 1024 * 1024, total: 30 * 1024 * 1024 } as const;

type Metadata = Record<string, unknown>;

function record(value: unknown, field: string): Metadata {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("Mermaid " + field + " must be a mapping");
  }
  return value as Metadata;
}

function parseMetadata(source: string): Metadata {
  const doc = parseDocument(source, { schema: "core", strict: true, uniqueKeys: true });
  if (doc.errors.length) throw new Error("Invalid Mermaid metadata: " + doc.errors[0]!.message);
  // Do not permit aliases (including cyclic or exponentially expanded YAML).
  return record(doc.toJS({ maxAliasCount: 0 }) ?? {}, "metadata");
}

const choices: Record<string, readonly string[]> = {
  theme: ["default", "base", "neutral", "dark", "forest"],
  layout: ["dagre", "elk"],
  look: ["classic", "handDrawn", "neo"],
  "flowchart.curve": ["basis", "linear", "cardinal", "monotoneX", "step", "stepAfter", "stepBefore", "natural"],
  "flowchart.defaultRenderer": ["dagre-wrapper", "dagre-d3", "elk"],
  "gantt.displayMode": ["", "compact"],
};
const numeric = new Set(["flowchart.nodeSpacing", "flowchart.rankSpacing", "flowchart.padding",
  "sequence.actorMargin", "sequence.messageMargin", "sequence.diagramMarginX", "sequence.diagramMarginY",
  "gantt.barHeight", "gantt.barGap", "gantt.topPadding", "gantt.leftPadding", "gantt.rightPadding"]);
const boolean = new Set(["flowchart.useMaxWidth", "sequence.useMaxWidth", "sequence.mirrorActors",
  "sequence.showSequenceNumbers", "gantt.useMaxWidth", "gantt.topAxis", "wrap"]);
const sections = new Set(["flowchart", "sequence", "gantt", "themeVariables"]);

function safeConfig(input: Metadata, prefix = ""): Metadata {
  const out: Metadata = {};
  for (const [key, value] of Object.entries(input)) {
    const field = prefix + key;
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Unsupported Mermaid configuration: " + field);
    }
    const allowed = Object.hasOwn(choices, field) ? choices[field] : undefined;
    if (!prefix && sections.has(key)) {
      out[key] = safeConfig(record(value, field), field + ".");
    } else if (allowed && typeof value === "string" && allowed.includes(value)) {
      out[key] = value;
    } else if (numeric.has(field) && typeof value === "number" &&
               Number.isFinite(value) && value >= 0 && value <= 1000) {
      out[key] = value;
    } else if (boolean.has(field) && typeof value === "boolean") {
      out[key] = value;
    } else if (prefix === "themeVariables." && /^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key) &&
               ((typeof value === "string" && /^[#a-zA-Z0-9 ,.%()-]{1,100}$/.test(value) &&
                 !/\b(?:url|var|attr|expression)\s*\(/i.test(value)) ||
                (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1000) ||
                typeof value === "boolean")) {
      out[key] = value;
    } else {
      throw new Error("Unsupported Mermaid configuration: " + field);
    }
  }
  return out;
}

// Accept ordinary diagram metadata, but pass only canonical, allowlisted
// configuration to Mermaid. Never forward the original YAML/directives.
export function normalizeMermaidSource(source: string): string {
  if (!source.trim()) throw new Error("Empty Mermaid diagram");
  if (source.length > MERMAID_LIMITS.source) throw new Error("Mermaid diagram exceeds source limit");
  let body = source.replace(/\r\n?/g, "\n");
  const metadata: Metadata = {};
  const config: Metadata = {};
  const mergeConfig = (value: Metadata) => {
    for (const [key, next] of Object.entries(safeConfig(value))) {
      config[key] = sections.has(key)
        ? { ...(config[key] as Metadata | undefined), ...(next as Metadata) }
        : next;
    }
  };
  const front = body.match(/^\s*---[ \t]*\n([\s\S]*?)\n[ \t]*---[ \t]*(?:\n|$)/);
  if (front) {
    const parsed = parseMetadata(front[1]!);
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "config") mergeConfig(record(value, "config"));
      else if (key === "title" && typeof value === "string" &&
               value.length <= 500 && !/[<>\r\n]/.test(value)) metadata.title = value;
      else if (key === "displayMode" && (value === "compact" || value === "")) metadata.displayMode = value;
      else throw new Error("Unsupported Mermaid frontmatter field: " + key);
    }
    body = body.slice(front[0].length);
  } else if (/^\s*---[ \t]*(?:\n|$)/.test(body)) {
    throw new Error("Unclosed Mermaid YAML frontmatter");
  }
  body = body.replace(/%%\s*\{([\s\S]*?)\}\s*%%/g, (_match, directive: string) => {
    const match = directive.match(/^\s*(?:init|initialize)\s*:\s*([\s\S]+)$/);
    if (!match) throw new Error("Unsupported Mermaid directive (only init/initialize are supported)");
    mergeConfig(parseMetadata(match[1]!));
    return "\n";
  });
  if (/%%\s*\{/.test(body) || /^\s*---[ \t]*(?:\n|$)/.test(body)) {
    throw new Error("Malformed or repeated Mermaid metadata");
  }
  if (!body.trim()) throw new Error("Empty Mermaid diagram");
  if (Object.keys(config).length) metadata.config = config;
  if (!Object.keys(metadata).length) return body;
  // JSON is valid YAML; only checked values are serialized into the header.
  return "---\n" + JSON.stringify(metadata) + "\n---\n" + body;
}

export function validateMermaidSource(source: string): void {
  normalizeMermaidSource(source);
}

// This is a synthetic origin, not a server. Every request is answered from
// fixed HTML or the installed Mermaid dist directory, or is aborted. No
// request is ever continued to the network or a user-controlled file path.
export function localMermaidModule(url: string): string | undefined {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return undefined; }
  if (parsed.origin !== ORIGIN || parsed.search || parsed.hash) return undefined;
  const relative = parsed.pathname.slice(1);
  if (!/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|mjs)$/.test(relative)) return undefined;
  if (relative !== "mermaid.esm.min.mjs" && !relative.startsWith("chunks/")) return undefined;
  return relative;
}

async function intercept(request: HTTPRequest, dist: string): Promise<void> {
  try {
    if (request.method() === "GET" && request.url() === ORIGIN + "/" && request.isNavigationRequest()) {
      await request.respond({ status: 200, contentType: "text/html; charset=utf-8", body: HTML });
      return;
    }
    if (request.method() === "GET" && request.resourceType() === "script" &&
        request.url() === BOOTSTRAP_URL) {
      await request.respond({ status: 200, contentType: "text/javascript; charset=utf-8", body: BOOTSTRAP });
      return;
    }
    const module = request.resourceType() === "script" && request.method() === "GET"
      ? localMermaidModule(request.url()) : undefined;
    if (module) {
      const body = await readFile(path.join(dist, module));
      await request.respond({ status: 200, contentType: "text/javascript; charset=utf-8", body });
      return;
    }
  } catch { /* missing local asset or closed page: fail closed */ }
  if (!request.isInterceptResolutionHandled()) await request.abort("blockedbyclient").catch(() => {});
}

export interface MermaidRenderer {
  render(source: string): Promise<string>;
  close(): Promise<void>;
}

export async function createMermaidRenderer(browser: Browser, timeout: number): Promise<MermaidRenderer> {
  const dist = path.dirname(require.resolve("mermaid/dist/mermaid.esm.min.mjs"));
  const context: BrowserContext = await browser.createBrowserContext();
  try {
    const page: Page = await context.newPage();
    await page.setJavaScriptEnabled(true);
    await page.setRequestInterception(true);
    page.on("request", request => { void intercept(request, dist).catch(() => {}); });
    page.setDefaultTimeout(timeout);
    await page.goto(ORIGIN + "/", { waitUntil: "load", timeout });
    // The load event waits for the non-async module script. Fail clearly if
    // an installed Mermaid module or one of its static imports did not load.
    const ready = await page.evaluate(() =>
      typeof (globalThis as MermaidGlobal).__md2pdfMermaid?.render === "function");
    if (!ready) throw new Error("Failed to load the local Mermaid browser module");
    let count = 0;
    return {
      async render(source) {
        const normalized = normalizeMermaidSource(source);
        const id = "md2pdf-diagram-" + ++count;
        const svg = await page.evaluate(async (definition, diagramId) => {
          // The browser loaded the trusted module via its own module loader.
          // Diagram text remains data, never executable JavaScript.
          const mermaid = (globalThis as MermaidGlobal).__md2pdfMermaid;
          if (!mermaid) throw new Error("Local Mermaid module is not initialized");
          mermaid.initialize({
            startOnLoad: false, securityLevel: "strict", htmlLabels: false,
            flowchart: { htmlLabels: false }, theme: "default", arrowMarkerAbsolute: false,
            maxTextSize: 50_000, maxEdges: 500, suppressErrorRendering: true,
            secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize",
              "maxEdges", "suppressErrorRendering", "htmlLabels", "arrowMarkerAbsolute", "themeCSS", "fontFamily", "altFontFamily"],
          });
          const { svg: result } = await mermaid.render(diagramId, definition);
          // Never execute the returned bindFunctions or insert the diagram
          // in the final document as active markup.
          const doc = new DOMParser().parseFromString(result, "image/svg+xml");
          const root = doc.documentElement;
          if (doc.doctype || root.localName !== "svg" ||
              root.namespaceURI !== "http://www.w3.org/2000/svg" ||
              doc.querySelector("parsererror")) throw new Error("Invalid Mermaid SVG");
          const blocked = new Set(["script", "foreignobject", "iframe", "object",
            "embed", "audio", "video", "animate", "animatemotion", "animatetransform", "set"]);
          const checkCss = (value: string) => {
            if (/@import\b/i.test(value)) throw new Error("External SVG stylesheet is not supported");
            for (const match of value.matchAll(/url\s*\(\s*([^)]*)\)/gi)) {
              const target = match[1]!.trim().replace(/^(['"])(.*)\1$/, "$2");
              if (!/^#[\w:.-]+$/.test(target)) throw new Error("External SVG resource is not supported");
            }
          };
          for (const element of Array.from(root.querySelectorAll("*")).concat(root)) {
            if (element.namespaceURI !== "http://www.w3.org/2000/svg" ||
                blocked.has(element.localName.toLowerCase())) throw new Error("Unsafe or unsupported SVG element");
            for (const attr of Array.from(element.attributes)) {
              const name = attr.localName.toLowerCase();
              if (name.startsWith("on")) throw new Error("SVG event handlers are not supported");
              if (name === "href" || name === "src") {
                if (!/^#[\w:.-]+$/.test(attr.value)) throw new Error("External SVG references are not supported");
              }
              checkCss(attr.value);
            }
            if (element.localName === "style") checkCss(element.textContent ?? "");
          }
          const view = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
          if (view.length !== 4 || !view.every(Number.isFinite) || view[2]! <= 0 || view[3]! <= 0) {
            throw new Error("Mermaid SVG has invalid dimensions");
          }
          root.setAttribute("width", String(view[2]));
          root.setAttribute("height", String(view[3]));
          root.removeAttribute("style");
          return new XMLSerializer().serializeToString(root);
        }, normalized, id);
        if (Buffer.byteLength(svg, "utf8") > MERMAID_LIMITS.svg) throw new Error("Mermaid SVG exceeds size limit");
        return svg;
      },
      close: () => context.close(),
    };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}
