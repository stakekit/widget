import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { hideNodeBuiltinImports } from "../../vite/node-builtin-imports";

// The shapes Zama's tfhe loader takes after Vite builds it: minified string
// literals and unminified template literals, behind bundler ignore comments.
const nodeOnlyLoaders = `
export const loadPath = async () => (await import(
  /* @vite-ignore */
  /* webpackIgnore: true */
  /* turbopackIgnore: true */
  "node:path"
)).join("a", "b");
export const loadUrl = async () => (await import(
  /* @vite-ignore */
  \`node:url\`
)).pathToFileURL("/x").href;
`;

// Angular production builds minify while bundling.
const bundleForBrowser = (contents: string, minify: boolean) =>
  build({
    bundle: true,
    format: "esm",
    logLevel: "silent",
    minify,
    platform: "browser",
    stdin: { contents, loader: "js" },
    write: false,
  }).then(
    () => [],
    (error: { errors: ReadonlyArray<{ text: string }> }) =>
      error.errors.map(({ text }) => text)
  );

describe("hideNodeBuiltinImports", () => {
  it.each([false, true])(
    "lets esbuild bundle Node-only dynamic imports for the browser (minify: %s)",
    async (minify) => {
      expect(await bundleForBrowser(nodeOnlyLoaders, minify)).toEqual([
        'Could not resolve "node:path"',
        'Could not resolve "node:url"',
      ]);

      expect(
        await bundleForBrowser(hideNodeBuiltinImports(nodeOnlyLoaders), minify)
      ).toEqual([]);
    }
  );

  it("keeps the builtins loadable in Node", async () => {
    const directory = await mkdtemp(join(tmpdir(), "node-builtin-imports-"));
    try {
      const file = join(directory, "loaders.mjs");
      await writeFile(file, hideNodeBuiltinImports(nodeOnlyLoaders));
      // The module is generated at runtime, so it cannot be imported statically.
      const loaders = await import(pathToFileURL(file).href);

      expect(await loaders.loadPath()).toBe(join("a", "b"));
      expect(await loaders.loadUrl()).toBe("file:///x");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("leaves other dynamic imports resolvable by the host", () => {
    const code = 'const load = () => import("./chunk-a.js");';

    expect(hideNodeBuiltinImports(code)).toBe(code);
  });
});
