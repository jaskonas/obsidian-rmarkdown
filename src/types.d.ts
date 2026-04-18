// Minimal electron type declaration for the `shell` API we use. Obsidian's
// desktop runtime provides the real implementation and esbuild marks
// `electron` as an external, so this declaration only exists to satisfy
// TypeScript without pulling in all of @types/electron.
declare module "electron" {
    export const shell: {
        openPath(path: string): Promise<string>;
        showItemInFolder(fullPath: string): void;
    };
}
