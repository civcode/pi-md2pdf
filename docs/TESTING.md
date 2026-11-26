# Linux end-to-end test procedure — pi-md2pdf v0.1.0

**Audience:** Maintainer performing release-candidate acceptance on Linux.  
**Status:** Procedure only; it does not assert that a particular run has passed.  
**Test runner:** [`scripts/check-linux-e2e.sh`](../scripts/check-linux-e2e.sh)  
**Detailed test inventory:** [`LINUX_E2E_QA.md`](LINUX_E2E_QA.md)  
**Release gates:** [`RELEASE.md`](RELEASE.md)

## 1. Purpose and coverage

The automated suite exercises the **real Pi binary and extension**, not just mocked interfaces. It checks Markdown-to-PDF conversion in Chromium, collision-safe output names, safe overwrite behavior, Linux browser discovery, paths and Unicode, headless rendering, and agent tool decisions. The interactive section then verifies terminal-specific behavior that cannot be inferred from non-interactive Pi output: Tab completion, Enter behavior, confirmations, and visual tool rendering.

The runner uses an isolated `/tmp/pi-md2pdf-e2e.XXXXXX` directory. All test PDFs and logs stay there for inspection. It does **not** merge the pull request, publish to npm, or run GitHub Actions.

## 2. Prerequisites

- Linux with Node.js 22.19+, npm, Pi Coding Agent and an installed headless-compatible Chromium/Chrome/Edge browser.
- A current checkout of the `feat/initial-implementation` branch, with npm dependencies installed.
- A configured Pi model/provider **only if running agent tests** (B1–B4) or the interactive agent rendering test (C5).
- Optional but recommended: `jq`, `pdfinfo` and `pdftotext` (the latter two are normally from Poppler).
- SSH/tmux is recommended for checking the intended remote-terminal workflow, but not required to run the script.

Install missing project dependencies if necessary:

```bash
cd ~/workspace/pi-md2pdf
npm ci
```

## 3. Start the complete test run

From the project checkout, execute **one command**:

```bash
cd ~/workspace/pi-md2pdf && git pull --ff-only && bash scripts/check-linux-e2e.sh
```

The script does the following in sequence:

1. Creates a fresh temporary test workspace with `report.md`, `My Report.md`, `docs/nested.md`, `existing.pdf`, and separate `project/marker.md` and `foreign/marker.md` fixtures.
2. Runs TypeScript checks, Vitest, the build, real Pi extension-load verification, packaged-install/PDF smoke testing, and npm packaging inspection.
3. Executes deterministic tests A1–A12 through the Pi slash command or standalone CLI.
4. Invokes four model-backed Pi JSON tests B1–B4 and evaluates the tool events (unless disabled).
5. Prints a **`RESULT: ... passed, ... failed, ... skipped`** summary and the temporary directory path.
6. Opens **interactive Pi** in that same temporary directory for tests C1–C7 (unless disabled).

**Important:** Interactive Pi opening at the end is expected, not a hang. The automated results are printed **before** Pi starts and do not count the subsequent manual checks.

### Optional execution modes

| Command | Behavior |
| --- | --- |
| `bash scripts/check-linux-e2e.sh` | Automated tests, four agent tests, then interactive Pi |
| `RUN_AGENT=0 bash scripts/check-linux-e2e.sh` | Avoid the four model-backed JSON tests; still open Pi |
| `RUN_INTERACTIVE=0 bash scripts/check-linux-e2e.sh` | Automated tests and model-backed JSON tests; don't open Pi |
| `RUN_AGENT=0 RUN_INTERACTIVE=0 bash scripts/check-linux-e2e.sh` | Deterministic, noninteractive checks only |

Set `QA_REPO=/absolute/path/to/pi-md2pdf` if the repository isn't at `~/workspace/pi-md2pdf`. Model-backed tests consume API tokens. Direct `/md2pdf` calls in Pi print mode normally **do not** call a model.

## 4. Automated tests: what a pass means

### A. Pi/CLI, Chromium and filesystem tests

| ID | Test | Pass criteria |
| --- | --- | --- |
| A1 | Real `/md2pdf` conversion | `report.pdf` exists and has a valid `%PDF-` header |
| A2 | Repeat conversion | `report-2.pdf` and `report-3.pdf` exist; first file unchanged |
| A3 | Refuse explicit collision | Existing file retains original `DO-NOT-OVERWRITE` contents |
| A4 | Explicit `--force` | Existing disposable file is replaced by a valid PDF |
| A5 | Quoted and nested filenames | PDFs generated for `My Report.md` and `docs/nested.md` |
| A5b | Unicode text | Extracted PDF text contains expected German characters (if `pdftotext` available) |
| A6 | Letter paper selection | Output PDF exists |
| A6b | Actual paper geometry | `pdfinfo` confirms A4 vs US Letter (if available) |
| A7 / A7b | Missing input / missing browser | Error reported; no output PDF created |
| A8 | Simultaneous conversions | Separate valid PDFs created without name collisions |
| A9 | No desktop display | Conversion works with `DISPLAY`/`WAYLAND_DISPLAY` unset |
| A10 | Standalone CLI | `node dist/cli.js` generates a real PDF |
| A11 | Explicit TOC and numbering | PDF conversion completes when flags are supplied |
| A12 | Temporary-file cleanup | No orphaned `.md2pdf-*` directories remain |
| A13 | Pi output syntax | Slash command rejects `-o` but accepts `--output` |

These are integration checks rather than proof of the visual appearance of every page. A7 failure handling and A3 collision refusal are **successful tests when the requested operation is rejected safely**.

### B. Model-backed Pi JSON tests

| ID | Test | Pass criteria |
| --- | --- | --- |
| B1 | Defaults | `markdown_to_pdf` gets the intended input without unrequested TOC, numbering or overwrite and creates a PDF |
| B2 | Same-named files | Agent chooses the Markdown file in Pi's working directory, not the foreign fixture |
| B3 | Workspace boundary | Agent refuses the outside path, or the tool rejects it; no foreign PDF created |
| B4 | Explicit formatting | Agent passes `toc: true` and `numberSections: true` and creates the requested PDF |

The runner inspects Pi JSON `tool_execution_start`/`tool_execution_end` events and the actual PDFs. An assistant saying “completed” is not, by itself, evidence. These checks can be model-dependent; inspect the corresponding logs if one fails.

## 5. Interactive Pi tests — do these after the runner opens Pi

The runner launches Pi with `report.md`, `My Report.md`, `docs/nested.md`, and the disposable `existing.pdf` in its active directory. **Type the commands directly into Pi**, not into the Bash terminal. For completion-only tests, inspect the suggestions, then clear the unsent input before the next test.

### C1. Markdown filename completion

- [ ] Type `/md2pdf rep` and press **Tab**. Confirm that `report.md` is available.
- [ ] Type `/md2pdf docs/ne` and press **Tab**. Confirm `docs/nested.md` is suggested.
- [ ] Type `/md2pdf "My Re` and press **Tab**. Confirm completion produces a properly quoted `"My Report.md"`.

**Pass:** The selected path is correct, earlier arguments aren't dropped, and no irrelevant/outside-workspace filenames appear.

### C2. Option descriptions and paper sizes

- [ ] Type `/md2pdf report.md --`. Look at the suggestion list.
- [ ] Verify **`--output` is present** and **`-o` is not suggested**. The standalone CLI accepts `-o`, but the Pi slash command intentionally rejects it.
- [ ] Verify the menu describes `--toc`, `--number-sections`, `--paper`, `--force` and `--browser-path`.
- [ ] Type `/md2pdf report.md --paper ` and verify both `a4` and `letter` can be selected.
- [ ] Submit `/md2pdf report.md -o rejected.pdf` and confirm it reports `Unknown option: -o` without creating that PDF.

**Pass:** The menu is readable, contextual, and contains no redundant `-o` entry.

### C3. Enter after completion

- [ ] Type `/md2pdf report.md --to`.
- [ ] Complete the token to `--toc` with Tab, then press **Enter**.
- [ ] Watch for “Converting Markdown to PDF…” followed by “Created …”.

**Pass:** Enter runs the slash command rather than being swallowed by autocomplete; a new numbered `report-N.pdf` is created. This is an explicit TOC request, so a TOC is expected.

### C4. Interactive overwrite confirmation

- [ ] Enter `/md2pdf report.md existing.pdf`. This PDF exists in the **disposable** QA directory.
- [ ] When Pi prompts to overwrite it, choose **No/Cancel**.
- [ ] Confirm Pi reports cancellation, not creation, and the file remains unchanged.

**Pass:** Pi asks instead of overwriting silently. You can verify bytes afterward from another shell with `sha256sum /tmp/pi-md2pdf-e2e.XXXXXX/existing.pdf` (replace with the actual QA path). To prove equality, record the hash **before and after** the prompt.

### C5. Agent tool display and final filename

Send this natural-language message to Pi (uses the configured model and API tokens):

> Convert report.md to PDF as-is using markdown_to_pdf. Do not add a table of contents or section numbering, and do not overwrite any existing PDF.

- [ ] In the tool-call UI, look for the **source file**, **A4**, **no TOC**, and **preserve numbering**.
- [ ] In the completed result, verify the **actual** output basename, likely `report-N.pdf`, and the file size.
- [ ] Expand the tool result using Pi's tool-expand control and verify the full path and browser information.

**Pass:** The displayed arguments match the requested/default options, and the result matches a real generated PDF. A plain textual model answer without a successful tool call does not count.

### C6. Terminal and browser lifecycle

- [ ] Repeat a direct `/md2pdf report.md` conversion inside SSH/tmux (if used), then confirm Pi remains responsive.
- [ ] After the browser exits, check from another terminal that no *new* headless Chromium process was left running. For example: `ps -eo pid,ppid,args | grep '[c]hromium.*--headless'`.
- [ ] If practical, interrupt one long conversion using **Ctrl+C** and check that no temporary conversion directory or new browser process remains. Record the interruption result separately; don't use SIGKILL as a graceful-shutdown check.

**Pass:** Completed conversions don't close the tmux pane, leave stale browser processes, or strand temporary output directories.

### C7. Long-document visual inspection

This test requires your existing long UWB specification; the runner cannot supply it automatically.

- [ ] Convert the specification as-is, **without** TOC or automatic numbering. Use a safe explicit output filename in the QA directory.
- [ ] Open the PDF and compare representative pages with the previously accepted Markdown Viewer PDF: first page, last page, wide tables, code blocks, German/Unicode text, images, links, and page breaks.
- [ ] Verify headings remain unchanged and the source document and reference PDF are not overwritten.

**Pass:** The PDF is readable, formatting is broadly consistent with the accepted baseline, and no unwanted heading/TOC changes occur. Small differences in fonts or pagination may be browser-dependent; note material differences.

## 6. Results and reporting

The runner prints a line such as:

```text
RESULT: 18 passed, 0 failed, 1 skipped
Logs and PDFs preserved in: /tmp/pi-md2pdf-e2e.ABC123
```

The numbers above are **illustrative**, not a recorded result. A `SKIP` is not a pass. The runner prints this summary **before the interactive tests**, so report both the automated result and your own C1–C7 observations.

| Area | Result | Notes |
| --- | --- | --- |
| Automated runner (A tests + preflight) | PASS / FAIL / SKIP | |
| Agent JSON tests (B1–B4) | PASS / FAIL / SKIP | |
| C1 — File completion | PASS / FAIL / NOT TESTED | |
| C2 — Option completion | PASS / FAIL / NOT TESTED | |
| C3 — Enter behavior | PASS / FAIL / NOT TESTED | |
| C4 — Overwrite confirmation | PASS / FAIL / NOT TESTED | |
| C5 — Tool rendering | PASS / FAIL / NOT TESTED | |
| C6 — SSH/tmux and browser cleanup | PASS / FAIL / NOT TESTED | |
| C7 — Long-document visual inspection | PASS / FAIL / NOT TESTED | |

For failures, report the test ID, expected vs actual behavior, relevant log file, and Pi/Node/Chromium versions. Model JSON logs may contain sensitive prompts, paths or filenames; inspect/redact before sharing them.

## 7. Exit Pi, inspect logs, clean up

When finished, exit Pi with `/exit` or **Ctrl+D**. The script then returns to your shell. The runner intentionally preserves all PDFs and logs.

It creates **a different QA directory on every run**, so copy its displayed path before inspecting results:

```bash
QA_DIR=/tmp/pi-md2pdf-e2e.REPLACE_WITH_PRINTED_SUFFIX
ls -lh "$QA_DIR"/*.pdf
ls -lh "$QA_DIR/logs"
find "$QA_DIR" -type d -name '.md2pdf-*' -print
```

Inspect failures in `"$QA_DIR/logs/"` (including the `agent-*.jsonl` files). Clean up **only after confirming the exact directory**:

```bash
printf 'Reviewing QA directory: %s\n' "$QA_DIR"
# Then, when you are certain this is a disposable test directory:
rm -ri -- "$QA_DIR"
```

Do not mark the release approved solely because the script ran. Finish the outstanding checks in [`RELEASE.md`](RELEASE.md), including npm audit/license review and explicit approval for any merge, tag or publication.
