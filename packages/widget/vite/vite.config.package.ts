import path from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import { chunkRelativeAssetUrls, getConfig } from "./vite.config.base.ts";

// These packages coordinate work with the embedding application. Bundling a
// private copy separates React's cleanup queue. Base UI is deliberately
// absent: the Widget bundles its own copy, and its popups coexist with host
// dialogs through the portal container inside the Widget root
// (tests/app/journeys/overlays-in-host-dialogs).
const sharedDependencies = ["scheduler"];

const config = getConfig({
  experimental: chunkRelativeAssetUrls,
  define: {
    // Drop dead AMD branches from bundled UMD dependencies so Next Turbopack
    // does not resolve their dependency arrays as real relative imports.
    define: "undefined",
  },
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, "..", "src/index.package.ts"),
      name: "StakeKit",
      fileName: "index.package",
      formats: ["es"],
    },
    rolldownOptions: {
      output: {
        banner: '"use client";\n',
        // Keep @cosmos-kit with its circular helpers in one chunk. Splitting that
        // graph leaves `State` as an uninitialized live binding after a host
        // re-bundles dist/package.
        codeSplitting: {
          groups: [
            {
              name: "cosmos-kit",
              test: /[/\\]node_modules[/\\]@cosmos-kit[/\\]/,
            },
          ],
        },
      },
      plugins: [
        esmExternalRequirePlugin({
          // Keep React and ReactDOM external for the host. Bundle
          // `react/compiler-runtime`: it is CommonJS, and hosts that exclude this
          // package from optimizeDeps otherwise fail to prebundle that subpath.
          external: [
            /^react(-dom)?(?!\/compiler-runtime)(\/.+)?$/,
            ...sharedDependencies.map((name) => new RegExp(`^${name}(/.*)?$`)),
          ],
        }),
        {
          name: "check-shared-dependencies",
          generateBundle() {
            const paths = [...this.getModuleIds()].map((id) =>
              id.replaceAll("\\", "/")
            );
            const bundled = paths.find((path) =>
              sharedDependencies.some((name) =>
                path.includes(`/node_modules/${name}/`)
              )
            );
            if (bundled) {
              this.error(`Shared dependency was bundled: ${bundled}`);
            }
            // Worker bundles reuse these plugins; only the package entry
            // renders Design System popups.
            const isPackageEntry = paths.some((path) =>
              path.endsWith("/src/index.package.ts")
            );
            if (
              isPackageEntry &&
              !paths.some((path) =>
                path.includes("/node_modules/@base-ui/react/")
              )
            ) {
              this.error("Base UI must be bundled into the package output.");
            }
          },
        },
      ],
    },
    copyPublicDir: false,
    minify: false,
    outDir: "dist/package",
    sourcemap: false,
  },
});

export default defineConfig(config);
