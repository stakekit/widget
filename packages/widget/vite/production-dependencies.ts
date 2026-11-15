import type { Plugin } from "vite";

// A dependency's separate development build: React's
// `cjs/react-dom-client.development.js`, or a package's `development` export
// condition such as react-router's `dist/development/`.
const developmentBuild =
  /[/\\](?:cjs[/\\][^/\\]+\.development\.js|dist[/\\]development[/\\])/;

// A `NODE_ENV` read the build left in place; dependencies without a separate
// development build, such as Base UI and Motion, branch on it inline.
const nodeEnvRead = /\benv\.NODE_ENV\b/;

/**
 * Fails a build that ships a dependency's development code.
 *
 * Library mode leaves `process.env.NODE_ENV` to the host, and the node
 * polyfills then route it to their `process` shim, whose `env` is empty: every
 * bundled dependency would take its development branch in production, React
 * included. `getConfig` defines `process.env.NODE_ENV`; this keeps it defined.
 */
export const productionDependenciesPlugin = (): Plugin => ({
  name: "production-dependencies",
  apply: "build",
  generateBundle(_, bundle) {
    const problems = Object.values(bundle).flatMap((output) => {
      if (output.type !== "chunk") return [];
      const developmentModules = Object.entries(output.modules)
        .filter(
          ([id, module]) =>
            developmentBuild.test(id) && module.renderedLength > 0
        )
        .map(([id]) => `${output.fileName}: bundles ${id}`);
      return nodeEnvRead.test(output.code)
        ? [...developmentModules, `${output.fileName}: reads env.NODE_ENV`]
        : developmentModules;
    });
    if (problems.length > 0) {
      this.error(`Development code was bundled:\n${problems.join("\n")}`);
    }
  },
});
