# Changelog

Changes are documented here for public releases of **pi-md2pdf**.
The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased (release candidate)

First planned public release. **Not yet published to npm or tagged.**

### Added

- Standalone `md2pdf` CLI and Pi Coding Agent `/md2pdf` slash command.
- Pi `markdown_to_pdf` agent tool, sharing the same Markdown-to-PDF rendering engine.
- GitHub Light Markdown style, syntax-highlighted fenced code, tables, local raster images, clickable links, and headless Chromium-based PDF output.
- Optional table of contents and section numbering; existing author-provided section numbers remain unchanged.
- A4 default and Letter page formats, 10 mm print margins, natural-width tables.
- Browser auto-detection for Chromium/Chrome and Microsoft Edge, plus `MD2PDF_BROWSER_PATH` override.
- Safe, numbered output filenames (`report.pdf`, `report-2.pdf`, …), with explicit-output overwrite protection and atomic allocation.
- Agent-tool working-directory boundary, symlink-aware path checks, cancellation/timeout handling, and offline local-asset rendering.
- Test coverage for CLI options, Markdown output, concurrency, file paths, error/abort cleanup, Pi registration, and actual browser PDF rendering.
- Release checks using Pi's real extension loader and an isolated npm tarball installation.

### Notes and limitations

- Requires Node.js 22.19+ and an existing compatible headless browser; no browser binary is bundled.
- Linux with Chromium has passed local functional tests and a package-install smoke test.
- Native Windows and macOS runtime verification remains pending; path-handling unit tests alone are not a substitute.
- GitHub Light is the only v1 theme. Remote images, Mermaid, KaTeX, and printed TOC page numbers are out of scope.
- Pi's agent tool is scoped to its working directory; explicit cross-directory conversion remains available with the direct slash command and CLI.

When release is approved, replace *Unreleased* with the publication date, verify the final artifact, and only then create the tag/release and publish.
