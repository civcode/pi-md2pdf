# Validation status — initial implementation

**Date:** 2026-10-18  
**Branch:** `feat/initial-implementation`  
**Status:** Code committed; not a validated release.

## What was completed

- Pi extension entry point with `/md2pdf` and `markdown_to_pdf`.
- Standalone `md2pdf` executable sharing the converter.
- Markdown-to-HTML rendering, linked TOC, heading numbering, syntax highlighting, GitHub Light and print CSS.
- Local PNG/JPEG/WebP inlining with directory containment; no remote resources or raw HTML execution.
- Existing-browser discovery, headless Puppeteer rendering, atomic non-overwriting output, timeouts and cancellation hooks.
- Unit and browser integration test sources, sample fixture, README, compatibility documentation and npm package manifest.
- No GitHub Actions workflows, deployments or publication.

## Verification performed

- GitHub connector confirmed newly committed source, test, stylesheet, README and package metadata files exist on the remote feature branch.
- Confirmed required npm dependency names and Pi package extension/peer dependency conventions against published documentation.
- Local environment contains Node `v22.16.0`, npm `10.9.2`, TypeScript `5.8.3` and Chromium `144.0.7559.96`.
- Tried an offline npm install: failed with `ENOTCACHED` because required dependencies are not present.
- Tried to access the npm registry: failed with `EAI_AGAIN` DNS resolution.
- Tried an independent Chromium headless `--print-to-pdf` smoke test: timed out after 30 seconds in this container. This is **not** a test of the packaged extension.
- No GitHub Actions execution was used.

## Linux tester results and follow-up (2026-10-18)

A contributor tested the feature branch on a Linux machine:

- `npm install`: **passed** (288 dependencies added).
- `npm run typecheck`: one TypeScript error, missing `details` in a Pi tool `onUpdate` call.
- `npm test`: **15 of 16 tests passed**. The browser integration test failed before conversion because the print stylesheet was incorrectly resolved as `src/styles/print.css`.
- `npm install` audit summary: **11 advisories** (1 low, 1 moderate, 7 high, 2 critical). These are unresolved until `npm audit --json` and `npm audit --omit=dev` are evaluated; do not blindly use `npm audit fix --force`.

Follow-up commits on the feature branch:

- Added required `details` field to Pi progress updates.
- Resolved print CSS relative to both `dist/` (compiled build) and `src/core/` (Vitest/source loading).
- Added `tests/styles.test.ts` to catch print stylesheet loading regressions.

**Validation still pending after those commits:** rerun `npm run typecheck`, `npm test`, `npm run build`, `npm run pack:check`, browser smoke test, and inspect an actual generated PDF. The above results refer to the version *before* the fixes and must not be presented as passing post-fix tests.

## Linux retest — successful baseline (2026-10-18)

The user reran validation on the feature branch after fixing the Pi progress update and stylesheet lookup:

- `npm run typecheck`: **passed** (0 TS errors).
- `npm test`: **17/17 tests passed** across 7 files, including the Chromium PDF integration test.
- `npm run build`: **passed** (tsup ESM outputs `dist/cli.js`, `dist/extension.js`, and one shared chunk).
- `npm run pack:check`: **passed**; tarball 11.0 kB compressed, 31.4 kB unpacked (not including dependencies).
- `node dist/cli.js --check`: **passed**, Chromium 155.0.8059.39 (snap), 8,896-byte diagnostic PDF.
- Real conversion: **passed**, generated a 37,944-byte PDF from `tests/fixtures/sample.md`.

The uploaded sample PDF was independently inspected: one A4 page, selectable text, embedded Noto Sans/Liberation Mono fonts, **five working internal TOC links** plus an external URL hyperlink, styled headings/table/code, and correct German characters. This verifies the simple fixture, **not** long tables or multipage layouts.

### Security audit reported by tester

Before remediation, `npm audit` reported **11 advisories** (1 low, 1 moderate, 7 high, 2 critical); `npm audit --omit=dev` reported **7 high** through `puppeteer-core` 24.x's `@puppeteer/browsers` dependency chain (`basic-ftp`, `extract-zip`, etc.).

The source manifest has been updated to **`puppeteer-core` ^25.14.0** and **`vitest` ^5.0.5**, following the versions suggested by npm audit and confirmed in upstream releases. These are **major-version upgrades and are not yet tested**. The installed lockfile still needs regeneration. The `esbuild` advisory may be fixable with a nonbreaking `npm audit fix`, but audit output must be checked again first.

Run locally from the feature branch:

```sh
git pull --ff-only
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
node dist/cli.js --check
npm audit
npm audit --omit=dev
git status --short
```

Review and **commit the regenerated `package-lock.json`** after successful checks. Do not run `npm audit fix --force` indiscriminately. Changes remain on a draft PR, not on `main`.

## Unverified / release blockers

- [ ] Regenerate, validate, and commit `package-lock.json` after upgrading dependencies.
- [ ] Re-run `npm run typecheck` after the security dependency upgrades (pre-upgrade test passed).
- [ ] Re-run `npm test` and `npm run build` after the security dependency upgrades (pre-upgrade tests passed).
- [x] Run real `md2pdf --check` and render a simple sample on Linux using Chromium 155 (pre-upgrade).
- [ ] Inspect PDF pages and compare with sanitized Chrome Markdown Viewer references; verify wide table and multipage behavior.
- [ ] Run `npm pack --dry-run`, then install the tarball and exercise both entry points.
- [ ] Test native Windows (Edge), Linux (Chromium) and macOS (Chrome/Edge) before claiming those combinations verified.
- [ ] Verify abort/timeouts, symlink asset restrictions, simultaneous writes, and no network egress under integration tests.
- [ ] Confirm Pi's direct command behavior in both interactive and noninteractive modes.
- [ ] Confirm post-upgrade `npm audit` and `npm audit --omit=dev` results; finalize license review.
- [ ] Remove `private: true`, tag and publish to npm **only after explicit release approval**.

## Immediate validation commands

```sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
node dist/cli.js --check
node dist/cli.js tests/fixtures/sample.md -o sample.pdf --toc --number-sections
pi --extension ./dist/extension.js
```

Do not execute GitHub Actions as a workaround for these environment limitations; run the checks in a suitable local development workspace.
