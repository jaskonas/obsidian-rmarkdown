/**
 * Find an available filename by appending a numeric suffix when needed.
 * Mirrors Obsidian's convention: "Untitled.rmd", "Untitled 1.rmd", "Untitled 2.rmd", …
 *
 * @param base - base name without extension, e.g. "Untitled"
 * @param ext  - extension without the dot, e.g. "rmd"
 * @param exists - predicate that returns true if the given filename already exists
 */
export function nextAvailableName(
    base: string,
    ext: string,
    exists: (name: string) => boolean
): string {
    const first = `${base}.${ext}`;
    if (!exists(first)) return first;
    for (let n = 1; n < 10000; n++) {
        const candidate = `${base} ${n}.${ext}`;
        if (!exists(candidate)) return candidate;
    }
    throw new Error("Could not find an available filename after 10000 attempts");
}

export function defaultRmdTemplate(date: string): string {
    const FENCE = "```";
    return [
        "---",
        'title: "Untitled"',
        "output: html_document",
        `date: "${date}"`,
        "---",
        "",
        `${FENCE}{r setup, include=FALSE}`,
        "knitr::opts_chunk$set(echo = TRUE)",
        FENCE,
        "",
        "## R Markdown",
        "",
        "This is an R Markdown document. Markdown is a simple formatting syntax for authoring HTML, PDF, and MS Word documents. For more details on using R Markdown see <http://rmarkdown.rstudio.com>.",
        "",
        "When you click the **Knit** button a document will be generated that includes both content and the output of any embedded R code chunks within the document. You can embed an R code chunk like this:",
        "",
        `${FENCE}{r cars}`,
        "summary(cars)",
        FENCE,
        "",
        "## Including Plots",
        "",
        "You can also embed plots, for example:",
        "",
        `${FENCE}{r pressure, echo=FALSE}`,
        "plot(pressure)",
        FENCE,
        "",
        "Note that the `echo = FALSE` parameter was prevents the printing of the R code that generated the plot.",
        "",
    ].join("\n");
}
