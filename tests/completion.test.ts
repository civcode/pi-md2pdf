import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getMd2pdfArgumentCompletions } from "../src/ui/completion.js";

describe("Pi /md2pdf argument completion", () => {
  async function fixture() {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-md2pdf-complete-"));
    await mkdir(path.join(cwd, "docs"));
    await writeFile(path.join(cwd, "report.md"), "# Report");
    await writeFile(path.join(cwd, "report.markdown"), "# Report");
    await writeFile(path.join(cwd, "My Report.md"), "# Report");
    await writeFile(path.join(cwd, 'A "quoted" file.md'), "# Report");
    await writeFile(path.join(cwd, "not.txt"), "Not markdown");
    await writeFile(path.join(cwd, "docs", "nested file.md"), "# Nested");
    return cwd;
  }

  it("completes only local Markdown files and directories", async () => {
    const cwd = await fixture();
    try {
      const items = getMd2pdfArgumentCompletions("", cwd) ?? [];
      expect(items.map(item => item.value)).toContain("report.md");
      expect(items.map(item => item.value)).toContain("report.markdown");
      expect(items.map(item => item.value)).toContain('"My Report.md"');
      expect(items.map(item => item.value)).toContain("docs/");
      expect(items.map(item => item.value)).not.toContain("not.txt");
      expect(getMd2pdfArgumentCompletions("report.md", cwd)).toBeNull();
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it("preserves quoted prefixes and quotes filenames with spaces", async () => {
    const cwd = await fixture();
    try {
      const quoted = getMd2pdfArgumentCompletions('"My Re', cwd) ?? [];
      expect(quoted.map(item => item.value)).toContain('"My Report.md"');
      const escaped = getMd2pdfArgumentCompletions("My\\ Re", cwd) ?? [];
      expect(escaped.map(item => item.value)).toContain('"My Report.md"');
      const special = getMd2pdfArgumentCompletions("A", cwd) ?? [];
      expect(special.map(item => item.value)).toContain('"A \\"quoted\\" file.md"');
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it("completes nested Markdown files without searching other folders", async () => {
    const cwd = await fixture();
    try {
      const items = getMd2pdfArgumentCompletions("docs/nest", cwd) ?? [];
      expect(items.map(item => item.value)).toEqual(['"docs/nested file.md"']);
      expect(getMd2pdfArgumentCompletions("../", cwd)).toBeNull();
      expect(getMd2pdfArgumentCompletions("/tmp/", cwd)).toBeNull();
      expect(getMd2pdfArgumentCompletions("~/", cwd)).toBeNull();
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it("suggests flags with descriptions and retains preceding arguments", async () => {
    const cwd = await fixture();
    try {
      const flags = getMd2pdfArgumentCompletions("report.md --", cwd) ?? [];
      expect(flags.map(item => item.value)).toContain("report.md --toc");
      expect(flags.map(item => item.value)).toContain("report.md --paper");
      expect(flags.map(item => item.value)).toContain("report.md --output");
      expect(flags.map(item => item.value)).not.toContain("report.md -o");
      expect(flags.find(item => item.value === "report.md --number-sections")?.description)
        .toContain("heading numbers");
      expect((getMd2pdfArgumentCompletions('"My Report.md" --pa', cwd) ?? []).map(i => i.value))
        .toContain('"My Report.md" --paper');
      expect(getMd2pdfArgumentCompletions("report.md --toc", cwd)).toBeNull();
      expect((getMd2pdfArgumentCompletions("report.md --toc --", cwd) ?? []).map(i => i.value))
        .not.toContain("report.md --toc --toc");
      expect((getMd2pdfArgumentCompletions("--pa", cwd) ?? []).map(i => i.value))
        .toContain("--paper");
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it("completes paper values, then allows later flags", async () => {
    const cwd = await fixture();
    try {
      expect((getMd2pdfArgumentCompletions("report.md --paper ", cwd) ?? []).map(i => i.value))
        .toEqual(["report.md --paper a4", "report.md --paper letter"]);
      expect((getMd2pdfArgumentCompletions("report.md --paper l", cwd) ?? []).map(i => i.value))
        .toEqual(["report.md --paper letter"]);
      expect(getMd2pdfArgumentCompletions("report.md --paper letter", cwd)).toBeNull();
      expect((getMd2pdfArgumentCompletions('report.md --paper letter --to', cwd) ?? []).map(i => i.value))
        .toEqual(["report.md --paper letter --toc"]);
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it.skipIf(process.platform === "win32")("never follows a symlinked directory for local suggestions", async () => {
    const cwd = await fixture();
    const external = await mkdtemp(path.join(os.tmpdir(), "pi-md2pdf-external-"));
    try {
      await writeFile(path.join(external, "secret.md"), "# Secret");
      await symlink(external, path.join(cwd, "shortcut"));
      expect((getMd2pdfArgumentCompletions("short", cwd) ?? []).map(x => x.value))
        .not.toContain("shortcut/");
      // An explicit token must not allow the completion callback to follow
      // an external symlink even if the initial directory menu omitted it.
      expect(getMd2pdfArgumentCompletions("shortcut/sec", cwd)).toBeNull();
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });
});
