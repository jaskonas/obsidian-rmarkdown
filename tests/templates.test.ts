import { describe, it, expect } from "vitest";
import { nextAvailableName, defaultRmdTemplate } from "../src/templates";

describe("nextAvailableName", () => {
    it("returns base.ext when no collision", () => {
        expect(nextAvailableName("Untitled", "rmd", () => false)).toBe("Untitled.rmd");
    });

    it("appends ' 1' when base.ext exists", () => {
        expect(
            nextAvailableName("Untitled", "rmd", (name) => name === "Untitled.rmd")
        ).toBe("Untitled 1.rmd");
    });

    it("skips taken numeric suffixes", () => {
        const taken = new Set(["Untitled.rmd", "Untitled 1.rmd", "Untitled 2.rmd"]);
        expect(
            nextAvailableName("Untitled", "rmd", (n) => taken.has(n))
        ).toBe("Untitled 3.rmd");
    });

    it("handles unusual base names", () => {
        expect(nextAvailableName("Report draft", "Rmd", () => false)).toBe("Report draft.Rmd");
    });
});

describe("defaultRmdTemplate", () => {
    it("substitutes the date into the YAML frontmatter", () => {
        const out = defaultRmdTemplate("2026-04-18");
        expect(out).toContain('date: "2026-04-18"');
    });

    it("has correct YAML frontmatter structure", () => {
        const out = defaultRmdTemplate("2026-04-18");
        expect(out.startsWith("---\n")).toBe(true);
        expect(out).toContain('title: "Untitled"');
        expect(out).toContain("output: html_document");
    });

    it("includes the setup chunk with knitr opts", () => {
        const out = defaultRmdTemplate("2026-04-18");
        expect(out).toContain("```{r setup, include=FALSE}");
        expect(out).toContain("knitr::opts_chunk$set(echo = TRUE)");
    });

    it("includes the cars and pressure example chunks", () => {
        const out = defaultRmdTemplate("2026-04-18");
        expect(out).toContain("```{r cars}");
        expect(out).toContain("summary(cars)");
        expect(out).toContain("```{r pressure, echo=FALSE}");
        expect(out).toContain("plot(pressure)");
    });

    it("preserves RStudio's original 'was prevents' typo verbatim", () => {
        const out = defaultRmdTemplate("2026-04-18");
        // This is intentionally the exact phrasing from RStudio's shipped template
        expect(out).toContain("the `echo = FALSE` parameter was prevents");
    });
});
