#!/usr/bin/env bash
# Real Pi Linux acceptance checks. Requires Pi, Chromium and current node_modules.
set -u -o pipefail
REPO="${QA_REPO:-$HOME/workspace/pi-md2pdf}"
REPO="$(realpath "$REPO")" || exit 1
[[ -f "$REPO/package.json" ]] || { echo "Set QA_REPO to the pi-md2pdf checkout" >&2; exit 1; }
command -v pi >/dev/null || { echo "Pi is not installed" >&2; exit 1; }
QA="$(mktemp -d /tmp/pi-md2pdf-e2e.XXXXXX)" || exit 1
mkdir -p "$QA/docs" "$QA/project" "$QA/foreign" "$QA/logs"
cp "$REPO/tests/fixtures/sample.md" "$QA/report.md"
printf '# Unicode report\n\nMüller Straße €\n' > "$QA/My Report.md"
printf '# Nested report\n' > "$QA/docs/nested.md"
printf '# Concurrent export\n' > "$QA/concurrent.md"
printf '# LOCAL-ONLY-5507\n' > "$QA/project/marker.md"
printf '# FOREIGN-ONLY-5507\n' > "$QA/foreign/marker.md"
printf 'DO-NOT-OVERWRITE\n' > "$QA/existing.pdf"
passed=0; failed=0; skipped=0; index=0
pi_print() (
  cd "$QA" || exit 1
  pi --no-session --no-extensions --extension "$REPO/dist/extension.js" \
    --no-mcp --no-skills --no-prompt-templates --no-context-files --print "$1"
)
pi_json() (
  cd "$1" || exit 1
  pi --no-session --no-extensions --extension "$REPO/dist/extension.js" \
    --no-mcp --no-skills --no-prompt-templates --no-context-files \
    --tools markdown_to_pdf --mode json "$2"
)
valid_pdf() { [[ -s "$1" && "$(head -c 5 "$1")" == '%PDF-' ]]; }
record() {
  local name="$1"; shift
  index=$((index+1))
  local log="$QA/logs/$(printf '%02d' "$index").log"
  if "$@" > "$log" 2>&1; then
    printf 'PASS  %s\n' "$name"
    passed=$((passed+1))
  else
    printf 'FAIL  %s (log: %s)\n' "$name" "$log"
    tail -n 8 "$log" | sed 's/^/      /'
    failed=$((failed+1))
  fi
}
skip() { printf 'SKIP  %s\n' "$1"; skipped=$((skipped+1)); }
preflight() {
  (cd "$REPO" && npm run typecheck && npm test && npm run build &&
    npm run check:load && npm run check:package && npm run pack:check)
}
a1() { pi_print '/md2pdf report.md' && valid_pdf "$QA/report.pdf"; }
a2() {
  local hash; hash="$(sha256sum "$QA/report.pdf" | cut -d ' ' -f 1)"
  pi_print '/md2pdf report.md' && pi_print '/md2pdf report.md' &&
    valid_pdf "$QA/report-2.pdf" && valid_pdf "$QA/report-3.pdf" &&
    [[ "$hash" == "$(sha256sum "$QA/report.pdf" | cut -d ' ' -f 1)" ]]
}
a3() {
  local output
  output="$(pi_print '/md2pdf report.md existing.pdf' 2>&1)"
  [[ "$output" == *'Output exists'* ]] &&
    grep -qx 'DO-NOT-OVERWRITE' "$QA/existing.pdf"
}
a4() { pi_print '/md2pdf report.md existing.pdf --force' && valid_pdf "$QA/existing.pdf"; }
a5() {
  pi_print '/md2pdf "My Report.md"' && pi_print '/md2pdf docs/nested.md' &&
    valid_pdf "$QA/My Report.pdf" && valid_pdf "$QA/docs/nested.pdf"
}
a5unicode() { pdftotext "$QA/My Report.pdf" - | grep -q 'Müller Straße €'; }
a6() { pi_print '/md2pdf report.md letter.pdf --paper letter' && valid_pdf "$QA/letter.pdf"; }
a6dimensions() {
  pdfinfo "$QA/report.pdf" | grep -Eq 'Page size: *595(\.[0-9]+)? x 84[12](\.[0-9]+)? pts' &&
    pdfinfo "$QA/letter.pdf" | grep -Eq 'Page size: *612(\.[0-9]+)? x 792(\.[0-9]+)? pts'
}
a7missing() {
  local output; output="$(pi_print '/md2pdf missing.md' 2>&1)"
  [[ "$output" == *'md2pdf:'* && ! -e "$QA/missing.pdf" ]]
}
a7browser() {
  local output
  output="$(MD2PDF_BROWSER_PATH=/definitely/missing/browser pi_print '/md2pdf report.md bad-browser.pdf' 2>&1)"
  [[ "$output" == *'Configured browser is missing'* && ! -e "$QA/bad-browser.pdf" ]]
}
a8() {
  pi_print '/md2pdf concurrent.md' > "$QA/logs/concurrent-a.log" 2>&1 & local p1=$!
  pi_print '/md2pdf concurrent.md' > "$QA/logs/concurrent-b.log" 2>&1 & local p2=$!
  local e1=0 e2=0
  wait "$p1" || e1=1
  wait "$p2" || e2=1
  (( e1==0 && e2==0 )) && valid_pdf "$QA/concurrent.pdf" &&
    valid_pdf "$QA/concurrent-2.pdf"
}
a9() {
  (unset DISPLAY WAYLAND_DISPLAY; pi_print '/md2pdf report.md headless.pdf') &&
    valid_pdf "$QA/headless.pdf"
}
a10() {
  (cd "$QA" && node "$REPO/dist/cli.js" report.md -o cli.pdf) &&
    valid_pdf "$QA/cli.pdf"
}
a11() {
  pi_print '/md2pdf report.md options.pdf --toc --number-sections' &&
    valid_pdf "$QA/options.pdf"
}
a12() { [[ -z "$(find "$QA" -type d -name '.md2pdf-*' -print -quit)" ]]; }
a13() {
  local message
  message="$(pi_print '/md2pdf report.md -o rejected.pdf' 2>&1)"
  [[ "$message" == *'Unknown option: -o'* && ! -e "$QA/rejected.pdf" ]] || return 1
  pi_print '/md2pdf report.md --output accepted.pdf' &&
    valid_pdf "$QA/accepted.pdf"
}


b1() {
  pi_json "$QA" 'Convert report.md to PDF as-is using markdown_to_pdf. Do not add TOC, numbering or overwrite.' > "$QA/logs/agent-default.jsonl" || return 1
  jq -se 'any(.[]; .type=="tool_execution_start" and .toolName=="markdown_to_pdf" and .args.input=="report.md" and .args.toc!=true and .args.numberSections!=true and .args.overwrite!=true)' "$QA/logs/agent-default.jsonl" >/dev/null || return 1
  local output
  output="$(jq -rs '[.[]|select(.type=="tool_execution_end" and .toolName=="markdown_to_pdf" and .isError==false and (.result.details.output|type)=="string")|.result.details.output]|.[-1]//""' "$QA/logs/agent-default.jsonl")"
  [[ "$output" == "$QA/"* ]] && valid_pdf "$output"
}
b2() {
  pi_json "$QA/project" 'Convert marker.md in the CURRENT working directory with markdown_to_pdf. Only use marker.md, do not search elsewhere.' > "$QA/logs/agent-local.jsonl" || return 1
  jq -se 'any(.[]; .type=="tool_execution_start" and .toolName=="markdown_to_pdf" and .args.input=="marker.md") and any(.[]; .type=="tool_execution_end" and .toolName=="markdown_to_pdf" and .isError==false)' "$QA/logs/agent-local.jsonl" >/dev/null || return 1
  valid_pdf "$QA/project/marker.pdf" && [[ ! -e "$QA/foreign/marker.pdf" ]] || return 1
  if command -v pdftotext >/dev/null; then
    pdftotext "$QA/project/marker.pdf" - | grep -q LOCAL-ONLY-5507 || return 1
  fi
}
b3() {
  pi_json "$QA/project" "Try to convert $QA/foreign/marker.md using markdown_to_pdf. Do not substitute another file." > "$QA/logs/agent-outside.jsonl" || return 1
  [[ ! -e "$QA/foreign/marker.pdf" ]] || return 1
  # A refusal without a tool call is acceptable; called tools must reject external files.
  jq -se '([.[]|select(.type=="tool_execution_start" and .toolName=="markdown_to_pdf")]|length)==0 or ([.[]|select(.type=="tool_execution_end" and .toolName=="markdown_to_pdf")]|length>0 and all(.[]|select(.type=="tool_execution_end" and .toolName=="markdown_to_pdf"); .isError==true))' "$QA/logs/agent-outside.jsonl" >/dev/null
}
b4() {
  pi_json "$QA" 'Convert report.md with markdown_to_pdf; explicitly add a linked TOC AND automatic section numbering, output formatted.pdf.' > "$QA/logs/agent-format.jsonl" || return 1
  jq -se 'any(.[]; .type=="tool_execution_start" and .toolName=="markdown_to_pdf" and .args.toc==true and .args.numberSections==true) and any(.[]; .type=="tool_execution_end" and .toolName=="markdown_to_pdf" and .isError==false)' "$QA/logs/agent-format.jsonl" >/dev/null &&
    valid_pdf "$QA/formatted.pdf"
}

printf '\nLinux real-Pi QA\nRepository: %s\nDisposable test directory: %s\n' "$REPO" "$QA"
printf 'Model-backed checks: %s (RUN_AGENT=0 disables four model calls)\n\n' "${RUN_AGENT:-1}"
record 'Preflight: typecheck, 51 tests, build, Pi loader and npm package' preflight
[[ -f "$REPO/dist/extension.js" ]] || { echo 'Built extension missing'; exit 1; }
record 'A1  Real Pi slash command' a1
record 'A2  Numbered filenames without overwriting' a2
record 'A3  Refuse unauthorized overwrite' a3
record 'A4  Authorized --force overwrite' a4
record 'A5  Spaces, quoting and nested files' a5
if command -v pdftotext >/dev/null; then record 'A5b Unicode survives PDF text extraction' a5unicode; else skip 'A5b Unicode extraction (pdftotext not installed)'; fi
record 'A6  Letter format PDF' a6
if command -v pdfinfo >/dev/null; then record 'A6b Actual A4 vs Letter page sizes' a6dimensions; else skip 'A6b Page geometry (pdfinfo not installed)'; fi
record 'A7  Missing Markdown error' a7missing
record 'A7b Missing browser error' a7browser
record 'A8  Concurrent atomic output allocation' a8
record 'A9  Headless Pi without DISPLAY' a9
record 'A10 Standalone CLI' a10
record 'A11 Explicit TOC and section numbering' a11
record 'A12 No temporary conversion directories' a12
record 'A13 Pi rejects -o and accepts --output' a13
if [[ "${RUN_AGENT:-1}" == 1 ]]; then
  if command -v jq >/dev/null; then
    printf '\nAgent tests invoke Pi four times and may use model/API tokens.\n'
    record 'B1  Agent conservative defaults and output' b1
    record 'B2  Agent chooses only local same-named file' b2
    record 'B3  Agent/tool workspace boundary' b3
    record 'B4  Agent explicitly requested TOC and numbering' b4
    record 'A12 No temporary dirs after agent runs' a12
  else
    skip 'B1-B4 agent checks: jq is not installed'
  fi
else
  skip 'B1-B4 agent checks disabled via RUN_AGENT=0'
fi
printf '\nRESULT: %s passed, %s failed, %s skipped\n' "$passed" "$failed" "$skipped"
printf 'Logs and PDFs preserved in: %s\n' "$QA"
printf '\nManual Pi UI checks (noninteractive mode cannot verify them):\n'
printf ' C1 Tab: /md2pdf rep, docs/ne, "My Re\n'
printf ' C2 Flags: --output appears once; -o is hidden; --paper offers a4/letter\n'
printf ' C3 Enter after completing --toc must execute\n'
printf ' C4 Decline overwrite confirmation; file contents remain unchanged\n'
printf ' C5 Agent compact/expanded tool displays show input and actual output\n'
printf ' C6 SSH/tmux, interrupt and Chromium process cleanup\n'
printf ' C7 Inspect long UWB PDF against accepted baseline\n'
if [[ "${RUN_INTERACTIVE:-1}" == 1 ]]; then
  printf '\nLaunching interactive Pi in the QA directory. Quit Pi when finished.\n'
  (cd "$QA" && pi --no-session --no-extensions --extension "$REPO/dist/extension.js" \
    --no-mcp --no-skills --no-prompt-templates --no-context-files)
else
  printf '\nInteractive Pi disabled by RUN_INTERACTIVE=0.\n'
fi
(( failed == 0 ))
