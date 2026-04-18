import { Notice } from "obsidian";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { extractRChunks } from "./rmd-parser";

// electron is an esbuild external resolved at runtime by Obsidian's desktop
// environment. We use a typed require() here to avoid needing @types/electron.
interface ElectronShell {
    openPath(path: string): Promise<string>;
    showItemInFolder(fullPath: string): void;
}
const shell: ElectronShell = (require("electron") as { shell: ElectronShell }).shell;

/**
 * Launch RStudio with the given .rmd file.
 * macOS: `open -a RStudio <file>`.
 * Linux/Windows: `rstudio <file>` (must be on PATH).
 */
export function openInRStudio(filePath: string): void {
    const isMac = process.platform === "darwin";
    const cmd = isMac ? "open" : "rstudio";
    const args = isMac ? ["-a", "RStudio", filePath] : [filePath];

    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", (err) => {
        new Notice(`Could not launch RStudio: ${err.message}`);
    });
    child.unref();
    new Notice("Opening in RStudio…");
}

/**
 * Render the .rmd file using rmarkdown::render(), then open the output.
 * Requires R + rmarkdown package installed on the system PATH.
 */
export function renderDocument(filePath: string): void {
    new Notice("Rendering RMarkdown… this may take a moment.");

    const rCode = `rmarkdown::render(${JSON.stringify(filePath)})`;
    const child = spawn("Rscript", ["-e", rCode], {
        cwd: path.dirname(filePath),
    });

    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
    });

    child.on("error", (err) => {
        new Notice(`Render failed to start: ${err.message}`);
    });

    child.on("close", (code) => {
        if (code !== 0) {
            new Notice(`Render failed (exit ${code}). Check R output.`);
            console.error("rmarkdown::render stderr:", stderr);
            console.error("rmarkdown::render stdout:", stdout);
            return;
        }

        // rmarkdown::render prints "Output created: <path>" to stderr (R's message channel).
        const combined = stderr + "\n" + stdout;
        const outputMatch = combined.match(/Output created:\s*(.+)/);
        if (outputMatch) {
            const rawOutput = outputMatch[1].trim();
            const outputPath = path.isAbsolute(rawOutput)
                ? rawOutput
                : path.resolve(path.dirname(filePath), rawOutput);
            new Notice(`Render complete: ${path.basename(outputPath)}`);
            shell.openPath(outputPath).catch((err) => {
                console.error("Failed to open rendered output:", err);
            });
        } else {
            new Notice("Render complete.");
        }
    });
}

/**
 * Walk up from the given file's directory to the vault root, find the
 * nearest .Rproj file, and reveal it in the OS file manager.
 */
export function revealRProj(filePath: string, vaultRoot: string): void {
    const rproj = findNearestRProj(path.dirname(filePath), vaultRoot);
    if (!rproj) {
        new Notice("No .Rproj file found in this directory or any ancestor within the vault.");
        return;
    }
    shell.showItemInFolder(rproj);
}

function findNearestRProj(startDir: string, vaultRoot: string): string | null {
    let dir = path.resolve(startDir);
    const root = path.resolve(vaultRoot);

    while (true) {
        try {
            const entries = fs.readdirSync(dir);
            const hit = entries.find((e) => e.toLowerCase().endsWith(".rproj"));
            if (hit) return path.join(dir, hit);
        } catch (_) {
            return null;
        }

        if (dir === root) return null;
        const parent = path.dirname(dir);
        if (parent === dir) return null; // filesystem root
        if (!parent.startsWith(root)) return null; // escaped the vault
        dir = parent;
    }
}

/**
 * Extract R chunks from the file content and copy them to the clipboard.
 */
export async function copyRChunksToClipboard(content: string): Promise<void> {
    const rCode = extractRChunks(content);
    if (!rCode) {
        new Notice("No R code chunks found in this file.");
        return;
    }
    await navigator.clipboard.writeText(rCode);
    new Notice("R code chunks copied to clipboard.");
}
