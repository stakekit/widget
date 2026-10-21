/**
 * Checks that an esbuild host can resolve every import in the built Widget.
 *
 * Angular's application builder and dev server bundle with esbuild, which
 * resolves every string-literal `import()` at build time and ignores the
 * bundler-ignore comments that `vite/node-builtin-imports.ts` explains.
 * `test:smoke` builds a real Angular host but needs an API key and runs
 * separately; this check runs in every `build` and covers module resolution
 * under esbuild for the browser, not Angular's other build options.
 *
 * Bundles both entries plus the scripts emitted under `assets/`, such as the
 * Zama encrypt worker. Run via `pnpm check:host-bundlers` after
 * `build:package` and `build:bundle`.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { build, type Message } from "esbuild";
import { widgetRoot } from "../paths";

type Manifest = {
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
};

const entries = [
  { directory: "dist/package", entry: "index.package.js" },
  { directory: "dist/bundle", entry: "index.bundle.js" },
] as const;

const assetScripts = async (directory: string) => {
  const assets = join(widgetRoot, directory, "assets");
  const files = await readdir(assets);
  return files
    .filter((file) => file.endsWith(".js"))
    .map((file) => join(assets, file));
};

const isBuildFailure = (
  error: unknown
): error is { readonly errors: ReadonlyArray<Message> } =>
  error instanceof Error && "errors" in error && Array.isArray(error.errors);

const formatMessage = (message: Message) => {
  const location = message.location
    ? `${relative(widgetRoot, message.location.file)}:${message.location.line}: `
    : "";
  return `  ${location}${message.text}`;
};

const manifest: Manifest = JSON.parse(
  await readFile(join(widgetRoot, "package.json"), "utf8")
);
// The host installs these, so they stay external like in a real host build.
const external = Object.keys({
  ...manifest.dependencies,
  ...manifest.peerDependencies,
}).flatMap((name) => [name, `${name}/*`]);

const failures: Array<string> = [];

for (const { directory, entry } of entries) {
  const entryPoints = [
    join(widgetRoot, directory, entry),
    ...(await assetScripts(directory)),
  ];
  const errors = await build({
    absWorkingDir: widgetRoot,
    bundle: true,
    entryPoints,
    external,
    format: "esm",
    loader: { ".css": "empty", ".wasm": "file" },
    logLevel: "silent",
    outdir: join(widgetRoot, "node_modules/.esbuild-host-check"),
    platform: "browser",
    splitting: true,
    write: false,
  }).then(
    (result) => result.errors,
    (error: unknown) => {
      if (isBuildFailure(error)) return error.errors;
      throw error;
    }
  );

  if (errors.length > 0) {
    failures.push(
      `${directory}/${entry} (${entryPoints.length} entry points):`,
      ...errors.map(formatMessage)
    );
  }
}

if (failures.length > 0) {
  console.error(
    [
      "esbuild could not bundle the built Widget for the browser.",
      "Angular and other esbuild hosts would fail the same way.",
      ...failures,
    ].join("\n")
  );
  process.exitCode = 1;
} else {
  console.log(
    `esbuild bundled ${entries.map(({ entry }) => entry).join(" and ")} for the browser.`
  );
}
