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

## Unverified / release blockers

- [ ] Run `npm install` and commit the generated `package-lock.json`.
- [ ] Run `npm run typecheck` and fix any API/type mismatches with the installed current Pi version.
- [ ] Run `npm test` and `npm run build` with dependencies installed.
- [ ] Run real `md2pdf --check` and render sample documents using `puppeteer-core` on a non-root host.
- [ ] Inspect PDF pages and compare with sanitized Chrome Markdown Viewer references; verify wide table and multipage behavior.
- [ ] Run `npm pack --dry-run`, then install the tarball and exercise both entry points.
- [ ] Test native Windows (Edge), Linux (Chromium) and macOS (Chrome/Edge) before claiming those combinations verified.
- [ ] Verify abort/timeouts, symlink asset restrictions, simultaneous writes, and no network egress under integration tests.
- [ ] Confirm Pi's direct command behavior in both interactive and noninteractive modes.
- [ ] Finalize transitive dependency and license review.
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
