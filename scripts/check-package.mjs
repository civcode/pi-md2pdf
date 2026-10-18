#!/usr/bin/env node
/**
 * End-to-end package smoke check. Builds are an explicit prerequisite.
 * Packs the current tree, installs its tarball in a temporary isolated npm
 * prefix, checks CLI and Pi loader, and renders a PDF with a system browser.
 * Never publishes or mutates global Pi/npm installations.
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "pi-md2pdf-package-"));
const dest = path.join(temp, "packed");
const install = path.join(temp, "consumer");
const env = { ...process.env, NPM_CONFIG_UPDATE_NOTIFIER: "false" };
function npmRun(args, cwd = project) {
  // npm scripts expose the actual npm CLI JavaScript entry point. Using Node
  // directly avoids .cmd spawn differences on native Windows.
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  }
  return run(process.platform === "win32" ? "npm.cmd" : "npm", args, cwd);
}
function run(bin, args, cwd = project) {
  const result = spawnSync(bin, args, {
    cwd, env, encoding: "utf8", timeout: 180_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(bin + " " + args.join(" ") + " failed (" + result.status + ")\n" +
      (result.stdout ?? "") + "\n" + (result.stderr ?? ""));
  }
  return result.stdout;
}
try {
  await mkdir(dest, { recursive: true });
  console.log("Packing pi-md2pdf into a temporary directory...");
  // Test the *real* packing path, including prepack. npm emits lifecycle
  // logs before its final filename, so parse the last nonempty output line.
  const output = npmRun(["pack", "--pack-destination", dest]);
  const filename = output.trim().split(/\r?\n/).at(-1);
  if (!filename || !/^pi-md2pdf-[0-9][a-zA-Z0-9.+-]*\\.tgz$/.test(filename)) {
    throw new Error("npm pack did not return the expected pi-md2pdf tarball name: " + filename);
  }
  const tarball = path.join(dest, filename);
  await stat(tarball);
  // A normal consumer must be able to install *only* the published artifact.
  // Ignoring install scripts avoids arbitrary postinstall execution.
  console.log("Installing the tarball in a clean isolated npm prefix...");
  npmRun(["install", "--prefix", install, "--omit=dev", "--ignore-scripts",
    "--no-audit", "--no-fund", "--no-save", tarball], temp);
  const packageRoot = path.join(install, "node_modules", "pi-md2pdf");
  const cli = path.join(packageRoot, "dist", "cli.js");
  await stat(cli);
  await stat(path.join(packageRoot, "dist", "extension.js"));
  await stat(path.join(packageRoot, "styles", "print.css"));
  for (const file of ["LICENSE", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md", "README.md"]) {
    await stat(path.join(packageRoot, file));
  }
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  if (manifest.private === true || manifest.version !== "0.1.0" ||
      manifest.bin?.md2pdf !== "./dist/cli.js" ||
      !manifest.pi?.extensions?.includes("./dist/extension.js")) {
    throw new Error("Packed npm/Pi manifest differs from expected release candidate");
  }
  const help = run(process.execPath, [cli, "--help"], temp);
  if (!help.includes("md2pdf input.md")) throw new Error("Packed CLI help is missing");

  // Check the installed extension with Pi's real loader, not a mocked API.
  console.log("Verifying package with the real Pi extension loader...");
  const loader = path.join(project, "scripts", "check-load.mjs");
  const loaded = run(process.execPath, [loader, packageRoot], project);
  process.stdout.write(loaded);

  console.log("Rendering sample PDF from the installed CLI...");
  const md = path.join(temp, "fixture.md");
  await writeFile(md, "# Package smoke test\n\n| Check | Result |\n|---|---|\n| PDF | OK |\n");
  const output = path.join(temp, "fixture.pdf");
  process.stdout.write(run(process.execPath, [cli, md, "-o", output], temp));
  const pdf = await readFile(output);
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Packed CLI output is not a PDF");
  console.log("Package smoke OK: clean npm install, Pi loader, CLI and PDF (" + pdf.byteLength + " bytes)");
} finally {
  await rm(temp, { recursive: true, force: true });
}
