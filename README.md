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

### Shared v1 defaults (no Pi skill required)

The CLI, Pi slash command, and agent-callable `markdown_to_pdf` tool all use
`DEFAULTS` in `src/core/options.ts`:

~~~typescript
export const DEFAULTS = {
  paper: "a4",
  toc: false,
  numberSections: false,
  overwrite: false,
  outputConflict: "increment",
  theme: "github-light",
} as const;
~~~

Omitted options are normalized by the shared conversion engine. Pi's tool description
and parameter descriptions explain these defaults to the agent. For a normal
"convert this Markdown to PDF" request, **no TOC or new numbering is added**.
Those features require an explicit request (`--toc` and `--number-sections`
in the CLI or `toc: true` and `numberSections: true` in the agent tool).
GitHub Light is the fixed theme in v1; there is no theme option to configure.

### Automatic filenames without overwriting

If the output path is omitted, the converter chooses an unused filename automatically:

~~~text
report.md → report.pdf
report.md → report-2.pdf     (if report.pdf exists)
report.md → report-3.pdf     (if both earlier filenames exist)
~~~

This is the `outputConflict: "increment"` default. It is enforced by the
shared engine, including the agent tool and the direct Pi slash command;
the agent does not need to ask for a new name. Two concurrent exports reserve
different final filenames atomically.

**Explicit output names are different:** `md2pdf report.md -o final.pdf`
(or `/md2pdf report.md final.pdf`) will not silently change `final.pdf`
to `final-2.pdf`. CLI/tool calls reject an occupied explicit filename unless
overwrite was authorized (`--force` or `overwrite: true`).
In interactive Pi, the slash command may confirm an explicit overwrite.

Tool descriptions **guide** the LLM; they cannot mechanically prove user intent.
If Pi incorrectly adds an option despite the descriptions, direct use of
`/md2pdf input.md` or `md2pdf input.md` always applies the conservative defaults.
No separate Pi skill is installed, loaded, or required.


### Matching Chrome Markdown Viewer output

For an export that resembles the original Markdown Viewer printout, convert **without** `--toc` or `--number-sections`:

~~~sh
md2pdf specification.md -o specification.pdf
~~~

In Pi, ask: *"Convert specification.md to PDF as-is; preserve the existing headings and don't add a table of contents or numbering."*

`--toc` can add several pages to large documents (for example, a 200+ heading specification). When `--number-sections` is selected on an already-numbered document, the original author-provided numbering is preserved rather than duplicated.

On platforms without Segoe UI or Consolas, the same CSS falls back to available system fonts. Exact font shapes, line breaks, and pagination may therefore still differ from Windows Chrome Markdown Viewer.


## Options

| Option | Description |
| --- | --- |
| `-o, --output path` | Explicit output; otherwise use next free input.pdf / input-2.pdf / ... |
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

The output uses the light [GitHub Markdown CSS](https://github.com/sindresorhus/github-markdown-css) with a print stylesheet for A4, tables, code blocks, and page breaks. Default print margins are 10 mm; smaller tables use natural width rather than stretching across the page. Exact pagination may vary across platforms and browser builds.

## Security and privacy

Conversion stays local; there are no cloud APIs, background processes or runtime browser downloads. Browser processes are launched on demand and closed after the conversion. Existing PDFs are protected unless overwrite is explicitly authorized. Untrusted Markdown files should still be treated as untrusted input.

## Status

This repository is in active development. npm publishing and Pi package gallery registration require separate release approval. Known validation gaps are tracked in [Compatibility](docs/COMPATIBILITY.md).

License: MIT.
