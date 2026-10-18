# Linux end-to-end acceptance checklist — pi-md2pdf v0.1.0

**Status:** Test plan only. No tests are marked passed.  
**Purpose:** Exercise real Pi behavior, browser integration, and terminal interaction that mocks/unit tests do not establish.

Pi references: [CLI](https://pi.dev/docs/latest/cli), [CLI integration](https://pi.dev/docs/latest/cli-integration), [JSON events](https://pi.dev/docs/latest/json).

## 0. Prepare a disposable directory

Run in **one terminal** so the exported variables remain available.

```bash
cd ~/workspace/pi-md2pdf
npm ci
npm run typecheck
npm test
npm run build
npm run check:load
npm run check:package

export MD2PDF_REPO="$PWD"
export MD2PDF_QA="$(mktemp -d /tmp/pi-md2pdf-qa.XXXXXX)"
cp tests/fixtures/sample.md "$MD2PDF_QA/report.md"
printf '# My report\n\nUnicode: Müller – € – Straße\n' > "$MD2PDF_QA/My Report.md"
mkdir -p "$MD2PDF_QA/docs"
printf '# Nested document\n' > "$MD2PDF_QA/docs/nested.md"
printf 'KEEP-THIS-FILE\n' > "$MD2PDF_QA/existing.pdf"
echo "QA directory: $MD2PDF_QA"
```

Helper: exercise the **real Pi slash command** in one-shot print mode with only this extension loaded. Pi dispatches registered extension slash commands before a model prompt, so these should not use model tokens. Print-mode command notifications may appear on stderr or not in the assistant response; judge success by files, not exit status alone.

```bash
md2pdf_pi() (
  cd "$MD2PDF_QA" || exit 1
  pi --no-session --no-extensions \
    --extension "$MD2PDF_REPO/dist/extension.js" \
    --no-mcp --no-skills --no-prompt-templates --no-context-files \
    --print "$1"
)
```

## A. Real Pi CLI checks (no model turn expected)

- [ ] **A1 – Slash command and real PDF.** Run `md2pdf_pi "/md2pdf report.md"`. Expect `report.pdf` under the QA folder. Check `head -c 5 "$MD2PDF_QA/report.pdf"` produces `%PDF-`. Use `pdfinfo` for A4 page dimensions.
- [ ] **A2 – Automatic numbered filenames.** Run the same command twice more. Expect `report-2.pdf` and `report-3.pdf`, with `report.pdf` unchanged.
- [ ] **A3 – Explicit collision does not overwrite.** Run `md2pdf_pi "/md2pdf report.md existing.pdf"`. Verify `grep -qx KEEP-THIS-FILE "$MD2PDF_QA/existing.pdf"` succeeds. The command may return exit code 0 even after reporting an extension-level error.
- [ ] **A4 – Authorized overwrite.** In this disposable directory only, run `md2pdf_pi "/md2pdf report.md existing.pdf --force"`. The file must now begin with `%PDF-`.
- [ ] **A5 – Spaces, Unicode and nested paths.** Run `md2pdf_pi '/md2pdf "My Report.md"'` and `md2pdf_pi '/md2pdf docs/nested.md'`. Expect `My Report.pdf` and `docs/nested.pdf`. Extract Unicode text with `pdftotext` if installed.
- [ ] **A6 – Paper size.** Run `md2pdf_pi "/md2pdf report.md letter.pdf --paper letter"` and check `pdfinfo "$MD2PDF_QA/letter.pdf" | grep 'Page size'`. It must be US Letter rather than default A4.
- [ ] **A7 – Failure handling.** Test `/md2pdf nonexistent.md` and a bogus `MD2PDF_BROWSER_PATH`. Expect clear errors, no output PDFs, no leftover `.md2pdf-*` temporary directories.
- [ ] **A8 – Concurrency.** Start two independent `md2pdf_pi "/md2pdf report.md"` processes concurrently, then verify two distinct valid new PDFs and no overwritten outputs.
- [ ] **A9 – Headless SSH/tmux.** From SSH/tmux, try `env -u DISPLAY -u WAYLAND_DISPLAY` with a new Pi print-mode invocation. Confirm rendering works without GUI/browser windows and there are no new lingering Chromium processes.

Convenient commands for A1–A6:

```bash
md2pdf_pi "/md2pdf report.md"
md2pdf_pi "/md2pdf report.md"
md2pdf_pi "/md2pdf report.md"
ls -lh "$MD2PDF_QA"/report*.pdf

md2pdf_pi "/md2pdf report.md existing.pdf"
grep -qx KEEP-THIS-FILE "$MD2PDF_QA/existing.pdf" && echo "Overwrite protected"
md2pdf_pi "/md2pdf report.md existing.pdf --force"
head -c 5 "$MD2PDF_QA/existing.pdf"; echo

md2pdf_pi '/md2pdf "My Report.md"'
md2pdf_pi '/md2pdf docs/nested.md'
md2pdf_pi "/md2pdf report.md letter.pdf --paper letter"
pdfinfo "$MD2PDF_QA/letter.pdf" | grep 'Page size'
```

## B. Test *agent decisions* via Pi JSON (uses model/API tokens)

Use the actual `markdown_to_pdf` agent tool with **no shell tools**, to isolate the agent's choices. Pi JSON mode reports tool arguments and results; inspect these rather than trusting the final prose.

```bash
cd "$MD2PDF_QA"
pi --no-session --no-extensions \
  --extension "$MD2PDF_REPO/dist/extension.js" \
  --no-mcp --no-skills --no-prompt-templates --no-context-files \
  --tools markdown_to_pdf \
  --mode json \
  "Convert report.md to PDF as-is using markdown_to_pdf. Do not add TOC, numbering, or overwrite." \
  > "$MD2PDF_QA/agent.jsonl"

jq -c 'select(.type == "tool_execution_start" and .toolName == "markdown_to_pdf") | .args' \
  "$MD2PDF_QA/agent.jsonl"
jq -c 'select(.type == "tool_execution_end" and .toolName == "markdown_to_pdf") | {isError, details: .result.details}' \
  "$MD2PDF_QA/agent.jsonl"
```

- [ ] **B1 – Default agent arguments.** Confirm the tool was actually called. The args omit `toc`, `numberSections` and `overwrite` (or set them false). The result has `isError: false` and reports the *actual* numbered output filename.
- [ ] **B2 – Correct source selection.** Create same-named Markdown files inside and outside the QA directory with different unique marker text. Ask the agent to convert the basename; check the resulting PDF contains only the local marker using `pdftotext`. Inspect its tool args.
- [ ] **B3 – Workspace boundary.** Ask for an absolute path *outside* QA. A preemptive agent refusal is acceptable; if it calls the tool, the tool must reject the path and not create an external PDF.
- [ ] **B4 – Explicit formatting request.** Repeat the JSON test requesting a TOC and numbered sections; verify the exact tool args and output.

**Caution:** JSON-mode tests invoke a model, consume API tokens, and may vary by model/version. Pi's JSON-mode process exit code alone does not prove tool success: check `tool_execution_end.isError`. Logs can include prompts, paths, and model responses; redact them before sharing.

## C. Manual interactive UI checks (cannot be proved by noninteractive CLI)

```bash
cd "$MD2PDF_QA"
pi --no-session --no-extensions \
  --extension "$MD2PDF_REPO/dist/extension.js" \
  --no-mcp --no-skills --no-prompt-templates --no-context-files
```

- [ ] **C1 – File completion.** Type `/md2pdf rep`, `/md2pdf docs/ne`, and `/md2pdf "My Re`. Press Tab; verify suggestions are local, quoted correctly, and do not drop previously typed arguments.
- [ ] **C2 – Option completion.** Type `/md2pdf report.md --`. Verify `--output` appears once and `-o` is absent; test `--paper ` to see `a4` and `letter`. Check the short option descriptions.
- [ ] **C3 – Enter-key behavior.** Type and complete `--toc`, then press Enter. It must submit rather than remain stuck in the autocomplete popup.
- [ ] **C4 – Confirmation semantics.** Invoke `/md2pdf report.md existing.pdf` (now a temporary valid PDF) and decline the overwrite prompt; confirm its bytes are unchanged.
- [ ] **C5 – Agent tool rendering.** Ask Pi to convert `report.md`. Verify compact `renderCall` shows source/flags, and `renderResult` displays the *actual* output basename and size. Expanded output should reveal full paths/browser.
- [ ] **C6 – SSH/tmux and cancellation.** Ensure a completed conversion does not close the tmux window or leave browser processes running. If a long conversion can be interrupted, use Ctrl+C once and inspect temp-file/browser cleanup; do not use SIGKILL to assess graceful cleanup.
- [ ] **C7 – Real technical document.** Render the UWB specification as-is and visually compare against the accepted Markdown Viewer PDF. Check long tables, multipage code, fonts, page breaks, images, hyperlinks and first/last pages. Do not overwrite the reference PDF.

## Evidence / release pass criteria

A release passes this Linux checklist when A1–A9 have observable expected results, at least B1 and B3 have been checked in JSON mode, and all C1–C7 interactive items are verified. Record any skipped items as **not tested**, not passed.

Useful inspection commands:

```bash
pi --version
node --version
command -v pdfinfo pdftotext pdftoppm || true
find "$MD2PDF_QA" -maxdepth 2 -type f -name '*.pdf' -printf '%p (%s bytes)\n'
find "$MD2PDF_QA" -maxdepth 2 -name '.md2pdf-*' -print
ps -eo pid,ppid,args | grep -E '[c]hromium.*--headless|[c]hrome.*--headless' || true
```

Keep the temporary QA folder until the review is complete. Remove it manually afterward; no script here deletes it. No GitHub Actions or npm publication is involved.
