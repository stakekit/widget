import { cruise, format } from "dependency-cruiser";
import architectureConfiguration, {
  architecturePolicy,
} from "./dependency-cruiser.config.mts";
import { moduleCycleBaseline } from "./module-cycle-baseline";
import {
  checkOwnedModuleCycles,
  formatModuleCycleCheck,
} from "./module-cycle-policy";

const { options: configuredOptions = {}, ...ruleSet } =
  architectureConfiguration;
const cruiseOutput = await cruise(["src"], {
  ...configuredOptions,
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

if (dependencyReport.exitCode !== 0 || invalidModuleBaseline) {
  process.exitCode = 1;
}
