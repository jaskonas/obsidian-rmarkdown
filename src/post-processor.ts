import {
	MarkdownPostProcessorContext,
} from "obsidian";
import {
	parseChunkHeader,
	isInlineRCode,
	extractInlineRExpression,
} from "./rmd-parser";

/**
 * Post-processor that enhances RMarkdown elements in Obsidian's reading view.
 *
 * For R code chunks: parses the chunk header, adds a visual label showing
 * the engine and chunk name, and fixes the syntax-highlight class to the
 * engine language (e.g. "r", "python", "sql").
 *
 * For inline R code: adds a visual "R" badge so readers can distinguish
 * inline R expressions from ordinary inline code.
 */
export function rmarkdownPostProcessor(
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void {
	processCodeBlocks(el, ctx);
	processInlineCode(el);
}

function processCodeBlocks(
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void {
	const codeBlocks = el.querySelectorAll<HTMLElement>("pre > code");

	for (const codeEl of Array.from(codeBlocks)) {
		const pre = codeEl.parentElement;
		if (!pre) continue;

		// Try to get chunk info from the code element's CSS class.
		// Obsidian sets class="language-{r" (or similar) from the info string.
		const langClass = Array.from(codeEl.classList).find((c) =>
			c.startsWith("language-")
		);

		let infoString: string | null = null;

		if (langClass) {
			const lang = langClass.slice("language-".length);
			// RMarkdown chunks start with "{"
			if (!lang.startsWith("{")) continue;
			infoString = lang;
		}

		// If class-based detection didn't yield a full info string,
		// try getSectionInfo to read the original markdown source.
		if (!infoString || !infoString.endsWith("}")) {
			const sectionInfo = ctx.getSectionInfo(codeEl);
			if (sectionInfo) {
				const lines = sectionInfo.text.split("\n");
				const openFence = lines[sectionInfo.lineStart];
				const extracted = openFence.replace(/^`{3,}/, "").trim();
				if (extracted.startsWith("{") && extracted.endsWith("}")) {
					infoString = extracted;
				}
			}
		}

		if (!infoString) continue;

		const meta = parseChunkHeader(infoString);
		if (!meta) continue;

		// --- Enhance the code block ---

		// Wrap pre in a container div for styling. We use Obsidian's
		// createDiv() helper (which appends to the parent) and then move
		// the wrapper into position just before <pre>.
		const parent = pre.parentElement!;
		const wrapper = parent.createDiv({ cls: "rmd-code-chunk" });
		wrapper.dataset.engine = meta.engine;
		parent.insertBefore(wrapper, pre);

		// Build the chunk header inside the wrapper (before we move pre in,
		// so header naturally precedes pre).
		const header = wrapper.createDiv({ cls: "rmd-chunk-header" });

		header.createSpan({
			cls: "rmd-engine-badge",
			text: meta.engine.toUpperCase(),
		});

		if (meta.name) {
			header.createSpan({ cls: "rmd-chunk-name", text: meta.name });
		}

		const optionKeys = Object.keys(meta.options);
		if (optionKeys.length > 0) {
			header.createSpan({
				cls: "rmd-chunk-options",
				text: optionKeys
					.map((k) => `${k}=${meta.options[k]}`)
					.join(", "),
			});
		}

		// Now move pre into wrapper, after the header.
		wrapper.appendChild(pre);

		// Fix syntax highlighting class to plain engine name
		codeEl.className = `language-${meta.engine}`;
	}
}

function processInlineCode(el: HTMLElement): void {
	// Select inline <code> elements that are NOT inside <pre> (code blocks)
	const allCode = el.querySelectorAll<HTMLElement>("code");

	for (const codeEl of Array.from(allCode)) {
		// Skip code inside pre elements (those are code blocks, not inline)
		if (codeEl.closest("pre")) continue;

		const text = codeEl.textContent || "";
		if (!isInlineRCode(text)) continue;

		const expr = extractInlineRExpression(text);
		if (!expr) continue;

		codeEl.classList.add("rmd-inline-r");
		codeEl.empty();

		codeEl.createSpan({ cls: "rmd-inline-badge", text: "R" });
		codeEl.appendText(` ${expr}`);
	}
}
