# LaTeX math

[Back to pi-md2pdf](../README.md)

pi-md2pdf renders TeX/LaTeX mathematical notation embedded in Markdown using [KaTeX](https://katex.org/). It is suitable for technical reports, scientific notes and mathematical specifications. You do not need to install LaTeX, MathJax, a browser extension or an external renderer.

Math is enabled automatically in both Pi and the standalone converter. It is rendered locally in Node.js; KaTeX's stylesheet and fonts are embedded into the document when needed.

## 1. Supported syntax

| Form | Markdown syntax | Output |
| --- | --- | --- |
| Inline dollar delimiters | `$E=mc^2$` | Equation inside a paragraph |
| Inline parentheses | `\(E=mc^2\)` | Equation inside a paragraph |
| Display dollar delimiters | `$$E=mc^2$$` | Separate equation |
| Display brackets | `\[E=mc^2\]` | Separate equation |
| Fenced math | A bare `math` fence | Separate equation |
| Fenced LaTeX | A bare `latex` fence | Separate equation |
| Literal TeX source | `tex` or `text` fence, inline code | Unrendered source |

Use display delimiters on their own lines. Both single-line and multiline display expressions are supported. Avoid spaces immediately inside single-dollar inline delimiters, so normal prose and prices are less likely to be interpreted as math.

### Inline equations

~~~markdown
The kinetic energy is $E_k = \frac{1}{2}mv^2$.

The density is \(\rho(r)\).
~~~

### Display equations

~~~markdown
$$
T = \pi\sqrt{\frac{R}{g_s}}
$$

\[
\int_0^R g(r)\,dr
\]
~~~

Example:

$$
T = \pi\sqrt{\frac{R}{g_s}}
$$

### Fenced equations

Use a fence labeled exactly `math` or `latex`, with only the equation inside. Do not include an additional pair of math delimiters inside the fence.

~~~markdown
```math
\frac{d}{dx} x^n = nx^{n-1}
```

```latex
x^2 + y^2 = r^2
```
~~~

## 2. Mathematical notation

KaTeX supports a broad math-mode subset of LaTeX. The following examples demonstrate common constructs.

| Construct | Example expression |
| --- | --- |
| Superscript and subscript | `x_i^2` |
| Greek letters | `\alpha + \beta = \gamma` |
| Fraction | `\frac{a}{b}` |
| Root | `\sqrt{x^2+y^2}` |
| Sum | `\sum_{k=1}^{n} k` |
| Integral | `\int_0^1 x^2\,dx` |
| Limit | `\lim_{x\to0}\frac{\sin x}{x}` |
| Vector | `\vec{v}` |
| Mathematical text | `\text{for } x>0` |

For the complete list of supported commands, see the [KaTeX supported functions reference](https://katex.org/docs/supported.html). Support for an individual KaTeX command does not imply that an entire LaTeX document can be compiled.

### Matrices

~~~markdown
$$
A = \begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$
~~~

$$
A = \begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

### Multiline aligned equations

~~~markdown
$$
\begin{aligned}
(a+b)^2 &= (a+b)(a+b) \\
        &= a^2 + 2ab + b^2
\end{aligned}
$$
~~~

Use `aligned` to break wide equations into readable lines. Equations are kept together where possible during printing, but oversized formulas are not automatically scaled to fit the page.

### Piecewise functions

~~~markdown
$$
f(x) =
\begin{cases}
x^2, & x \ge 0 \\
-x, & x < 0
\end{cases}
$$
~~~

## 3. Math in normal Markdown

Inline formulas can appear in paragraphs, headings and table cells. Math in headings is also rendered in the optional table of contents.

~~~markdown
## Energy $E = mc^2$

| Quantity | Expression |
| --- | --- |
| Area | $\pi r^2$ |
| Volume | $\frac{4}{3}\pi r^3$ |
~~~

For tables, remember that Markdown itself treats the pipe character as a column separator. Use commands such as `\lvert` and `\rvert` for absolute-value notation instead of unescaped pipe characters.

Unicode mathematical text such as `π`, `ρ(r)` and `x²` remains ordinary text, without invoking KaTeX. Appearance depends on available system fonts.

## 4. Literal TeX and dollar signs

Use inline code or an ordinary fenced code block when showing TeX source instead of rendering it.

~~~markdown
Use the command `\frac{a}{b}` to produce a fraction.

```tex
\frac{a}{b}
```

The literal price is \$20.
~~~

A `tex` fence is literal code, whereas a `latex` fence renders an equation. Ordinary code fences and inline code are not interpreted as mathematics. Escape a literal dollar sign as `\$` when it could be mistaken for a delimiter.

## 5. Errors and limitations

- Invalid or unsupported TeX commands produce an actionable conversion error. Unclosed dollar display blocks are rejected rather than silently consuming the rest of the document.
- The Mermaid error policy applies only to Mermaid diagrams. It does not change math error handling.
- This is math-mode rendering, not a full TeX/LaTeX compiler. Document classes, arbitrary packages, TikZ, custom document layouts and external TeX programs are not supported.
- Untrusted TeX commands cannot enable trusted HTML, arbitrary links or external resources. Macro expansion and sizing are bounded.
- Very wide equations may overflow the printable area. Split them with `aligned` or shorter expressions and review the resulting PDF.

## 6. Try it in Pi

Create a Markdown file with one or more of the examples above, then run:

~~~text
/md2pdf equations.md
/md2pdf equations.md --toc
~~~

The repository's [math test fixture](https://github.com/civcode/pi-md2pdf/blob/main/tests/fixtures/mathtest.md) contains examples of the different delimiter and fence forms.
