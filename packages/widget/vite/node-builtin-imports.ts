import type { Plugin } from "vite";

// `import(` with any leading comments, then a quoted `node:` specifier. Template
// literals count only without substitutions: those are constant for bundlers.
// A comment body cannot contain `*/`, so a match never spans past its comment.
const nodeBuiltinImport =
  /(\bimport\(\s*(?:\/\*(?:[^*]|\*(?!\/))*\*\/\s*)*)(["'`])(node:[\w./-]+)\2(?=\s*\))/g;

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
 * Applies {@link hideNodeBuiltinImports} to the emitted chunks. It runs in
 * `generateBundle`, after minification, because the minifier folds a constant
 * specifier back into a literal.
 */
export const nodeBuiltinImportsPlugin = (): Plugin => ({
  name: "hide-node-builtin-imports",
  apply: "build",
  generateBundle(_, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk") {
        output.code = hideNodeBuiltinImports(output.code);
      }
    }
  },
});
