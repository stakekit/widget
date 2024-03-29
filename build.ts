import { vanillaExtractPlugin } from "@vanilla-extract/esbuild-plugin";
import autoprefixer from "autoprefixer";
import * as esbuild from "esbuild";
import postcss from "postcss";
import dotenv from "dotenv";
import fs from "node:fs";
import macros from "unplugin-parcel-macros";

const isWatching = process.argv.includes("--watch");

dotenv.config({ path: ".env.production.local" });

const VITE_API_URL = process.env.VITE_API_URL ?? "https://api.stakek.it/";
const MODE = process.env.MODE ?? "";

const commonPlugins: esbuild.Plugin[] = [
  vanillaExtractPlugin({
    outputCss: true,
    processCss: async (css) => {
      const result = await postcss([autoprefixer]).process(css, {
        from: undefined, // suppress source map warning
      });

      return result.css;
    },
  }),
  macros.esbuild(),
];

const commonConfig: Parameters<(typeof esbuild)["build"]>[0] = {
  treeShaking: true,
  sourcemap: true,
  format: "esm",
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(VITE_API_URL),
    "import.meta.env.MODE": JSON.stringify(MODE),
  },
  bundle: true,
  alias: {
    stream: "stream-browserify",
  },
  logLevel: "info",
};

const standaloneAppConfig: Parameters<(typeof esbuild)["build"]>[0] = {
  ...commonConfig,
  target: "es2021",
  entryPoints: ["src/index.bundle.ts"],
  outdir: "dist/package/bundle",
  minify: true,
  external: ["crypto"],
  platform: "browser",
  plugins: commonPlugins,
  loader: {
    ".png": "dataurl",
  },
};

const packageConfig: Parameters<(typeof esbuild)["build"]>[0] = {
  ...commonConfig,
  banner: {
    js: '"use client";',
  },
  entryPoints: ["src/index.package.ts", "src/polyfills.ts"],
  assetNames: "bundle/assets/[name]",
  splitting: true,
  outdir: "dist/package",
  platform: "browser",
  plugins: [
    ...commonPlugins,
    {
      name: "make-all-packages-external",
      setup(build) {
        // Must not start with "/" or "./" or "../"
        build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (args) =>
          // needs to be inlined because it causes issue for nextjs page router
          /\.css$/.test(args.path) ||
          args.path === "@cassiozen/usestatemachine" ||
          args.path === "cosmjs-types/cosmos/tx/v1beta1/tx" ||
          args.path.startsWith("@stakekit") ||
          args.path.startsWith("@bitget-wallet") ||
          args.path.startsWith("@ledgerhq") ||
          args.path.startsWith("@tronweb3") ||
          args.path.startsWith("@cosmos-kit/walletconnect")
            ? { external: false }
            : { external: true, path: args.path }
        );

        build.onLoad({ filter: /\.css$/ }, async (args) => {
          const css = await fs.promises.readFile(args.path, {
            encoding: "utf-8",
          });

          return { contents: css, loader: "css" };
        });
      },
    },
  ],
  loader: {
    ".png": "dataurl",
  },
};

const buildAsStandaloneApp = () => esbuild.build(standaloneAppConfig);

const buildAsPackage = async () => {
  return isWatching
    ? (await esbuild.context(packageConfig)).watch()
    : esbuild.build(packageConfig);
};

const main = async () => {
  await buildAsStandaloneApp();
  await buildAsPackage();
};

main();
