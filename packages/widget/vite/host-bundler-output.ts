import type { Plugin } from "vite";

// A comment body cannot contain `*/`, so a match never spans past its comment.
const comments = String.raw`(?:\/\*(?:[^*]|\*(?!\/))*\*\/\s*)*`;

// `import(` with any leading comments, then a quoted `node:` specifier. Template
// literals count only without substitutions: those are constant for bundlers.
const nodeBuiltinImport = new RegExp(
  String.raw`(\bimport\(\s*${comments})(["'\`])(node:[\w./-]+)\2(?=\s*\))`,
  "g"
);

// Vite's worker plugin wraps the built asset URL as
// `new URL(/* @vite-ignore */ <url>, "" + import.meta.url)`; with
// `chunkRelativeAssetUrls`, <url> is itself `new URL("…", import.meta.url).href`.
const wrappedWorkerUrl = new RegExp(
  String.raw`new URL\(\s*${comments}(new URL\(\s*(["'\`])[^"'\`]+\2\s*,\s*import\.meta\.url\s*\))\.href\s*,\s*(?:""|''|\`\`)\s*\+\s*import\.meta\.url\s*\)`,
  "g"
);

/**
 * Turns string-literal `import("node:…")` calls into non-literal specifiers.
 *
 * Dependencies such as Zama's tfhe loader keep Node-only branches behind
 * `@vite-ignore`, `webpackIgnore` and `turbopackIgnore` comments. esbuild, which
 * Angular uses, ignores those comments and fails to resolve any literal
 * specifier, while it leaves a non-literal one to run time. The comments stay
 * for the bundlers that read them, and Node still loads the builtin.
 */
export const hideNodeBuiltinImports = (code: string): string =>
  code.replace(
    nodeBuiltinImport,
    (_, prefix: string, quote: string, specifier: string) =>
      `${prefix}[${quote}${specifier}${quote}][0]`
  );

/**
 * Collapses Vite's wrapped worker URLs into `new URL("…", import.meta.url)`.
 *
 * Turbopack rejects `new Worker(new URL(<expression>, …))` with "Module not
 * found: Can't resolve <dynamic>"; with a literal it copies the worker like
 * webpack and Vite do. The URL resolves to the same file either way.
 */
const collapseWorkerUrls = (code: string): string =>
  code.replace(wrappedWorkerUrl, "$1");

/**
 * Rewrites emitted chunks so host bundlers can consume `dist`. It runs in
 * `generateBundle`, after minification, because the minifier folds a constant
 * `node:` specifier back into a literal.
 */
export const hostBundlerOutputPlugin = (): Plugin => ({
  name: "host-bundler-output",
  apply: "build",
  generateBundle(_, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk") {
        output.code = collapseWorkerUrls(hideNodeBuiltinImports(output.code));
      }
    }
  },
});
