# pi-md2pdf

[![npm version](https://img.shields.io/npm/v/pi-md2pdf)](https://www.npmjs.com/package/pi-md2pdf)
[![npm downloads](https://img.shields.io/npm/dm/pi-md2pdf)](https://www.npmjs.com/package/pi-md2pdf)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/civcode/pi-md2pdf/blob/main/LICENSE)

**Export Markdown to PDF directly from [Pi Coding Agent](https://pi.dev/).**

Convert reports, specifications, technical notes and other Markdown documents to GitHub-style PDFs, without leaving Pi. Supports LaTeX equations, Mermaid diagrams, syntax-highlighted code, tables, local images, clickable links and optional tables of contents.

Everything renders locally using your existing Chrome, Chromium or Edge browser. No document uploads, external rendering services or additional browser installation.

## Why pi-md2pdf?

Pi is useful for writing and reviewing Markdown documents. When you need a PDF for sharing, printing or archiving, pi-md2pdf lets you export the original Markdown directly from the same session, without copying it into another application.

- **Direct export:** use `/md2pdf` without a model call, or ask the agent to convert a file.
- **Technical documents:** render LaTeX equations and Mermaid diagrams alongside tables, code and images.
- **Persistent preferences:** configure paper size, contents, numbering and diagram error handling through `/md2pdf settings`.
- **Safe output:** existing PDFs are preserved by default; repeated exports receive unique filenames.
- **Local conversion:** uses your existing headless browser, without uploading documents.

## Installation

Requirements:

- Pi Coding Agent.
- Node.js 22.19 or later.
- **Chrome, Chromium or Microsoft Edge installed** and usable in headless mode.

### Install from npm

~~~sh
# All projects (global Pi installation)
pi install npm:pi-md2pdf

# Current project only
pi install -l npm:pi-md2pdf
~~~

Pi loads the installed extension when you start it. Project-local packages are subject to Pi's project-trust rules.

### Try for one session

~~~sh
pi -e npm:pi-md2pdf
~~~

This loads the package for one invocation without adding it to your installed package settings.

### Manage installed packages

~~~sh
pi list
pi update npm:pi-md2pdf
pi remove npm:pi-md2pdf
~~~

Use `-l` when removing a project-local installation. See [Pi's package documentation](https://docs.pi.dev/latest/packages) for package scope and management.

## Commands

| Command | Effect |
| --- | --- |
| `/md2pdf report.md` | Export Markdown to PDF beside the source file. |
| `/md2pdf report.md output.pdf` | Export to an explicit PDF filename. |
| `/md2pdf report.md --toc` | Include a linked table of contents. |
| `/md2pdf report.md --number-sections` | Add heading numbering when not already present. |
| `/md2pdf settings` | Open the interactive settings menu. |
| `/md2pdf --help` | Show command help and options. |

### Direct command

~~~text
/md2pdf report.md
~~~

The PDF is created alongside the Markdown file. To specify an output filename or override settings:

~~~text
/md2pdf "Monthly Report.md" "Monthly Report.pdf"
/md2pdf report.md --output custom-report.pdf
/md2pdf report.md --toc --number-sections
/md2pdf report.md --paper letter
/md2pdf --help
~~~

Use Tab to complete Markdown filenames, directories, command options and option values. The slash command runs directly without a model call.

## Agent tool: `markdown_to_pdf`

Pi exposes the `markdown_to_pdf` tool for agent-driven conversions. You can ask Pi in natural language, for example:

- "Convert report.md to PDF."
- "Export docs/specification.md with a table of contents."
- "Convert report.md to PDF and preserve the existing heading numbering."

The tool resolves input and output paths within the current project directory, never searches other projects for matching filenames, and reports the actual generated PDF path and any Mermaid warnings. Expand the tool result for details.

| Parameter | Meaning |
| --- | --- |
| `input` | Required Markdown path within Pi's working directory. |
| `output` | Optional explicit PDF path within the working directory. |
| `paper` | Optional paper format override (`a4` or `letter`). |
| `toc` | Optional table of contents override (boolean). |
| `numberSections` | Optional heading numbering override (boolean). |
| `mermaidErrors` | Optional diagram error mode override. |
| `overwrite` | Allow an explicit output to be overwritten only with user authorization. |

When optional formatting parameters are omitted, the tool uses your saved Pi preferences.

For an explicitly chosen file outside the project directory, use the direct `/md2pdf` command with its absolute path.

## Configuration

### Settings overlay

~~~text
/md2pdf settings
~~~

Use Up/Down to select a setting, Enter/Space to change its value, and Escape to close the menu. Changes are saved automatically and apply to future slash commands and agent conversions. **Reset to defaults** restores the original settings.

| Setting | Choices | Default |
| --- | --- | --- |
| Paper format | a4, letter | a4 |
| Table of contents | false, true | false |
| Number sections | false, true | false |
| Mermaid errors | `placeholder`, `source`, `strict` | `placeholder` |

### Mermaid error modes

What happens if a diagram cannot be rendered:

- **`placeholder` (default):** Insert an error message with the source line number and the original Mermaid code as a literal code block. Continue generating the PDF.
- **`source`:** Insert only the original Mermaid code as a literal code block, without an error message in the PDF. Continue generating the PDF.
- **`strict`:** Abort conversion at the first diagram error. No new PDF is generated.

Both continuing modes report failed diagram counts and source line numbers in the conversion result. Browser failures, timeouts, cancellation, filesystem errors and resource-limit violations remain fatal in all modes.

### Settings file

Settings are stored globally for your Pi user in `~/.pi/agent/md2pdf/settings.json` (honoring `PI_CODING_AGENT_DIR`). The interactive menu is the recommended way to edit them. For reference, the initial configuration is:

~~~json
{
  "paper": "a4",
  "toc": false,
  "numberSections": false,
  "mermaidErrors": "placeholder"
}
~~~

No restart is required after saving changes in the menu.

### Per-conversion options

Explicit options override saved settings for a single conversion without changing your preferences.

| Option | Description |
| --- | --- |
| `--output PATH` | Choose an explicit PDF filename; a second positional filename also works. |
| `--paper a4\|letter` | Set paper size. |
| `--toc` / `--no-toc` | Enable / disable a clickable table of contents (no printed page numbers). |
| `--number-sections` / `--no-number-sections` | Enable / disable automatic heading numbering; existing author numbering is preserved. |
| `--mermaid-errors placeholder\|source\|strict` | Select the diagram error mode. |
| `--browser-path PATH` | Select an installed browser executable. |
| `--force` | Explicitly authorize overwriting the requested output file. |
| `--help` | Show command help. |

For example, to export a document as-is even if automatic formatting is enabled in your settings:

~~~text
/md2pdf report.md --no-toc --no-number-sections
~~~

### Output filenames

If no output is specified, existing PDFs are never overwritten. A free filename is chosen automatically:

~~~text
report.md → report.pdf → report-2.pdf → report-3.pdf
~~~

With an explicit output filename, Pi asks before overwriting an existing PDF unless you supply `--force`. Agent calls require explicit overwrite authorization. Overwrite consent is never stored as a preference.

## LaTeX math

Write mathematical notation directly in Markdown. [KaTeX](https://katex.org/) renders equations locally, with its fonts embedded in the document. No TeX distribution is required.

Inline math uses `$...$` or `\(...\)`; display math uses `$$...$$`, `\[...\]`, or a fenced `math` / `latex` block.

~~~markdown
The energy is $E = mc^2$.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
~~~

Display example:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

Fractions, matrices, integrals, Greek letters, aligned equations and other KaTeX-supported math notation can be combined with normal Markdown, including table cells and headings.

**[LaTeX math guide](https://github.com/civcode/pi-md2pdf/blob/main/docs/LATEX.md)** — syntax examples, supported delimiters, literal code, multiline equations, PDF layout tips and limitations.

## Mermaid diagrams

Include flowcharts, sequence diagrams, class diagrams, entity relationships, state diagrams, Gantt charts and pie charts directly in Markdown.

~~~markdown
```mermaid
flowchart LR
    A[Markdown] --> B[Renderer]
    B --> C[PDF]
```
~~~

```mermaid
flowchart LR
    A[Markdown] --> B[Renderer]
    B --> C[PDF]
```

Mermaid diagrams render locally into validated, static SVG images in a separate Chromium context. The PDF-rendering page remains JavaScript-disabled. Diagram titles, built-in themes and selected visual settings are supported. HTML labels, interactive diagram links, external resources and arbitrary configuration overrides are restricted.

If a diagram fails, the configured [Mermaid error mode](#mermaid-error-modes) determines whether to preserve its source or abort.

**[Mermaid diagram guide](https://github.com/civcode/pi-md2pdf/blob/main/docs/MERMAID.md)** — diagram examples, configuration reference, error handling, compatibility restrictions and print-layout guidance.

## PDF appearance and privacy

The PDF uses the light [GitHub Markdown CSS](https://github.com/sindresorhus/github-markdown-css) theme with 10 mm margins, natural-width tables and print styling. A4 is the default. Fonts and pagination depend on the installed browser and system fonts.

Local PNG, JPEG and WebP images are supported when referenced beneath the Markdown file's directory. External resources are blocked and raw HTML in Markdown is escaped. The converter starts and closes Chromium on demand; documents are not sent to any external service.

Browser auto-detection:

| Platform | Search order |
| --- | --- |
| Linux | Chromium, Chrome, Edge |
| Windows | Edge, Chrome, Chromium |
| macOS | Chrome, Edge, Chromium |

Use the `MD2PDF_BROWSER_PATH` environment variable or `--browser-path` to select another compatible browser. Native Windows and macOS runtime testing is still pending.

## Limitations

- Linux/Chromium has been tested; native Windows and macOS runtime validation remains pending.
- Only the GitHub Light PDF theme is available.
- The table of contents uses clickable links, not printed page numbers.
- Raw HTML, remote images and arbitrary external resources are not supported.
- LaTeX support is math-mode rendering, not full document compilation. Mermaid output is static, not interactive.
- Review wide tables, long equations and complex diagrams in the generated PDF before sharing.

## Development and contributions

See the [testing guide](https://github.com/civcode/pi-md2pdf/blob/main/docs/TESTING.md), [release checklist](https://github.com/civcode/pi-md2pdf/blob/main/docs/RELEASE.md), and [changelog](https://github.com/civcode/pi-md2pdf/blob/main/CHANGELOG.md). Report problems through [GitHub issues](https://github.com/civcode/pi-md2pdf/issues).

### Install from source (development)

~~~sh
git clone https://github.com/civcode/pi-md2pdf.git
cd pi-md2pdf
npm ci
npm run build
pi -e ./dist/extension.js
~~~

### Validation

~~~sh
npm ci
npm run typecheck
npm test
npm run build
npm run check:load
npm run check:package
npm run pack:check
pi --extension ./dist/extension.js
~~~

The package checks use Pi's real extension loader and a clean temporary npm installation with a real headless browser. They do not publish anything.

Licensed under [MIT](https://github.com/civcode/pi-md2pdf/blob/main/LICENSE). See [third-party notices](https://github.com/civcode/pi-md2pdf/blob/main/THIRD_PARTY_NOTICES.md).

## Standalone CLI (optional)

You can use the same converter outside Pi:

~~~sh
npm install -g pi-md2pdf
md2pdf report.md
md2pdf report.md -o report-with-toc.pdf --toc --number-sections
md2pdf report.md --paper letter
md2pdf report.md --mermaid-errors strict
md2pdf --check
md2pdf --help
~~~

The CLI uses the same renderer and conversion options, but does not read Pi's saved preferences. It defaults to A4, no table of contents, no additional heading numbering and the `placeholder` Mermaid error mode.

Use `-o` or `--output` to specify the output path (Pi's slash command uses `--output` or a positional filename). The CLI refuses an occupied explicit output unless `--force` is provided. `--check` verifies headless browser PDF rendering; `--version` prints the package version.
