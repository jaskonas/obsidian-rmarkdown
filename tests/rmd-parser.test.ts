import { describe, it, expect } from "vitest";
import { parseChunkHeader, isInlineRCode, extractInlineRExpression } from "../src/rmd-parser";

describe("parseChunkHeader", () => {
	it("returns null for standard (non-RMarkdown) language strings", () => {
		expect(parseChunkHeader("javascript")).toBeNull();
		expect(parseChunkHeader("python")).toBeNull();
		expect(parseChunkHeader("r")).toBeNull();
		expect(parseChunkHeader("")).toBeNull();
	});

	it("parses engine-only chunk: {r}", () => {
		expect(parseChunkHeader("{r}")).toEqual({
			engine: "r",
			name: null,
			options: {},
		});
	});

	it("parses chunk with name: {r setup}", () => {
		expect(parseChunkHeader("{r setup}")).toEqual({
			engine: "r",
			name: "setup",
			options: {},
		});
	});

	it("parses chunk with name and options: {r my-plot, echo=FALSE, fig.width=10}", () => {
		expect(
			parseChunkHeader("{r my-plot, echo=FALSE, fig.width=10}")
		).toEqual({
			engine: "r",
			name: "my-plot",
			options: { echo: "FALSE", "fig.width": "10" },
		});
	});

	it("parses chunk with options but no name (leading comma): {r, echo=FALSE}", () => {
		expect(parseChunkHeader("{r, echo=FALSE}")).toEqual({
			engine: "r",
			name: null,
			options: { echo: "FALSE" },
		});
	});

	it("parses non-R engine: {python}", () => {
		expect(parseChunkHeader("{python}")).toEqual({
			engine: "python",
			name: null,
			options: {},
		});
	});

	it("parses SQL engine with options: {sql, connection=con}", () => {
		expect(parseChunkHeader("{sql, connection=con}")).toEqual({
			engine: "sql",
			name: null,
			options: { connection: "con" },
		});
	});

	it("handles quoted option values: {r, fig.cap=\"My Figure\"}", () => {
		expect(parseChunkHeader('{r, fig.cap="My Figure"}')).toEqual({
			engine: "r",
			name: null,
			options: { "fig.cap": '"My Figure"' },
		});
	});

	it("handles whitespace variations", () => {
		expect(parseChunkHeader("{r  setup ,  echo=TRUE }")).toEqual({
			engine: "r",
			name: "setup",
			options: { echo: "TRUE" },
		});
	});
});

describe("isInlineRCode", () => {
	it("identifies inline R code starting with 'r '", () => {
		expect(isInlineRCode("r 1 + 1")).toBe(true);
		expect(isInlineRCode("r nrow(df)")).toBe(true);
		expect(isInlineRCode("r paste('hello', 'world')")).toBe(true);
	});

	it("rejects text that is not inline R", () => {
		expect(isInlineRCode("regular code")).toBe(false);
		expect(isInlineRCode("return value")).toBe(false);
		expect(isInlineRCode("r")).toBe(false);
		expect(isInlineRCode("")).toBe(false);
	});
});

describe("extractInlineRExpression", () => {
	it("extracts the R expression after 'r '", () => {
		expect(extractInlineRExpression("r 1 + 1")).toBe("1 + 1");
		expect(extractInlineRExpression("r nrow(df)")).toBe("nrow(df)");
		expect(extractInlineRExpression("r paste('a', 'b')")).toBe(
			"paste('a', 'b')"
		);
	});

	it("returns null for non-R inline code", () => {
		expect(extractInlineRExpression("not r code")).toBeNull();
		expect(extractInlineRExpression("r")).toBeNull();
		expect(extractInlineRExpression("")).toBeNull();
	});
});

describe("parseChunkHeader edge cases", () => {
	it("handles chunk with only spaces inside braces: {r  }", () => {
		expect(parseChunkHeader("{r  }")).toEqual({
			engine: "r",
			name: null,
			options: {},
		});
	});

	it("handles option values containing equals: {r, eval=1+1==2}", () => {
		expect(parseChunkHeader("{r, eval=1+1==2}")).toEqual({
			engine: "r",
			name: null,
			options: { eval: "1+1==2" },
		});
	});

	it("handles single-quoted option values: {r, fig.cap='Title'}", () => {
		expect(parseChunkHeader("{r, fig.cap='Title'}")).toEqual({
			engine: "r",
			name: null,
			options: { "fig.cap": "'Title'" },
		});
	});

	it("handles chunk name with underscores: {r my_chunk_name}", () => {
		expect(parseChunkHeader("{r my_chunk_name}")).toEqual({
			engine: "r",
			name: "my_chunk_name",
			options: {},
		});
	});

	it("handles chunk name with dots: {r fig.setup}", () => {
		// Note: "fig.setup" has no = sign, so it's a name not an option
		expect(parseChunkHeader("{r fig.setup}")).toEqual({
			engine: "r",
			name: "fig.setup",
			options: {},
		});
	});

	it("rejects malformed headers: missing closing brace", () => {
		expect(parseChunkHeader("{r setup")).toBeNull();
	});

	it("rejects malformed headers: missing opening brace", () => {
		expect(parseChunkHeader("r setup}")).toBeNull();
	});
});

describe("isInlineRCode edge cases", () => {
	it("rejects 'r' followed by no space", () => {
		expect(isInlineRCode("return")).toBe(false);
		expect(isInlineRCode("result")).toBe(false);
	});

	it("rejects 'r ' with only whitespace after", () => {
		expect(isInlineRCode("r   ")).toBe(false);
	});

	it("handles multiword expressions", () => {
		expect(isInlineRCode("r mean(c(1,2,3))")).toBe(true);
	});
});
