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
    const pandocDir = resolvePandocDir();
    const env = {
        ...process.env,
        ...(pandocDir ? { RSTUDIO_PANDOC: pandocDir } : {}),
    };

    const child = spawn(resolveRscriptPath(), ["-e", rCode], {
        cwd: path.dirname(filePath),
        env,
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
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
            const hint =
                process.platform === "win32"
                    ? "Install R and ensure the R installer's 'Add to PATH' option was checked, or add Rscript.exe's directory (typically C:\\Program Files\\R\\R-<version>\\bin) to your PATH."
                    : process.platform === "darwin"
                    ? "Install R, or ensure it is on PATH / in a standard location (/usr/local/bin, /opt/homebrew/bin, or /Library/Frameworks/R.framework/Resources/bin)."
                    : "Install R and ensure Rscript is on your PATH.";
            new Notice(`Render failed: Rscript not found. ${hint}`);
        } else {
            new Notice(`Render failed to start: ${err.message}`);
        }
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

/**
 * Resolve the Rscript executable path. On macOS, Obsidian inherits launchctl's
 * PATH which typically excludes /usr/local/bin and /opt/homebrew/bin where R is
 * installed. This helper probes common install locations and falls back to
 * "Rscript" (relying on PATH) when nothing is found — which works for Linux
 * and Windows where the R installer usually adds the binary to PATH.
 */
function resolveRscriptPath(): string {
    const candidates = [
        "/usr/local/bin/Rscript",
        "/opt/homebrew/bin/Rscript",
        "/Library/Frameworks/R.framework/Resources/bin/Rscript",
        "/usr/bin/Rscript",
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return p;
        } catch {
            // ignore and continue
        }
    }
    return "Rscript";
}

/**
 * Resolve the directory containing a pandoc binary. R's rmarkdown package reads
 * the RSTUDIO_PANDOC environment variable to locate pandoc when it isn't on PATH.
 * This is the same mechanism RStudio itself uses. We probe platform-specific
 * standalone installs first, then RStudio's bundled pandoc.
 */
function resolvePandocDir(): string | null {
    const isWindows = process.platform === "win32";
    const binaryName = isWindows ? "pandoc.exe" : "pandoc";

    const candidates = isWindows
        ? [
              // RStudio's bundled pandoc via Quarto (Windows 64-bit)
              "C:\\Program Files\\RStudio\\resources\\app\\quarto\\bin\\tools\\pandoc",
              "C:\\Program Files\\RStudio\\resources\\app\\quarto\\bin",
              "C:\\Program Files\\RStudio\\bin\\pandoc",
              // Standalone pandoc installer default location
              "C:\\Program Files\\Pandoc",
              // 32-bit fallback locations
              "C:\\Program Files (x86)\\RStudio\\bin\\pandoc",
              "C:\\Program Files (x86)\\Pandoc",
          ]
        : [
              "/usr/local/bin",
              "/opt/homebrew/bin",
              "/Applications/RStudio.app/Contents/Resources/app/quarto/bin/tools/aarch64",
              "/Applications/RStudio.app/Contents/Resources/app/quarto/bin/tools/x86_64",
              "/Applications/RStudio.app/Contents/MacOS",
              "/Applications/RStudio.app/Contents/Resources/app/bin",
          ];

    for (const dir of candidates) {
        try {
            if (fs.existsSync(path.join(dir, binaryName))) return dir;
        } catch {
            // ignore and continue
        }
    }
    return null;
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
        const rel = path.relative(root, parent);
        if (rel.startsWith("..") || path.isAbsolute(rel)) return null; // escaped the vault
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
