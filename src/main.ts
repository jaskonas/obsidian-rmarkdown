import { Plugin } from "obsidian";
import { rmarkdownPostProcessor } from "./post-processor";

export default class RMarkdownPlugin extends Plugin {
	async onload(): Promise<void> {
		// Register .rmd and .Rmd so Obsidian treats them as markdown files.
		// This makes them appear in the file explorer and open in the
		// markdown editor/reader — the single most important line in the plugin.
		this.registerExtensions(["rmd", "Rmd"], "markdown");

		// Enhance reading view with R-specific styling
		this.registerMarkdownPostProcessor(rmarkdownPostProcessor);
	}
}
