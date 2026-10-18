# Runtime and compatibility baseline

The v1 targets Node.js >=22.19.0, current Pi extension APIs (`@earendil-works/pi-coding-agent`), and a locally installed modern Chrome, Chromium, or Microsoft Edge executable.

Runtime dependencies: `markdown-it`, `markdown-it-anchor`, `highlight.js`, `github-markdown-css`, and `puppeteer-core`. Pi-provided APIs stay in peer dependencies.

## Validation matrix

| Host | Browser | Verification |
| --- | --- | --- |
| Linux headless | Chromium | Pending dependency installation and live test |
| Windows native | Edge | Not tested yet |
| macOS native | Chrome / Edge | Not tested yet |
| WSL | Linux Chromium | Not tested yet |

No browser is downloaded as part of package installation. The extension does not start a persistent process or require a GUI. Do not claim platform verification without a successful integration test.

## Limits selected for v1

- Markdown: 10 MiB.
- Image assets: 10 MiB each; total 30 MiB.
- PDF conversion timeout: 60 seconds.
- Raster images: PNG, JPEG, and WebP under the source document directory (after symlink resolution).
- Files containing raw HTML are parsed with HTML support disabled.
- Remote resource retrieval is blocked.

Reference: https://pi.dev/docs/latest/extensions and https://pi.dev/docs/latest/packages.
