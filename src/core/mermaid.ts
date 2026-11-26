import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Browser, BrowserContext, HTTPRequest, Page } from "puppeteer-core";

const require = createRequire(import.meta.url);
const ORIGIN = "https://md2pdf-mermaid.invalid";
const ENTRY = ORIGIN + "/mermaid.esm.min.mjs";
const HTML = "<!doctype html><html><head><meta charset=\"utf-8\">" +
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; " +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; " +
  "object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'\">" +
  "</head><body></body></html>";

export const MERMAID_LIMITS = { diagrams: 50, source: 50_000, svg: 5 * 1024 * 1024, total: 30 * 1024 * 1024 } as const;

export function validateMermaidSource(source: string): void {
  if (!source.trim()) throw new Error("Empty Mermaid diagram");
  if (source.length > MERMAID_LIMITS.source) throw new Error("Mermaid diagram exceeds source limit");
  // Do not permit document-controlled configuration, including security or HTML overrides.
  if (/%%\s*\{/.test(source) || /^\s*---(?:\r?\n|$)/.test(source)) {
    throw new Error("Mermaid configuration directives and YAML frontmatter are not supported");
  }
}

// This is a synthetic origin, not a server. Every request is answered from
// fixed HTML or the installed Mermaid dist directory, or is aborted. No
// request is ever continued to the network or a user-controlled file path.
export function localMermaidModule(url: string): string | undefined {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return undefined; }
  if (parsed.origin !== ORIGIN || parsed.search || parsed.hash) return undefined;
  const relative = parsed.pathname.slice(1);
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|mjs)$/.test(relative)) return undefined;
  return relative;
}

async function intercept(request: HTTPRequest, dist: string): Promise<void> {
  try {
    if (request.method() === "GET" && request.url() === ORIGIN + "/" && request.isNavigationRequest()) {
      await request.respond({ status: 200, contentType: "text/html; charset=utf-8", body: HTML });
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
    let count = 0;
    return {
      async render(source) {
        validateMermaidSource(source);
        const id = "md2pdf-diagram-" + ++count;
        const svg = await page.evaluate(async (moduleUrl, definition, diagramId) => {
          // Only the trusted, locally installed module is executed. The
          // diagram definition is passed as a data argument, never as code.
          const { default: mermaid } = await import(moduleUrl);
          mermaid.initialize({
            startOnLoad: false, securityLevel: "strict", htmlLabels: false,
            flowchart: { htmlLabels: false }, theme: "default",
            maxTextSize: 50_000, maxEdges: 500, suppressErrorRendering: true,
            secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize",
              "maxEdges", "suppressErrorRendering", "htmlLabels", "flowchart"],
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
        }, ENTRY, source, id);
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
