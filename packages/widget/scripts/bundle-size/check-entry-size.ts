/**
 * Fails when an entry's initial JavaScript download outgrows its budget.
 *
 * A host downloads the entry and every chunk it imports statically before the
 * Widget runs. The wallet SDKs (Cardano, cosmos-kit, Tron, …) stay out of
 * that only because the Widget loads them through `import()`; one static
 * import pulls megabytes into every host. This check measures the gzip size
 * of that closure from each build's manifest.
 *
 * Budgets sit a few percent above the measured size, so they catch a new
 * eager dependency rather than ordinary growth. When an increase is
 * intended, raise the budget in the same change and say why.
 *
 * Run via `pnpm check:bundle-size` after `build:package` and `build:bundle`;
 * part of `build`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { widgetRoot } from "../paths";
import { type BuildManifest, entryLoadFiles } from "./entry-load";

// Measured on 2026-11-09: package 2.91 MB, bundle 1.87 MB (gzip). The package
// entry already imports the cosmos-kit chunk (0.61 MB) statically.
const budgets = [
  {
    name: "package",
    directory: "dist/package",
    entry: "src/index.package.ts",
    maxGzipBytes: 3_000_000,
  },
  {
    name: "bundle",
    directory: "dist/bundle",
    entry: "src/index.bundle.ts",
    maxGzipBytes: 1_930_000,
  },
] as const;

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(2)} MB`;

for (const { name, directory, entry, maxGzipBytes } of budgets) {
  const read = (file: string) => readFile(join(widgetRoot, directory, file));
  const manifest: BuildManifest = JSON.parse(
    (await read(".vite/manifest.json")).toString("utf8")
  );
  const files = [...entryLoadFiles(manifest, entry)];
  const sizes = await Promise.all(
    files.map(async (file) => gzipSync(await read(file)).byteLength)
  );
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const summary = `${name}: ${files.length} files, ${megabytes(total)} gzip (budget ${megabytes(maxGzipBytes)})`;

  if (total > maxGzipBytes) {
    process.exitCode = 1;
    const largest = files
      .map((file, index) => ({ file, size: sizes[index] ?? 0 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .map(({ file, size }) => `  ${megabytes(size)}  ${file}`);
    console.error(
      [`${summary} is over budget. Largest files:`, ...largest].join("\n")
    );
  } else {
    console.log(summary);
  }
}
