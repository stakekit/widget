/**
 * Architecture check for owned Modules, layer imports, and test layout.
 *
 * Run via `pnpm check-hygiene:architecture`. Cruises `src` with the
 * dependency-cruiser config, then fails on owned-Module cycles that are not
 * listed in the baseline and on test directories that mirror no `src` owner.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { cruise, format } from "dependency-cruiser";
import { widgetRoot } from "../paths";
import architectureConfiguration, {
  architecturePolicy,
} from "./dependency-cruiser.config.mts";
import { moduleCycleBaseline } from "./module-cycle-baseline";
import {
  checkOwnedModuleCycles,
  formatModuleCycleCheck,
} from "./module-cycle-policy";
import { findMisplacedTestDirectories } from "./test-layout-policy";

const { options: configuredOptions = {}, ...ruleSet } =
  architectureConfiguration;
const cruiseOutput = await cruise(["src"], {
  ...configuredOptions,
  baseDir: widgetRoot,
  outputType: undefined,
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

const moduleCycleCheck = checkOwnedModuleCycles({
  baseline: moduleCycleBaseline,
  cruiseResult: cruiseOutput.output,
  policy: architecturePolicy,
});

const invalidModuleBaseline =
  moduleCycleCheck.staleBaseline.length > 0 ||
  moduleCycleCheck.unbaselinedEdges.length > 0;

if (invalidModuleBaseline) {
  process.stderr.write(`${formatModuleCycleCheck(moduleCycleCheck)}\n`);
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

const misplacedTestDirectories = findMisplacedTestDirectories({
  sourceDirectories: new Set(listRelativePaths("src", "directories")),
  testFiles: listRelativePaths("tests", "files"),
});

if (misplacedTestDirectories.length > 0) {
  process.stderr.write(
    `Test directories must mirror a src directory or be a support directory:\n${misplacedTestDirectories
      .map((directory) => `  tests/${directory}`)
      .join("\n")}\n`
  );
}

if (
  dependencyReport.exitCode !== 0 ||
  invalidModuleBaseline ||
  misplacedTestDirectories.length > 0
) {
  process.exitCode = 1;
}
