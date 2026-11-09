/**
 * Architecture check for Modules, layer imports, Feature UI values, and test
 * layout.
 *
 * Run via `pnpm check-hygiene:architecture`. Cruises `src` with the
 * dependency-cruiser config, then fails on Module cycles, on `AsyncResult`
 * values in Feature UI, and on test directories that mirror no `src` or
 * `playground` directory.
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { cruise, format } from "dependency-cruiser";

import { widgetRoot } from "../paths";
import { findAsyncResultValues } from "./async-result-in-ui";
import architectureConfiguration from "./dependency-cruiser.config.mts";
import { findModuleCycles, formatModuleCycles } from "./module-cycle-policy";
import { findMisplacedTestDirectories } from "./test-layout-policy";

const { options: configuredOptions = {}, ...ruleSet } =
  architectureConfiguration;
const cruiseOutput = await cruise(["src"], {
  ...configuredOptions,
  baseDir: widgetRoot,
  ruleSet,
  validate: true,
});

if (typeof cruiseOutput.output === "string") {
  throw new TypeError("dependency-cruiser returned text instead of its graph");
}

const dependencyReport = await format(cruiseOutput.output, {
  outputType: "err-long",
});

if (typeof dependencyReport.output === "string") {
  process.stdout.write(dependencyReport.output);
}

const moduleCycles = findModuleCycles(cruiseOutput.output);

if (moduleCycles.length > 0) {
  process.stderr.write(`${formatModuleCycles(moduleCycles)}\n`);
}

const featureUiFile = /^src\/features\/.+\/ui\//i;
const asyncResultValues = findAsyncResultValues(
  join(widgetRoot, "tsconfig.json"),
  (fileName) =>
    featureUiFile.test(relative(widgetRoot, fileName).split(sep).join("/"))
);

if (asyncResultValues.length > 0) {
  process.stderr.write(
    `Feature UI holds AsyncResult values; publish a plain value or a Presentable from state/ instead:\n${asyncResultValues
      .map(
        (use) =>
          `  ${relative(widgetRoot, use.file)}:${use.line}:${use.column} ${use.text}`
      )
      .join("\n")}\n`
  );
}

const listRelativePaths = (
  root: string,
  kind: "directories" | "files"
): ReadonlyArray<string> =>
  readdirSync(join(widgetRoot, root), { recursive: true, withFileTypes: true })
    .filter((entry) =>
      kind === "directories" ? entry.isDirectory() : entry.isFile()
    )
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(join(widgetRoot, root).length + 1)
        .split(sep)
        .join("/")
    );

// The playground is the dev page's host app outside `src`; its tests mirror
// it under `tests/playground`.
const misplacedTestDirectories = findMisplacedTestDirectories({
  sourceDirectories: new Set([
    ...listRelativePaths("src", "directories"),
    "playground",
    ...listRelativePaths("playground", "directories").map(
      (directory) => `playground/${directory}`
    ),
  ]),
  testFiles: listRelativePaths("tests", "files"),
});

if (misplacedTestDirectories.length > 0) {
  process.stderr.write(
    `Test directories must mirror a src or playground directory, or be a support directory:\n${misplacedTestDirectories
      .map((directory) => `  tests/${directory}`)
      .join("\n")}\n`
  );
}

if (
  dependencyReport.exitCode !== 0 ||
  asyncResultValues.length > 0 ||
  moduleCycles.length > 0 ||
  misplacedTestDirectories.length > 0
) {
  process.exitCode = 1;
}
