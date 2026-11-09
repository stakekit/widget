import path from "node:path";
import stylex from "@stylexjs/unplugin";
import type { Plugin } from "vite";

/**
 * How compiled StyleX rules reach the page.
 *
 * - `stylesheet`: builds append them to the stylesheet the entry loads up
 *   front, and the dev server serves them from its StyleX CSS endpoint.
 * - `runtime`: every module inserts its own rules when it is evaluated. Tests
 *   use it, because their pages never load the dev server's HTML shell and its
 *   CSS endpoint only answers what was compiled before the page asked.
 */
export type StyleXInjection = "stylesheet" | "runtime";

/**
 * The stylesheets a page loads up front: the entry chunks' own and those of
 * the chunks they import statically. StyleX appends its rules to an
 * `index-*.css`, else a `style-*.css`, else the bundle's first stylesheet;
 * that could be a lazy chunk's, so the Widget would render unstyled until the
 * chunk loaded. The package and bundle builds emit one stylesheet, which this
 * leaves as StyleX's only choice. `record` runs before StyleX's
 * `generateBundle`, which asks `includes` about each stylesheet.
 */
const eagerCss = () => {
  const files = new Set<string>();
  const record: Plugin = {
    name: "record-eager-css",
    apply: "build",
    generateBundle: {
      order: "pre",
      handler(_options, bundle) {
        files.clear();
        // A Set visits what is added while it is iterated, once each.
        const chunks = new Set(
          Object.values(bundle).flatMap((output) =>
            output.type === "chunk" && output.isEntry ? [output.fileName] : []
          )
        );
        for (const fileName of chunks) {
          const output = bundle[fileName];
          if (output?.type !== "chunk") continue;
          for (const css of output.viteMetadata?.importedCss ?? []) {
            files.add(css);
          }
          for (const imported of output.imports) chunks.add(imported);
        }
      },
    },
  };

  return { record, includes: (fileName: string) => files.has(fileName) };
};

/**
 * Compiles StyleX. Must precede the React plugin, which keeps Fast Refresh
 * working. The class prefix keeps the Widget's atomic classes apart from a
 * StyleX host's. CSS layers stay off: layered rules would lose to any
 * unlayered host rule, while unlayered StyleX raises its higher-priority rules
 * to ID-level specificity.
 */
export const stylexPlugins = ({
  command,
  injection,
}: {
  readonly command: "build" | "serve";
  readonly injection: StyleXInjection;
}): ReadonlyArray<Plugin> => {
  const stylesheets = eagerCss();
  const compiler: Plugin = stylex.vite({
    classNamePrefix: "sk",
    useCSSLayers: false,
    // Hashes of variables and themes derive from file paths relative to
    // this root, so every build and test project names them alike.
    unstable_moduleResolution: {
      type: "commonJS",
      rootDir: path.resolve(import.meta.dirname, ".."),
    },
    // In dev, CSS is re-collected while modules are still being
    // transformed. A snapshot taken before a `*.stylex.ts` module compiled
    // holds an unresolved value that lightningcss cannot parse; skip such
    // rules until the next collection. Builds compile every module first,
    // so they stay strict.
    lightningcssOptions: { errorRecovery: command === "serve" },
    cssInjectionTarget: stylesheets.includes,
    ...(injection === "runtime" && {
      runtimeInjection: true,
      // No HTML shell to inject the dev stylesheet into.
      devMode: "css-only" as const,
    }),
  });

  // In tests the dev CSS endpoint is unused, and its update poll, which only
  // stops when an HTTP server closes, kept test runs from exiting.
  const { configureServer: _devCssEndpoint, ...testCompiler } = compiler;

  return [
    stylesheets.record,
    injection === "runtime" ? testCompiler : compiler,
  ];
};
