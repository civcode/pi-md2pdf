# v0.1.0 release checklist

**Status:** Release-candidate preparation only — **not approved for publication**.  
**Working branch:** `feat/initial-implementation`  
**Target:** One npm package, `pi-md2pdf@0.1.0`, exposing a standalone
`md2pdf` executable and Pi's `/md2pdf` command / `markdown_to_pdf` tool.

The release is a **manual, explicit-approval process**. Do not merge, tag,
create a GitHub release, or publish to npm merely because this checklist exists.
Do not use GitHub Actions to perform local checks or publication.

## 1. Final source review

- [x] v0.1.0 specified in `package.json`.
- [x] Repository, homepage, issue URL, Node engines, Pi manifest,
      `pi-package` keyword and `bin` declared.
- [x] Remove `private: true` so a future explicit publish is technically possible.
- [x] Declare `publishConfig.access: public` for the planned public package.
- [x] Add `prepack` build: `npm pack` and an authorized `npm publish`
      automatically compile up-to-date JS before packaging.
- [x] Include compiled `dist/`, CSS, changelog, README, LICENSE and
      third-party notices in the npm tarball. Exclude source, fixtures, secrets,
      PDF test outputs and `node_modules`.
- [x] Add `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md` and this checklist.
- [ ] Review `LICENSE` copyright attribution and final README/release notes.
- [ ] Confirm license/NOTICE obligations against the *installed versions*
      and the transitive production dependency tree.
- [ ] Confirm the npm name `pi-md2pdf` is available and the publishing
      account has permission to use it.

## 2. Required local release-candidate verification

From a clean checkout of the release-candidate commit:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run check:load
npm run check:package
npm run pack:check
npm audit
npm audit --omit=dev
```

- [x] Previous Linux source/build suite passed: **40/40 tests**.
- [x] Previous Linux Pi loader check and isolated npm install/CLI PDF render passed.
- [x] Previous production audit reported **0 vulnerabilities**.
- [ ] Rerun all checks **after the release-candidate manifest and packaging changes**.
- [ ] Confirm `npm pack --dry-run` executes `prepack`, and its file list
      includes both JS entry points, shared chunk, CSS, changelog,
      `THIRD_PARTY_NOTICES.md`, README and license.
- [ ] Confirm `npm run check:package` uses the normal npm `prepack`
      lifecycle (not `--ignore-scripts` for `npm pack`), successfully
      installs a temporary tarball, loads the real Pi extension and creates a PDF.
- [ ] Verify the full `npm audit` report. Earlier audit showed **one low
      severity development advisory** (esbuild); document or fix it without
      `npm audit fix --force`.
- [ ] Validate the generated package version, entry point and hashes match the
      reviewed source commit. No unpublished credentials or generated junk.

**Previously accepted visual baseline:** A 74-page UWB specification rendered
with 10 mm margins, no unwanted TOC/numbering, natural table widths, and good
readability. Other long/wide documents may need separate review.

## 3. Platform matrix and scope

| Target | Status |
| --- | --- |
| Linux + Chromium over SSH/tmux | Validated (user-reported local runs) |
| Windows native + Edge | Not yet runtime tested |
| macOS native + Chrome/Edge | Not yet runtime tested |
| WSL | Not yet runtime tested |

- [ ] Collect native Windows test results.
- [ ] Collect native macOS test results.
- [ ] If publishing before these checks, explicitly label Windows/macOS as
      *untested* in README/release notes and do not claim full platform
      validation. The owner chooses whether to accept that risk.
- [ ] Verify a clean conversion from a local project using Pi's direct command
      and agent tool with current release-candidate artifacts.
- [ ] Verify interactive `/md2pdf` completions in Pi for local Markdown files,
      nested paths, filenames with spaces, `--toc`, `--number-sections`,
      and `--paper a4|letter`. Verify Enter submits a complete command.
- [ ] Verify Pi agent tool-call/result rendering shows the source and requested
      flags, and reports the **actual** automatically numbered PDF filename.
- [ ] Re-run the full test suite and package checks after the completion/UI
      additions. Previous 40/40 Linux tests predate these changes.

## 4. Approval and publication (DO NOT EXECUTE YET)

**Stop here until the repository owner explicitly approves merging,
tagging, GitHub release creation and npm publication.**

After approval, coordinate these steps in order:

1. Review and merge the feature PR according to branch policy.
2. Ensure the chosen release commit passes the full checklist.
3. Replace `Unreleased` in `CHANGELOG.md` with the publication date.
4. Verify name availability and npm identity locally:
   `npm view pi-md2pdf version` and `npm whoami`. A 404 is not definitive
   proof of name availability; verify through npm.
5. Run `npm pack --dry-run` and inspect all tarball files.
6. If still approved, create an annotated `v0.1.0` tag on the reviewed
   release commit and create a GitHub release with notes and limitations.
7. If still approved and npm authentication is ready, publish
   `pi-md2pdf@0.1.0` through the owner's local npm CLI.
8. Check `npm view pi-md2pdf version`, then install from the public registry
   with `npm install -g pi-md2pdf` and `pi install npm:pi-md2pdf@0.1.0`.
9. Verify public package gallery discovery after npm indexing. The
   `pi-package` keyword makes a package **eligible**, not guaranteed
   to appear immediately.

Never store npm tokens, API credentials, or 2FA codes in the repository or
chat logs. Never dispatch GitHub Actions as a substitute for local validation.

## 5. Post-release follow-up

- [ ] Record the final published version and supported browser/platform matrix.
- [ ] Link the published npm page and Pi package gallery listing in the README.
- [ ] Keep the first release small; defer Mermaid, math, alternative themes,
      printed TOC page numbers and GUI preview.
- [ ] Revisit the remaining development audit advisory and native Windows/macOS
      compatibility if those checks were deferred.

**Related:** [Specification](SPECIFICATION.md) ·
[Roadmap](ROADMAP.md) · [Validation record](VALIDATION.md) ·
[Compatibility](COMPATIBILITY.md) · [Changelog](../CHANGELOG.md)
