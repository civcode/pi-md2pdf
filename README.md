# pi-md2pdf

**GitHub-style Markdown → PDF**, for Pi Coding Agent and any terminal. One shared TypeScript renderer, two entry points, and an existing headless Chrome/Chromium/Edge browser. No browser download, GUI or network upload.

> **Development status:** v0.1 implementation branch. Not yet published or verified on all target platforms. See [Specification](docs/SPECIFICATION.md), [Roadmap](docs/ROADMAP.md), and [Compatibility](docs/COMPATIBILITY.md).

## Requirements

- Node.js 22.19 or later.
- Google Chrome, Chromium, or Microsoft Edge installed and usable in headless mode.
- For Pi integration, a current installation of [Pi Coding Agent](https://pi.dev/).

Browser selection defaults to **Edge → Chrome → Chromium** on Windows, **Chromium → Chrome** on Linux, and **Chrome → Edge → Chromium** on macOS. Set `MD2PDF_BROWSER_PATH` to use a custom executable.

## Usage

After installing the npm package (when published):

~~~sh
npm install -g pi-md2pdf
md2pdf report.md
md2pdf report.md -o report.pdf --toc --number-sections
md2pdf report.md --paper letter
md2pdf --check
~~~

For Pi (after release):

~~~sh
pi install npm:pi-md2pdf
~~~

In Pi:

~~~text
/md2pdf report.md
/md2pdf "Monthly Report.md" "Monthly Report.pdf" --toc
/md2pdf report.md --toc --number-sections --paper a4
~~~

Pi also exposes the `markdown_to_pdf` tool for agent-driven conversions. The slash command does **not** require a model call.

## Options

| Option | Description |
| --- | --- |
| `-o, --output path` | PDF output (defaults beside Markdown input) |
| `--paper a4\|letter` | Page size, A4 by default |
| `--toc` | Clickable heading table of contents, without page numbers |
| `--number-sections` | Auto-number headings |
| `--force` | Explicitly allow overwriting an existing PDF |
| `--browser-path path` | Browser executable |
| `--check` | Test headless browser setup |
| `--help`, `--version` | CLI information |

Only locally referenced PNG, JPEG, and WebP images beneath the Markdown file's directory are supported. External resource requests are blocked. Arbitrary HTML in Markdown is escaped, not executed.

## Develop locally

~~~sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
node dist/cli.js --check
node dist/cli.js tests/fixtures/sample.md -o /tmp/sample-md2pdf.pdf --toc --number-sections
pi --extension ./dist/extension.js
~~~

No GitHub Actions workflow is required for local checks.

## Visual style

The output uses the light [GitHub Markdown CSS](https://github.com/sindresorhus/github-markdown-css) with a print stylesheet for A4, tables, code blocks, and page breaks. Exact pagination may vary across platforms and browser builds.

## Security and privacy

Conversion stays local; there are no cloud APIs, background processes or runtime browser downloads. Browser processes are launched on demand and closed after the conversion. Existing PDFs are protected unless overwrite is explicitly authorized. Untrusted Markdown files should still be treated as untrusted input.

## Status

This repository is in active development. npm publishing and Pi package gallery registration require separate release approval. Known validation gaps are tracked in [Compatibility](docs/COMPATIBILITY.md).

License: MIT.
