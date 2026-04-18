import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { rmarkdownPostProcessor } from "./post-processor";
import {
    openInRStudio,
    renderDocument,
    revealRProj,
    copyRChunksToClipboard,
} from "./rstudio-integration";
import { nextAvailableName, defaultRmdTemplate } from "./templates";

const RMD_EXTENSIONS = ["rmd", "Rmd"];

function isRmdFile(file: TFile | null): file is TFile {
    if (!file) return false;
    return RMD_EXTENSIONS.includes(file.extension);
}

export default class RMarkdownPlugin extends Plugin {
    async onload(): Promise<void> {
        // Register .rmd and .Rmd so Obsidian treats them as markdown files.
        this.registerExtensions(RMD_EXTENSIONS, "markdown");

        // Enhance reading view with R-specific styling.
        this.registerMarkdownPostProcessor(rmarkdownPostProcessor);

        // ── Command palette commands ───────────────────────────────────
        this.addCommand({
            id: "open-in-rstudio",
            name: "Open in RStudio",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (!isRmdFile(file)) return false;
                if (checking) return true;
                const fullPath = this.resolveVaultPath(file);
                if (fullPath) openInRStudio(fullPath);
                return true;
            },
        });

        this.addCommand({
            id: "render-document",
            name: "Render document",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (!isRmdFile(file)) return false;
                if (checking) return true;
                const fullPath = this.resolveVaultPath(file);
                if (fullPath) renderDocument(fullPath);
                return true;
            },
        });

        this.addCommand({
            id: "reveal-rproj",
            name: "Reveal .Rproj in Finder/Explorer",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (!isRmdFile(file)) return false;
                if (checking) return true;
                const fullPath = this.resolveVaultPath(file);
                const vaultRoot = this.resolveVaultRoot();
                if (fullPath && vaultRoot) revealRProj(fullPath, vaultRoot);
                return true;
            },
        });

        this.addCommand({
            id: "copy-r-chunks",
            name: "Copy R chunks to clipboard",
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const file = view?.file ?? this.app.workspace.getActiveFile();
                if (!isRmdFile(file)) return false;
                if (checking) return true;
                void (async () => {
                    try {
                        const content = await this.app.vault.read(file);
                        await copyRChunksToClipboard(content);
                    } catch (err) {
                        new Notice(`Copy R chunks failed: ${err instanceof Error ? err.message : String(err)}`);
                    }
                })();
                return true;
            },
        });

        this.addCommand({
            id: "create-new-rmarkdown",
            name: "Create new RMarkdown document",
            callback: async () => {
                try {
                    await this.createNewRmdDocument();
                } catch (err) {
                    new Notice(`Create RMarkdown failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            },
        });
    }

    private async createNewRmdDocument(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        const parent = activeFile?.parent ?? this.app.vault.getRoot();

        // Build an existence predicate against the parent folder's children.
        const existing = new Set(
            parent.children.map((c) => c.name)
        );
        const filename = nextAvailableName("Untitled", "rmd", (name) =>
            existing.has(name)
        );

        const fullPath =
            parent.path === "/" || parent.path === ""
                ? filename
                : `${parent.path}/${filename}`;

        const date = new Date().toISOString().slice(0, 10);
        const content = defaultRmdTemplate(date);

        const file = await this.app.vault.create(fullPath, content);
        await this.app.workspace.getLeaf(false).openFile(file);
        new Notice(`Created ${file.name}`);
    }

    /**
     * Resolve a vault-relative TFile to an absolute filesystem path.
     * Returns null when the adapter doesn't expose a base path (e.g. mobile).
     */
    private resolveVaultPath(file: TFile): string | null {
        const adapter = this.app.vault.adapter as unknown as {
            getBasePath?: () => string;
        };
        if (typeof adapter.getBasePath !== "function") return null;
        const base = adapter.getBasePath();
        const path = require("path") as typeof import("path");
        return path.join(base, file.path);
    }

    private resolveVaultRoot(): string | null {
        const adapter = this.app.vault.adapter as unknown as {
            getBasePath?: () => string;
        };
        if (typeof adapter.getBasePath !== "function") return null;
        return adapter.getBasePath();
    }
}
