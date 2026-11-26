#!/usr/bin/env node
/**
 * Loads the *compiled* pi-md2pdf extension using Pi's real loader.
 * Run after `npm run build`; pass an installed package root to verify a tarball.
 * No model calls, browser launches, settings changes, or GitHub Actions.
 */
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

const root = path.resolve(process.argv[2] ?? process.cwd());
const entry = path.join(root, "dist", "extension.js");
const temp = await mkdtemp(path.join(os.tmpdir(), "pi-md2pdf-loader-"));
try {
  if (!(await stat(entry)).isFile()) throw new Error("Compiled extension missing: " + entry);
  // Loading the package directory exercises the pi.extensions manifest as
  // installed, not just a direct import of its entry file.
  const result = await discoverAndLoadExtensions([root], temp, temp);
  if (result.errors.length) {
    throw new Error("Pi loader errors:\n" + result.errors.map(e => e.path + ": " + e.error).join("\n"));
  }
  if (result.extensions.length !== 1) {
    throw new Error("Expected one Pi extension, found " + result.extensions.length);
  }
  const extension = result.extensions[0];
  if (!extension.commands.has("md2pdf")) throw new Error("Missing /md2pdf command");
  if (!extension.tools.has("markdown_to_pdf")) throw new Error("Missing markdown_to_pdf tool");
  console.log("Pi loader OK: /md2pdf and markdown_to_pdf registered from " + root);
  for (const warning of result.warnings) {
    console.warn("Pi loader warning: " + warning.path + ": " + warning.warning);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
