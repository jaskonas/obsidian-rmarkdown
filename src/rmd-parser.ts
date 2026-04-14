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
