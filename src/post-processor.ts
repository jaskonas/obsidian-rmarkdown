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

		// Wrap pre in a container div for styling
		const wrapper = document.createElement("div");
		wrapper.classList.add("rmd-code-chunk");
		wrapper.dataset.engine = meta.engine;
		pre.parentElement!.insertBefore(wrapper, pre);
		wrapper.appendChild(pre);

		// Add a chunk header label above the code
		const header = document.createElement("div");
		header.classList.add("rmd-chunk-header");

		const engineBadge = document.createElement("span");
		engineBadge.classList.add("rmd-engine-badge");
		engineBadge.textContent = meta.engine.toUpperCase();
		header.appendChild(engineBadge);

		if (meta.name) {
			const nameSpan = document.createElement("span");
			nameSpan.classList.add("rmd-chunk-name");
			nameSpan.textContent = meta.name;
			header.appendChild(nameSpan);
		}

		const optionKeys = Object.keys(meta.options);
		if (optionKeys.length > 0) {
			const optsSpan = document.createElement("span");
			optsSpan.classList.add("rmd-chunk-options");
			optsSpan.textContent = optionKeys
				.map((k) => `${k}=${meta.options[k]}`)
				.join(", ");
			header.appendChild(optsSpan);
		}

		wrapper.insertBefore(header, pre);

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
		codeEl.textContent = "";

		const badge = document.createElement("span");
		badge.classList.add("rmd-inline-badge");
		badge.textContent = "R";
		codeEl.appendChild(badge);

		const exprNode = document.createTextNode(` ${expr}`);
		codeEl.appendChild(exprNode);
	}
}
