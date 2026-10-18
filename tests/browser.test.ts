import { describe, expect, it } from "vitest";
import { browserCandidates, resolveBrowser } from "../src/core/browser.js";
describe("cross-platform browser discovery", () => {
  it("prioritizes Edge on Windows across install roots", () => {
    const entries = browserCandidates("win32", {
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\Jane\\AppData\\Local",
    } as NodeJS.ProcessEnv);
    expect(entries[0]).toContain("Microsoft");
    expect(entries[0]).toContain("Edge");
    expect(entries[1]).toContain("Microsoft");
    expect(entries.some(p => p.includes("Google"))).toBe(true);
  });
  it("rejects an explicit invalid executable rather than silently falling back", () => {
    expect(() => resolveBrowser("/definitely/invalid/md2pdf/browser")).toThrow("Configured browser");
  });
});
