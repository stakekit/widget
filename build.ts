import { vanillaExtractPlugin } from "@vanilla-extract/esbuild-plugin";
import autoprefixer from "autoprefixer";
import * as esbuild from "esbuild";
import * as babel from "@babel/core";
import postcss from "postcss";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

dotenv.config({ path: ".env.production.local" });

const VITE_API_URL = process.env.VITE_API_URL;
const MODE = process.env.MODE;

if (!VITE_API_URL) {
  throw new Error("Missing required environment variable: VITE_API_URL");
}

const commonPlugins: esbuild.Plugin[] = [
  vanillaExtractPlugin({
    outputCss: true,
    processCss: async (css) => {
      const result = await postcss([autoprefixer]).process(css, {
        from: undefined, // suppress source map warning
      });

      return result.css;
    },
  }) as esbuild.Plugin,
  {
    name: "chain-registry-transform",
    setup(build) {
      build.onResolve({ filter: /^\.\/.*chain-registry/ }, (args) => {
        return {
          path: path.resolve(args.resolveDir, `${args.path}.ts`),
          namespace: "chain-registry",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "chain-registry" },
        async (args) => {
          console.log("onLoad: ", args.path);
          const code = await fs.promises.readFile(args.path, "utf8");

          const result = await babel.transformAsync(code, {
            filename: "chain-registry.ts",
            plugins: [
              require.resolve("@babel/plugin-syntax-jsx"),
              [
                require.resolve("@babel/plugin-syntax-typescript"),
                { isTSX: false },
              ],
              require.resolve("babel-plugin-macros"),
            ],
            babelrc: false,
            configFile: false,
            sourceMaps: true,
          });

          if (!result?.code) {
            throw new Error("Failed to transform chain-registry.ts");
          }

          return {
            contents: result.code,
            loader: "ts",
          };
        }
      );
    },
  },
];

const commonConfig: Parameters<(typeof esbuild)["build"]>[0] = {
  treeShaking: true,
  sourcemap: true,
  format: "esm",
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(VITE_API_URL ?? ""),
    "import.meta.env.VITE_API_KEY": '""', // api key will be provided by library users
    "import.meta.env.MODE": JSON.stringify(MODE ?? ""),
  },
  alias: {
    stream: "stream-browserify",
  },
};

const buildAsStandaloneApp = async () => {
  await esbuild.build({
    ...commonConfig,
    target: "es2021",
    entryPoints: ["src/index.bundle.ts"],
    outdir: "dist/package/bundle",
    assetNames: "assets/[name]",
    minify: true,
    external: ["crypto"],
    platform: "browser",
    bundle: true,
    plugins: commonPlugins,
    loader: {
      ".png": "file",
    },
  });
};

const buildAsPackage = async () => {
  await esbuild.build({
    ...commonConfig,
    entryPoints: ["src/index.package.ts", "src/polyfills.ts"],
    assetNames: "bundle/assets/[name]",
    splitting: true,
    outdir: "dist/package",
    platform: "browser",
    bundle: true,
    plugins: [
      ...commonPlugins,
      {
        name: "make-all-packages-external",
        setup(build) {
          // Must not start with "/" or "./" or "../"
          build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (args) => ({
            external: true,
            path: args.path,
          }));
        },
      },
    ],
    loader: {
      ".png": "dataurl",
    },
  });
};

const main = async () => {
  await buildAsStandaloneApp();
  await buildAsPackage();
};

main();
