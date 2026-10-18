# pi-md2pdf — Development Roadmap

**Status:** Planned; no implementation started  
**Last reviewed:** 2026-10-18  
**Repository:** https://github.com/civcode/pi-md2pdf  
**Normative scope:** [v1 Specification](SPECIFICATION.md)

## Delivery principles

- One npm package; **one shared conversion engine** used by Pi's `/md2pdf` slash command, its `markdown_to_pdf` agent tool, and the standalone `md2pdf` CLI.
- Build the engine first, then CLI, then Pi integration. The PDF design and safety invariants should not change among entry points.
- Small, verifiable milestones. Test locally and commit/push meaningful progress to the working development branch after each milestone.
- No GitHub Actions executions. Do not add automatic workflow triggers; any future workflow is manual-only (`workflow_dispatch`) unless explicitly requested.
- **Do not publish npm releases, create external package listings, or enable automation without explicit authorization.**
- Prefer fidelity to the selected Chrome Markdown Viewer/GitHub Light appearance over premature feature expansion.
- Missing platform coverage is reported honestly; never mark Windows or macOS tested without running real checks there.

## Milestones overview

| Phase | Milestone | Outcome | Exit gate |
| --- | --- | --- | --- |
| 0 | API and design baseline | Verified dependencies, supported runtime matrix, rendering fixtures | Key choices documented |
| 1 | Repository foundation | Build/test/package skeleton | Local checks pass |
| 2 | Shared PDF engine | Reliable offline Markdown-to-PDF rendering | Representative PDF fixtures pass |
| 3 | Standalone CLI | `md2pdf` usable outside Pi | CLI end-to-end tests pass |
| 4 | Pi extension | `/md2pdf` and `markdown_to_pdf` | Pi manual smoke test passes |
| 5 | Quality and security | Visual regression, cleanup, negative tests, cross-platform review | v1 acceptance criteria pass |
| 6 | Release preparation | Documentation, npm tarball, package-catalog metadata | Release candidate ready for approval |

No calendar deadlines or guaranteed durations are assumed. Phases may be split into smaller commits as needed.

## Phase 0 — Confirm interfaces and rendering baseline

**Tasks**
- [ ] Confirm current Pi extension `registerCommand` and `registerTool` interfaces against https://pi.dev/docs/latest/extensions and its type declarations.
- [ ] Confirm Pi package manifest, peer dependency rules, and npm `bin` behavior using https://pi.dev/docs/latest/packages.
- [ ] Pin or bound tested versions for Node.js, Pi, `puppeteer-core`, `markdown-it`, `markdown-it-anchor`, `highlight.js`, and `github-markdown-css`.
- [ ] Check licenses/attribution requirements for all shipped stylesheet and code dependencies.
- [ ] Establish source Markdown fixtures: basic text, tables, long/wide tables, code blocks, local images, duplicate headings, multilingual text, links, TOC, and heading numbering.
- [ ] Capture a GitHub Light reference visual target based on the Chrome Markdown Viewer screenshots; use sanitized fixtures (not personal financial data).
- [ ] Decide and document maximum input/image sizes, initial rendering timeout, and node/browser minimum versions.

**Exit gate:** no unknowns blocking the chosen architecture; fixture inputs and visual success criteria are reviewable.

**Suggested commit:** `docs: record compatibility and rendering baseline`.

## Phase 1 — Repository and packaging foundation

**Tasks**
- [ ] Set up `package.json`, TypeScript config, lockfile, formatter/linter and Vitest.
- [ ] Add `src/core`, `src/cli.ts`, `src/extension.ts`, `styles` and `tests` scaffolding.
- [ ] Add explicit exports/packaged entry points for CLI and Pi extension; ensure runtime imports resolve correctly in published files.
- [ ] Add `README.md`, `LICENSE` (MIT proposed; confirm owner preference), `.gitignore` and contribution/test instructions.
- [ ] Configure `npm run build`, `npm test`, `npm run lint`, and `npm pack --dry-run` for local execution.
- [ ] Ensure build artifacts required at runtime are included in the npm tarball, including CSS; exclude unwanted fixtures and generated junk.
- [ ] Keep host-provided Pi packages as peer dependencies, not copied into runtime dependencies.

**Exit gate:** clean local install/build/test, importable shared library shell, and package tarball containing intended files.

**Suggested commits:** `chore: scaffold TypeScript project`; `build: package Pi and CLI entry points`.

## Phase 2 — Shared Markdown-to-PDF engine

**Tasks**
- [ ] Implement typed normalized options and validation; a single `convertMarkdownToPdf` entry point.
- [ ] Parse Markdown, escape untrusted raw HTML, render GitHub-style tables/headings/code with local syntax highlighting.
- [ ] Create stable heading anchors and optional linked TOC and heading numbering. Do not promise printed TOC page numbers.
- [ ] Package light GitHub stylesheet and print CSS with A4/Letter sizing, 15 mm margins, background colors, code wrapping, and page break guidance.
- [ ] Resolve local PNG/JPEG/WebP image paths relative to the source; enforce directory-boundary and size policies; reject network and unsupported resources.
- [ ] Discover existing browser binaries on Linux, Windows and macOS, with `MD2PDF_BROWSER_PATH` and explicit override precedence.
- [ ] Launch `puppeteer-core` in headless mode, render self-contained HTML without a local HTTP server, and deny external network requests.
- [ ] Implement temp-output validation, no-overwrite default, cancellation, timeout and process cleanup.
- [ ] Add unit tests for parsing, TOC/numbering, browser search-order/path behavior, input validation, resource restrictions and output handling.
- [ ] Run initial Linux browser integration tests with real PDF files and review renderings.

**Exit gate:** direct library usage exports a valid, visually acceptable PDF without cloud/network access or browser GUI.

**Suggested commits:** `feat: implement Markdown and print styling`; `feat: add browser discovery and PDF rendering`; `test: cover offline assets and cleanup`.

## Phase 3 — Standalone `md2pdf` CLI

**Tasks**
- [ ] Implement usage: `md2pdf input.md [-o output.pdf] [--toc] [--number-sections] [--paper a4|letter] [--force] [--browser-path PATH]`.
- [ ] Implement `--help`, `--version` and `--check` (including a safe headless PDF self-test).
- [ ] Ensure filenames with spaces and absolute/relative paths are handled without shell interpolation.
- [ ] Add predictable stderr diagnostics and nonzero exit statuses for invalid args, absent source, absent browser, output conflict and conversion failure.
- [ ] Test success/failure paths from a non-project working directory, including relative linked assets.
- [ ] Test `npm pack` then install the tarball into a temporary directory and run its `md2pdf` binary.

**Exit gate:** CLI works in a regular terminal, under SSH/tmux, and without Pi installed.

**Suggested commit:** `feat: add standalone md2pdf CLI`.

## Phase 4 — Pi extension integration

**Tasks**
- [ ] Register a direct `/md2pdf` slash command, including input/output and supported options; no model call.
- [ ] Register the agent-callable `markdown_to_pdf` tool with a typed schema and result, forwarding to the shared engine.
- [ ] Add progress messages and completed output path; use Pi UI APIs only when that mode supports them.
- [ ] Confirm overwrite only interactively when possible; require explicit `overwrite` in the tool; refuse overwrite in non-interactive command mode.
- [ ] Forward cancellation to the renderer and ensure no orphaned browsers.
- [ ] Test development load via Pi's extension flag or a local package installation.
- [ ] Compare CLI-generated and Pi-generated outputs for equivalent options and browsers.

**Exit gate:** successful direct `/md2pdf report.md` and agent tool exports, with the exact same styling as the CLI.

**Suggested commit:** `feat: integrate Pi slash command and agent tool`.

## Phase 5 — Rendering quality, security and compatibility

**Tasks**
- [ ] Compare PDFs visually against sanitized GitHub/Chrome Markdown Viewer references: fonts, spacing, table striping, borders and code highlighting.
- [ ] Check multipage reports, wide tables, repeated headers, long lines, Unicode, German umlauts, special characters, links, missing images and duplicate headings.
- [ ] Verify A4 and Letter, TOC click targets, independent heading numbering, and clear non-support for printed TOC page numbers.
- [ ] Test unsafe input: raw HTML, script tags, remote image/style URLs, traversal via `../` and symlinks, huge files and malformed Markdown.
- [ ] Test browser startup failures, crash/timeouts, signal cancellation, unwritable destinations, pre-existing outputs and concurrent conversions.
- [ ] Assert cleanup of temp files and browser processes; confirm no network access or unexpected background services.
- [ ] Validate on native Linux, Windows + Edge, and macOS + Chrome/Edge where machines are available. Record environment, browser version, results, and any unverified target.
- [ ] Check npm install size, install logs, and that no bundled browser is downloaded.

**Exit gate:** all v1 criteria in the specification pass, or gaps are explicitly documented as release blockers; no misleading platform support claims.

**Suggested commits:** `test: add rendering and security regression cases`; `fix: polish PDF print output`.

## Phase 6 — Release candidate and distribution

**Tasks**
- [ ] Finish README: purpose, screenshots/examples, browser prerequisite, `pi install npm:pi-md2pdf`, CLI install/use, options, troubleshooting, privacy and platforms.
- [ ] Write a CHANGELOG for the initial version and finalize the package/license metadata.
- [ ] Add npm `pi-package` keyword, `pi.extensions` metadata and package-gallery presentation material as appropriate.
- [ ] Verify local pack/unpack from a clean environment; run `npm pack --dry-run`, tests, lint and build **locally**.
- [ ] Verify a local Pi install and packaged CLI invocation from the exact candidate tarball.
- [ ] Audit transitive dependencies and license notices.
- [ ] Tag or publish to npm **only after explicit approval**. Confirm that Pi's package catalog discovers the published package; catalog discovery is not assumed before publication.

**Exit gate:** installable, documented release candidate, with test evidence and known limitations ready for review.

**Suggested commit:** `docs: prepare pi-md2pdf release candidate`.

## Quality gates and traceability

| Gate | Required evidence |
| --- | --- |
| Build | Local TypeScript build succeeds |
| Tests | Unit and browser-integration tests pass |
| Format/lint | Locally runnable checks pass |
| Rendering | Inspect sample PDFs and compare to reference images |
| Security | Offline behavior, path boundaries and no implicit execution verified |
| Robustness | Clean browser/temp-file shutdown on error and cancellation |
| Packaging | Tarball contains executable CLI, extension and CSS; no browser binary |
| Compatibility | Platform/browser versions recorded and verified claims limited to tested setups |
| Publishing | Explicit user approval; no automatic CI or releases |

## Open decisions to resolve during implementation

These are deliberately left configurable or pending empirical validation rather than falsely fixed:

1. Minimum supported Node.js and Pi versions and the exact browser version range.
2. Exact values for image/input size limits and conversion timeout.
3. Browser-discovery library versus maintained internal probing logic.
4. TypeScript compiler versus a small bundler for npm-friendly output, while preventing duplicate Pi runtime packages.
5. Scope and handling of local image symlinks and diagnostics when source files are outside the document tree.
6. Whether platform-specific PDF typography needs pinned compatible fonts for closer cross-platform visual results.

None of these decisions changes the locked v1 product scope.

## Post-v1 backlog (not release blockers)

- Mermaid and math support.
- Alternative themes, fonts, templates and headers/footers.
- Printed page-number-aware TOC.
- Batch conversion and watch mode.
- SVG handling with careful sanitization.
- Explicit opt-in remote resource loading.
- WSL-to-Windows Edge browser reuse.
- Richer preview and interactive dialogs.
- Additional document conversion commands beyond Markdown.

Do not expand into these areas before the v1 release gates are met.
