# pi-md2pdf — v1 Specification

**Status:** Approved concept; implementation not started  
**Repository:** https://github.com/civcode/pi-md2pdf  
**Last reviewed:** 2026-10-18  
**Related:** [Development Roadmap](ROADMAP.md)

## 1. Product summary

`pi-md2pdf` converts Markdown files into polished, GitHub-style PDFs using an existing Chrome, Chromium, or Microsoft Edge browser in headless mode. It ships as **one npm package** with two entry points:

1. A Pi Coding Agent extension exposing `/md2pdf` and the model-callable `markdown_to_pdf` tool.
2. A standalone `md2pdf` command-line program, usable without Pi.

**Both entry points call the same conversion engine.** The Pi slash command does not require a model request. No Pi extension-specific PDF renderer, resident service, graphical browser window, cloud service, or bundled browser is required.

The visual target is the *GitHub Light / Chrome Markdown Viewer* appearance: readable sans-serif typography, clear headings, alternating table rows, subtle borders, light code blocks, syntax highlighting, and clean A4 pagination.

## 2. Goals

- High-quality PDF exports for reports, notes, technical documentation, and scanned-accounting analysis expressed as Markdown.
- Matching output from the CLI, slash command, and agent tool given the same options, runtime, and browser.
- Small npm installation with `puppeteer-core` and **no automatic Chromium download**.
- Windows, Linux, and macOS support; SSH/tmux and no-display Linux support through headless mode.
- Safe, predictable offline rendering of local Markdown and local image assets.
- Discoverability through the official Pi package catalog after npm publication.

### Explicitly out of scope for v1

Mermaid rendering, LaTeX/KaTeX math, remote images, custom themes/templates, custom fonts, HTML/JavaScript execution from Markdown, GUI/live preview, interactive settings wizard, batch mode, image-to-PDF, PDF merging/splitting, printed TOC page numbers, and a WSL-to-Windows browser bridge. They can be evaluated after v1.

## 3. Entry points and user experience

### 3.1 Pi slash command

~~~text
/md2pdf report.md
/md2pdf report.md report.pdf
/md2pdf report.md --toc
/md2pdf report.md --toc --number-sections
/md2pdf report.md --paper letter
~~~

- Usage: `/md2pdf <input.md> [output.pdf] [options]`.
- Slash command executes locally without invoking an LLM.
- Reports source, target, selected browser, conversion status, and useful error messages.
- In interactive Pi sessions only, may request confirmation before replacing a PDF. In non-interactive modes, existing outputs are rejected rather than overwritten.
- Parses quoted paths/filenames with spaces without passing input through a shell.

### 3.2 Agent-callable tool

Register `markdown_to_pdf` with a structured input containing:

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `input` | string (required) | — | Path to local Markdown source |
| `output` | string | Same basename, `.pdf` | Destination PDF |
| `paper` | `a4` / `letter` | `a4` | Paper size |
| `toc` | boolean | `false` | Linked table of contents |
| `numberSections` | boolean | `false` | Number headings |
| `overwrite` | boolean | `false` | Explicit opt-in to replace output |

The tool returns the final PDF path and concise success/error information. It does not ask interactive questions; the calling agent must obtain permission before opting into an overwrite. Tool execution supports cancellation where Pi provides an abort signal.

#### Agent-tool input path policy

The `markdown_to_pdf` **agent tool** must resolve input names against
`ctx.cwd`, without searching parents, a home folder, or other repositories.
A basename refers only to the file in that working directory. If missing,
return a useful "not found here" message rather than discovering a different
same-named file.

For safety, its input and output paths must stay under the current working
directory, including after resolving symlinks. Absolute paths are accepted
only when inside that directory. The tool refuses external paths rather than
silently using them, even if supplied by the model. The tool description
instructs Pi not to run broad filesystem searches for a basename.

The direct, user-entered `/md2pdf` slash command and the standalone CLI are
intentionally not subject to that restriction: explicit absolute paths are
supported for deliberate cross-directory conversions.

### 3.3 Standalone CLI

~~~sh
md2pdf report.md
md2pdf report.md -o report.pdf
md2pdf report.md --toc --number-sections
md2pdf report.md --paper letter
md2pdf report.md --browser-path /path/to/browser
md2pdf --check
md2pdf --help
md2pdf --version
~~~

- Usage: `md2pdf <input.md> [-o output.pdf] [--toc] [--number-sections] [--paper a4|letter] [--force] [--browser-path PATH]`.
- `--force` is the only CLI mechanism for replacing an existing output.
- `--check` reports browser discovery and attempts a small headless PDF self-test; it does not modify a user document.
- Success returns process exit code 0; invalid usage, missing input, missing browser, overwrite refusal, and conversion failure return nonzero codes and human-readable errors on stderr.
- Relative source paths resolve from the caller's working directory; **relative linked images resolve from the source Markdown file's directory**.
- No implicit network calls or dependency installation during conversion.

### 3.4 Defaults and options

| Setting | Default |
| --- | --- |
| Theme | GitHub Light |
| Page size | A4 |
| Margins | 10 mm on each side |
| Output | First free input.pdf, input-2.pdf, input-3.pdf, ... beside source |
| TOC | Disabled |
| Automatic heading numbering | Disabled |
| Print backgrounds | Enabled |
| Browser mode | Headless only |
| Existing destination | Implicit name: auto-increment; explicit name: reject or request confirmation in interactive Pi |
| Remote resources | Disabled |

TOC contains clickable heading links, **not printed page numbers**. TOC and numbering work independently. Heading anchors remain deterministic, including for duplicate headings.

### 3.5 Shared defaults and agent tool guidance

All interfaces MUST use the immutable TypeScript defaults in `src/core/options.ts`:

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

The core options normalizer applies these defaults to omitted values.
When a caller omits the output filename and the derived .pdf exists, the
converter MUST atomically select `-2`, `-3`, etc. without a confirmation.
Explicit output path collisions MUST fail unless overwrite is authorized;
interactive Pi MAY ask confirmation for an explicitly supplied destination.
Concurrent conversions MUST reserve distinct filenames. Overwrite remains false
by default. CLI help,
Pi command description, and agent-tool parameter descriptions MUST reflect the
same values rather than repeating independent literal defaults.

The Pi agent-tool description MUST instruct the model to preserve original
heading structure and appearance when asked to convert Markdown as-is. It MUST
explain that TOC and additional numbering are opt-in even for a long report.
The `overwrite` parameter requires explicit user authorization. Tool descriptions
guide the model but cannot guarantee its choice; final option normalization and
overwrite safeguards remain enforced by code.

GitHub Light is the sole v1 theme (not a configurable CLI/agent flag). No Pi
skill is needed or bundled.

## 4. Conversion pipeline

~~~text
Pi /md2pdf ─┐
Pi tool ────┼─> validated options -> shared renderer -> PDF file
CLI md2pdf ─┘                        │
                         Markdown -> AST/HTML
                         headings + optional TOC/numbering
                         local asset resolution and validation
                         GitHub Light + print CSS
                         headless Edge/Chrome/Chromium
~~~

- Language/runtime: TypeScript on Node.js.
- Markdown: `markdown-it`; heading IDs: `markdown-it-anchor` or an equivalent deterministic implementation.
- Highlighting: `highlight.js`, shipped locally with a consistent light theme.
- CSS: pinned `github-markdown-css` light stylesheet plus our own print stylesheet. Audit third-party license notices before redistribution.
- Rendering: `puppeteer-core`. The browser is started on demand and closed in a `finally` cleanup path.
- Export the core as a reusable internal function taking typed conversion options. Neither Pi nor the CLI contains independent formatting logic.

Render a self-contained HTML document via the browser API, not a local HTTP server. Resolve permitted raster image files, inline their contents, and include CSS and syntax-highlighting assets from the installed package. Block network requests. HTML supplied in Markdown must be escaped, not executed as arbitrary script.

## 5. Layout and Markdown support

**Required:** headings H1–H6, paragraphs, inline emphasis, ordered/unordered lists, links, blockquotes, thematic rules, fenced code, syntax highlighting, inline code, GitHub-style pipe tables, local images (PNG/JPEG/WebP), Unicode, and German diacritics.

**Required printing behavior:**
- Thin borders, natural/content-dependent table widths and alternating shading for tables; repeat table headers where the renderer permits.
- Avoid heading orphans and unwanted splits through code blocks and table rows where practical.
- Wrap long code/table content sensibly; no off-page content in reference fixtures.
- Preserve print backgrounds so table stripes and code backgrounds appear in the PDF.
- Default to a light document irrespective of the user's OS dark mode.
- Keep output links clickable when they have safe `https:`, `http:`, `mailto:` or fragment destinations.

Local images must resolve against the Markdown file, remain within the source document directory tree for v1 (including after symlink resolution), and have reasonable byte limits. Missing or unsupported assets must produce an actionable error; do not silently fetch online assets or substitute a different converter. Animated formats and SVG are not v1 requirements.

Visual equivalence is assessed on reference fixtures/screenshots; pixel identity across browser builds and operating systems is not guaranteed.

## 6. Browser discovery and platform behavior

| Platform | Preferred auto-detection |
| --- | --- |
| Windows | Microsoft Edge, then Chrome, then Chromium |
| Linux | Chromium, then Chrome |
| macOS | Chrome, then Edge, then Chromium |
| WSL | Browser installed within the Linux environment |

Search known installation paths and executable names, then validate the selected binary. Configuration precedence:

1. Explicit `--browser-path` (CLI) or Pi tool/command configuration when exposed.
2. `MD2PDF_BROWSER_PATH` environment variable.
3. Automatic discovery.

The first supported compatible browser is used. A user-specified but invalid path is an error, not permission to silently fall back. No desktop GUI or X server is required for modern headless Chromium on a supported Linux host; system browser libraries are still required. Never auto-install the browser or disable Chromium sandboxing by default. Avoid launching the browser as root; surface sandbox failures with remediation guidance.

## 7. Safety, errors and lifecycle

- **Privacy:** local-only rendering; no telemetry, external CSS/JS/image fetches, or persistent HTTP server. External links may remain links in the resulting PDF without being requested during conversion.
- **Input isolation:** escape raw HTML; disable renderer-side JavaScript and external resource loads where possible. Do not interpolate user-controlled paths into shell commands.
- **Filesystem:** validate source file, target parent directory and extensions; protect existing output; resolve symlink paths and guard unintended asset traversal. Write to a temporary file in the destination directory, verify a nonempty `%PDF-` result, then rename to the final destination. Clean temporary files on failure/cancellation.
- **Process cleanup:** browser starts only for a conversion; close page/browser on success, errors, cancellation, and timeouts. Pi shutdown must not leave orphaned conversion processes.
- **Progress:** simple messages rather than elaborate UI; Pi notification APIs only when available in the current execution mode.
- **Predictability:** errors never produce a success message; if rendering fails, preserve the source and any pre-existing output.

Conversion timeouts and maximum input sizes should be implemented with sensible conservative defaults, documented, and tested before release.

## 8. Package and repository design

Planned source layout:

~~~text
src/
  extension.ts        # Pi command and agent tool
  cli.ts              # Standalone CLI
  core/
    convert.ts        # Shared pipeline
    markdown.ts       # Parse and render
    headings.ts       # Anchors / TOC / numbering
    assets.ts         # Local asset loading and security
    browser.ts        # Browser discovery + launch
    options.ts        # Typed config and validation
    errors.ts         # Stable diagnostic categories
styles/
  print.css
tests/
  unit/
  integration/
  fixtures/
  reference/
docs/
  SPECIFICATION.md
  ROADMAP.md
~~~

Build runnable CLI and extension artifacts for publication and include both them and CSS in the npm tarball. `dist/` may be generated and excluded from Git, but **must** be present in the published npm package. Set npm `bin` for `md2pdf` and Pi's `pi.extensions` manifest to the packaged extension entry. Use `pi-package` in npm keywords.

Declare Pi-provided packages (including `@earendil-works/pi-coding-agent` and `typebox`) as peers rather than bundling them, per current Pi documentation. Keep browser-control, Markdown and highlighter libraries as runtime dependencies. Choose compatible Node and Pi minimum versions during implementation and state them explicitly in package metadata.

**Official references:**
- https://pi.dev/docs/latest/extensions
- https://pi.dev/docs/latest/packages
- https://github.com/sindresorhus/github-markdown-css
- https://pptr.dev/

## 9. Acceptance criteria

A v1 release candidate must demonstrate:

1. `md2pdf` produces a valid PDF for normal and complex fixture documents.
2. Pi `/md2pdf` works without an LLM call; `markdown_to_pdf` accepts typed inputs and uses the same renderer.
3. CLI and Pi output are equivalent for the same options/environment.
4. GitHub-style tables, code blocks, images, links, TOC and numbering render correctly on A4 and Letter.
5. Existing outputs cannot be replaced accidentally.
6. Missing browser, invalid input, missing image, blocked network resource, failed conversion and aborted conversion all fail clearly and without orphaned processes.
7. No browser is downloaded during install; no GUI or background service is used.
8. Linux tests pass locally. Windows/macOS are actually tested before claiming support; otherwise documentation marks them as not yet validated.
9. npm package contains the working CLI, Pi extension and assets; local Pi package install is smoke-tested.
10. Documentation, license review and release checklist in [ROADMAP.md](ROADMAP.md) are complete.

## 10. Deferred ideas

Additional themes, Mermaid/KaTeX, linked TOC with printed page numbers, user-defined header/footer, batch conversion, SVG sanitization, optional externally hosted resources with explicit consent, WSL host-browser bridging, improved font embedding, and a broader PDF toolkit are considered follow-on work, not v1 blockers.
