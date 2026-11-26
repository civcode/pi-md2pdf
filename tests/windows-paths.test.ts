import { describe, expect, it } from "vitest";
import path from "node:path";
import { isWithinDirectory } from "../src/core/workspace.js";

describe("cross-platform working-directory containment", () => {
  it("permits Windows paths below cwd regardless of case", () => {
    const root = "C:\\Work\\Pi Project";
    expect(isWithinDirectory(root, "c:\\work\\pi project\\Report.md", path.win32)).toBe(true);
    expect(isWithinDirectory(root, "C:\\Work\\Pi Project", path.win32)).toBe(true);
    expect(isWithinDirectory(root, "C:\\Work\\Pi Project\\docs\\Sub Folder\\Notes.md", path.win32)).toBe(true);
  });

  it("rejects parent traversal, lookalike names, and other drive letters", () => {
    const root = "C:\\Work\\Project";
    expect(isWithinDirectory(root, "C:\\Work\\Project\\..\\Secrets\\secret.md", path.win32)).toBe(false);
    expect(isWithinDirectory(root, "C:\\Work\\Project-copy\\notes.md", path.win32)).toBe(false);
    expect(isWithinDirectory(root, "D:\\Work\\Project\\notes.md", path.win32)).toBe(false);
  });

  it("supports Windows UNC shares but rejects other shares or servers", () => {
    const root = "\\\\server\\team-share\\project";
    expect(isWithinDirectory(root, "\\\\SERVER\\TEAM-SHARE\\project\\docs\\notes.md", path.win32)).toBe(true);
    expect(isWithinDirectory(root, "\\\\server\\team-share\\project-backup\\notes.md", path.win32)).toBe(false);
    expect(isWithinDirectory(root, "\\\\server\\other-share\\project\\notes.md", path.win32)).toBe(false);
    expect(isWithinDirectory(root, "\\\\other-server\\team-share\\project\\notes.md", path.win32)).toBe(false);
  });

  it("keeps POSIX containment strict", () => {
    expect(isWithinDirectory("/tmp/project", "/tmp/project/doc.md", path.posix)).toBe(true);
    expect(isWithinDirectory("/tmp/project", "/tmp/project/../secret.md", path.posix)).toBe(false);
    expect(isWithinDirectory("/tmp/project", "/tmp/project-other/doc.md", path.posix)).toBe(false);
  });
});
