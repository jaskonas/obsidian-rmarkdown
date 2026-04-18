export interface ChunkMeta {
	engine: string;
	name: string | null;
	options: Record<string, string>;
}

/**
 * Parse an RMarkdown code chunk info string like "{r chunk-name, echo=FALSE}".
 * Returns null if the string is not a valid RMarkdown chunk header.
 */
export function parseChunkHeader(infoString: string): ChunkMeta | null {
	const match = infoString.match(/^\{(\w+)([\s,].*?)?\}$/);
	if (!match) return null;

	const engine = match[1];
	const rest = (match[2] || "").trim();

	if (!rest) return { engine, name: null, options: {} };

	const tokens = splitRespectingQuotes(
		rest.startsWith(",") ? rest.slice(1) : rest
	);

	let name: string | null = null;
	const options: Record<string, string> = {};

	for (const token of tokens) {
		const trimmed = token.trim();
		if (!trimmed) continue;

		const eqIndex = trimmed.indexOf("=");
		if (eqIndex !== -1) {
			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed.slice(eqIndex + 1).trim();
			options[key] = value;
		} else if (name === null) {
			name = trimmed;
		}
	}

	return { engine, name, options };
}

/**
 * Check whether an inline code span's text content represents inline R code.
 * RMarkdown inline R uses the pattern: `r <expression>`
 */
export function isInlineRCode(text: string): boolean {
	return /^r\s+\S/.test(text);
}

/**
 * Extract the R expression from an inline R code span.
 * Given "r 1 + 1", returns "1 + 1". Returns null if not inline R.
 */
export function extractInlineRExpression(text: string): string | null {
	const match = text.match(/^r\s+(.+)$/);
	return match ? match[1] : null;
}

/**
 * Extract all R code chunks from an RMarkdown document source.
 *
 * Returns a single string with each R chunk preceded by a
 * verbatim (opening fence + info string, body, closing fence). Non-R
 * engine chunks (python, sql, etc.) are skipped. Chunks are separated
 * by a blank line.
 *
 * Returns empty string if no R chunks are present.
 */
export function extractRChunks(content: string): string {
	const fenceRegex = /^```(\{[^\n]*\})\n([\s\S]*?)^```$/gm;
	const parts: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = fenceRegex.exec(content)) !== null) {
		const infoString = match[1];
		const body = match[2].replace(/\n$/, ""); // trim trailing newline

		const meta = parseChunkHeader(infoString);
		if (!meta || meta.engine !== "r") continue;

		parts.push(`\`\`\`${infoString}\n${body}\n\`\`\``);
	}

	return parts.join("\n\n");
}

/** Split a string by commas, but don't split inside quoted substrings. */
function splitRespectingQuotes(str: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;
	let quoteChar = "";

	for (const ch of str) {
		if ((ch === '"' || ch === "'") && !inQuotes) {
			inQuotes = true;
			quoteChar = ch;
			current += ch;
		} else if (ch === quoteChar && inQuotes) {
			inQuotes = false;
			current += ch;
		} else if (ch === "," && !inQuotes) {
			result.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	if (current) result.push(current);
	return result;
}
