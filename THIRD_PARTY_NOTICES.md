# Third-party notices

pi-md2pdf is distributed under the MIT License (see [LICENSE](LICENSE)).
Its runtime depends on the following open-source software:

| Dependency | License | Upstream license |
| --- | --- | --- |
| [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) | MIT | [License](https://github.com/sindresorhus/github-markdown-css/blob/main/license) |
| [highlight.js](https://github.com/highlightjs/highlight.js) | BSD-3-Clause | [License](https://github.com/highlightjs/highlight.js/blob/main/LICENSE) |
| [markdown-it](https://github.com/markdown-it/markdown-it) | MIT | [License](https://github.com/markdown-it/markdown-it/blob/master/LICENSE) |
| [puppeteer-core](https://github.com/puppeteer/puppeteer) | Apache-2.0 | [License](https://github.com/puppeteer/puppeteer/blob/main/LICENSE) |

The Markdown CSS is loaded from `github-markdown-css` at runtime and is
incorporated in the HTML printed to PDF. Syntax highlighting is provided by
`highlight.js`. The applicable licenses and notices from those projects
are reproduced below. Other package dependencies and their licenses remain
in the installed npm dependency tree.

The `puppeteer-core` dependency does **not** bundle Chrome, Chromium, or
Microsoft Edge. Browser binaries and any fonts are installed and licensed
separately by the user or operating system.

The list reflects direct runtime dependencies checked against upstream license
files. Before publication, also verify the installed dependency versions and
any transitive `NOTICE` requirements.

---

## github-markdown-css — MIT License

Source: https://github.com/sindresorhus/github-markdown-css/blob/main/license

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

---

## highlight.js — BSD 3-Clause License

Source: https://github.com/highlightjs/highlight.js/blob/main/LICENSE

```text
BSD 3-Clause License

Copyright (c) 2006, Ivan Sagalaev.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---
For other runtime dependencies, consult their own license files in
`node_modules/` or their upstream repositories. In particular, the Apache
2.0 license text and any notices for Puppeteer are maintained at
https://github.com/puppeteer/puppeteer/blob/main/LICENSE.
