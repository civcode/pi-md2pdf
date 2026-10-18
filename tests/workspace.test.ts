import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveWorkspacePaths, WorkspacePathError } from "../src/core/workspace.js";

describe("agent tool working-directory boundary", () => {
  it("uses the exact same-named Markdown file in cwd, not a file elsewhere", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-scope-"));
    try {
      const cwd = path.join(root, "project");
      const other = path.join(root, "unrelated");
      await mkdir(cwd);
      await mkdir(other);
      await writeFile(path.join(cwd, "specification.md"), "# Correct local specification");
      await writeFile(path.join(other, "specification.md"), "# Wrong unrelated specification");

      const resolved = await resolveWorkspacePaths(cwd, "specification.md");
      expect(resolved.input).toBe(path.join(cwd, "specification.md"));
      expect(resolved.output).toBeUndefined();
      expect(await readFile(resolved.input, "utf8")).toContain("Correct local");
      expect(await resolveWorkspacePaths(cwd, resolved.input)).toEqual(resolved);
      await expect(resolveWorkspacePaths(cwd, path.join(other, "specification.md")))
        .rejects.toBeInstanceOf(WorkspacePathError);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not substitute a matching file from another directory when local input is missing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-missing-"));
    try {
      const cwd = path.join(root, "cwd"), other = path.join(root, "other");
      await mkdir(cwd);
      await mkdir(other);
      await writeFile(path.join(other, "specification.md"), "# Exists elsewhere");
      await expect(resolveWorkspacePaths(cwd, "specification.md"))
        .rejects.toThrow(/not found in Pi's working directory/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("accepts subfolders but rejects parent traversal and arbitrary absolute output paths", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-subdir-"));
    try {
      const cwd = path.join(root, "cwd");
      await mkdir(path.join(cwd, "docs"), { recursive: true });
      await writeFile(path.join(cwd, "docs", "notes.md"), "# Notes");
      expect(await resolveWorkspacePaths(cwd, "docs/notes.md", "docs/export.pdf"))
        .toEqual({ input: path.join(cwd, "docs", "notes.md"), output: path.join(cwd, "docs", "export.pdf") });
      await expect(resolveWorkspacePaths(cwd, "../other.md")).rejects.toThrow(/outside/);
      await expect(resolveWorkspacePaths(cwd, "docs/notes.md", "../export.pdf")).rejects.toThrow(/outside/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it.skipIf(process.platform === "win32")("rejects input and output directories that are symlinks outside cwd", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "md2pdf-symlink-scope-"));
    try {
      const cwd = path.join(root, "cwd"), other = path.join(root, "other");
      await mkdir(cwd); await mkdir(other);
      await writeFile(path.join(cwd, "local.md"), "# Here");
      await writeFile(path.join(other, "external.md"), "# There");
      await symlink(path.join(other, "external.md"), path.join(cwd, "linked.md"));
      await symlink(other, path.join(cwd, "linked-dir"));
      await expect(resolveWorkspacePaths(cwd, "linked.md")).rejects.toThrow(/resolves outside/);
      await expect(resolveWorkspacePaths(cwd, "linked-dir/external.md")).rejects.toThrow(/resolves outside/);
      await expect(resolveWorkspacePaths(cwd, "local.md", "linked-dir/export.pdf"))
        .rejects.toThrow(/resolves outside/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
