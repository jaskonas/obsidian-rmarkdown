import { describe, it, expect } from "vitest";
import { parseChunkHeader } from "../src/rmd-parser";

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
