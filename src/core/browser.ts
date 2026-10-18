import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export class BrowserNotFoundError extends Error {
  constructor(message = "No compatible Chrome, Chromium, or Edge browser found. Install a browser or specify --browser-path / MD2PDF_BROWSER_PATH.") {
    super(message); this.name = "BrowserNotFoundError";
  }
}
function pathsInEnvironment(name: string): string[] {
  const suffixes = process.platform === "win32" ? ["", ".exe", ".cmd"] : [""];
  return (process.env.PATH ?? "").split(path.delimiter).flatMap(dir => suffixes.map(ext => path.join(dir, name + ext)));
}
function candidates(platform = process.platform, env = process.env): string[] {
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((v): v is string => !!v);
    return [
      ["Microsoft", "Edge", "Application", "msedge.exe"],
      ["Google", "Chrome", "Application", "chrome.exe"],
      ["Chromium", "Application", "chrome.exe"],
    ].flatMap(parts => roots.map(root => path.join(root, ...parts)));
  }
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(env.HOME ?? "", "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge"].flatMap(pathsInEnvironment);
}
function executable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch { return false; }
}
export function resolveBrowser(explicit?: string): string {
  const configured = explicit ?? process.env.MD2PDF_BROWSER_PATH;
  if (configured) {
    const absolute = path.resolve(configured);
    if (!executable(absolute)) throw new BrowserNotFoundError("Configured browser is missing or not executable: " + absolute);
    return absolute;
  }
  for (const file of candidates()) if (executable(file)) return file;
  throw new BrowserNotFoundError();
}
export function browserVersion(executablePath: string): string {
  const result = spawnSync(executablePath, ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (result.error || result.status !== 0) throw new BrowserNotFoundError("Browser could not be executed: " + executablePath);
  return (result.stdout || result.stderr).trim();
}
export const browserCandidates = candidates; // exported for tests
