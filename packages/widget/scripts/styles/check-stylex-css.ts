/**
 * Fails when a build's stylesheets hold no StyleX rules.
 *
 * StyleX appends its rules to one stylesheet per build (`vite/stylex.ts`). If
 * it picked a file the page does not load up front, or emitted none, the
 * Design System would render unstyled while every source test still passed.
 * Checks:
 *
 * - the package stylesheet hosts import (`@stakekit/widget/style.css`);
 * - the bundle stylesheet CDN hosts link;
 * - the stylesheets the website's `index.html` links, when it was built.
 *
 * Run via `pnpm check:stylex-css` after the builds; part of `build`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { widgetRoot } from "../paths";
import { countStyleXRules } from "./stylex-rules";

type Manifest = {
  readonly exports: Readonly<Record<string, { readonly default?: string }>>;
};

const linkedStylesheet = /<link rel="stylesheet"[^>]*\bhref="\/([^"]+\.css)"/g;

const read = (path: string) => readFile(join(widgetRoot, path), "utf8");

const manifest: Manifest = JSON.parse(await read("package.json"));
const packageStylesheet = manifest.exports["./style.css"]?.default;

if (packageStylesheet === undefined) {
  throw new Error('package.json does not export "./style.css".');
}

// The website loads every stylesheet its index.html links; StyleX picks one.
const websiteStylesheets = await read("dist/website/index.html").then(
  (html) =>
    [...html.matchAll(linkedStylesheet)].flatMap(([, href]) =>
      href === undefined ? [] : [`dist/website/${href}`]
    ),
  () => undefined
);

const builds = [
  { name: "package", stylesheets: [packageStylesheet] },
  { name: "bundle", stylesheets: ["dist/bundle/index.bundle.css"] },
  ...(websiteStylesheets
    ? [{ name: "website", stylesheets: websiteStylesheets }]
    : []),
];

for (const { name, stylesheets } of builds) {
  const sources = await Promise.all(stylesheets.map(read));
  const rules = sources.map(countStyleXRules).reduce((a, b) => a + b, 0);
  const files = stylesheets.join(", ") || "none";

  if (rules === 0) {
    console.error(`No StyleX rules in the ${name} stylesheets: ${files}.`);
    process.exitCode = 1;
  } else {
    console.log(`${rules} StyleX rules in the ${name} stylesheets: ${files}.`);
  }
}
