# RMarkdown Reader for Obsidian

An [Obsidian](https://obsidian.md) plugin that lets you browse, read, and edit RMarkdown (`.rmd` / `.Rmd`) files directly within your vault — without converting them to `.md`.

## Features

- **File explorer integration** — `.rmd` files appear in the sidebar and can be opened like any other note
- **Full editor support** — edit `.rmd` files using Obsidian's markdown editor; files stay as `.rmd`
- **R code chunk display** — reading view shows a labeled header bar above each code chunk with the engine (R, Python, SQL, etc.), chunk name, and options
- **Inline R code badges** — inline R expressions (`` `r expr` ``) are visually marked with an **R** badge in reading view
- **Search & graph** — `.rmd` files are indexed by Obsidian and appear in search results and the graph view
- **Theme-aware** — all styling uses Obsidian CSS variables, so it adapts to any theme

## Installation

### From Obsidian Community Plugins (recommended)

1. Open **Settings → Community Plugins → Browse**
2. Search for **"RMarkdown Reader"**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jaskonas/obsidian-rmarkdown/releases/latest)
2. Create a folder: `<your-vault>/.obsidian/plugins/obsidian-rmarkdown/`
3. Copy the three files into that folder
4. Restart Obsidian and enable the plugin in **Settings → Community Plugins**

## How It Works

The plugin registers `.rmd` and `.Rmd` as markdown file types via Obsidian's `registerExtensions` API. This means Obsidian's native markdown editor and renderer handle the files — the plugin simply teaches Obsidian to recognize the extension.

On top of that, a **markdown post-processor** enhances the reading view:

- R code chunks (fenced with `{r chunk-name, echo=FALSE}`) get a visual header showing the engine, name, and options
- Inline R code (`` `r expression` ``) gets a small badge to distinguish it from regular inline code

**Important:** This plugin does **not** execute R code. It is a reader/display tool. To run R code, use RStudio, VS Code with R extension, or another R environment.

## RMarkdown Syntax Support

| Feature | Supported | Notes |
|---------|-----------|-------|
| YAML frontmatter | Yes | Rendered via Obsidian's built-in properties |
| R code chunks | Yes | Visual header with engine, name, options |
| Python/SQL/other engine chunks | Yes | Engine auto-detected from `{engine}` syntax |
| Inline R code | Yes | Badge display in reading view |
| Standard markdown | Yes | Handled by Obsidian natively |
| LaTeX math (`$...$`, `$$...$$`) | Yes | Handled by Obsidian natively |
| R code execution | Via command | Use the "Render document" command to run `rmarkdown::render()`. |

## Known Limitations

### LaTeX-style backtick-apostrophe quotes

Some RMarkdown/Pandoc users write quoted words using the LaTeX convention:

```
The policy was `agnostic' about the outcome.
```

Pandoc handles this via its smart-quotes extension, converting `` `foo' `` to proper curly quotes before parsing. Obsidian's markdown parser does **not** apply this transformation, so the opening backtick is interpreted as the start of an inline code span — which only closes when another backtick appears, sometimes far later in the document. The result is a large stretch of text rendered as code.

**Workarounds:**

- Use regular ASCII quotes: `'agnostic'` or `"agnostic"`
- Use typographic curly quotes directly

This is a limitation of Obsidian's markdown parser, not the plugin. A future version may add optional Pandoc-style smart-quote preprocessing.

## Commands

Available in the command palette when an `.rmd`/`.Rmd` file is active:

| Command | What it does |
|---------|--------------|
| **Open in RStudio** | Launches RStudio with the current file. |
| **Render document** | Runs `rmarkdown::render()` via `Rscript`, then opens the generated output (HTML/PDF/etc.). |
| **Reveal .Rproj in Finder/Explorer** | Walks up from the current file to find the nearest `.Rproj` file and reveals it in your OS file manager. |
| **Copy R chunks to clipboard** | Extracts all R code chunks verbatim (preserving the `` ```{r …} `` fences) and copies to clipboard. |
| **Create new RMarkdown document** | Creates a new `.rmd` file seeded with RStudio's default `html_document` template and opens it. Placed in the active file's folder (or vault root), named `Untitled.rmd` with numeric suffixes for collisions. |

## Requirements

- **Desktop only.** Commands that launch RStudio or run R (`Render document`) use Node `child_process` and Electron APIs, which Obsidian exposes only on desktop. The plugin is marked `isDesktopOnly` accordingly.
- **For `Open in RStudio`:** RStudio must be installed. On macOS, the plugin uses `open -a RStudio`; on Linux/Windows, `rstudio` must be on your system `PATH`.
- **For `Render document`:** R and the `rmarkdown` package must be installed. `Rscript` and `pandoc` must be locatable by the plugin — on macOS the plugin probes common install locations (`/usr/local/bin`, `/opt/homebrew/bin`, RStudio's app bundle) because Obsidian does not inherit your shell `PATH`. On Linux/Windows, `Rscript` must be on `PATH` (the R installer usually handles this on Windows).

### Render errors

The `Render document` command runs your `.rmd` through `rmarkdown::render()` exactly as RStudio would. If the render fails, you will see a **Notice** showing the exit code (e.g. "Render failed (exit 1)") and the full R stderr will be logged to Obsidian's developer console (**Cmd+Opt+I** on macOS, **Ctrl+Shift+I** on Linux/Windows).

Common causes are **not** plugin bugs — they're R-side issues. The plugin will not auto-install anything for you. The render halts on whatever R or knitr encounters first:

- **Missing R package:** `Error in library(foo) : there is no package called 'foo'`. Fix by running `install.packages("foo")` in R.
- **Missing Python for `{python}` chunks:** the `reticulate` package must be installed **and** a working Python interpreter must be available to it. If reticulate's auto-install of Python fails (cache cleanup, sandboxing, etc.), set `RETICULATE_PYTHON` to an existing interpreter or call `reticulate::use_python()` in a setup chunk.
- **Missing SQL driver or connection object** for `{sql}` chunks: provide a `connection=<DBI connection>` chunk option against a pre-opened connection.
- **LaTeX/TinyTeX not installed** if rendering to PDF: `tinytex::install_tinytex()` in R.
- **System-library dependencies** (e.g. GDAL for `sf`, a JDK for `rJava`) must be installed at the OS level separately from R packages.

Any uninstalled R package or missing language runtime (Python, SQL driver, LaTeX) that one of your chunks references will cause the render to exit with a non-zero code. Check the console stderr for the exact line that failed and the fix will almost always be an `install.packages(...)` call or a system-level install — not a change to this plugin.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Dev build (watch mode)
npm run dev

# Production build
npm run build
```

## License

[MIT](LICENSE)
