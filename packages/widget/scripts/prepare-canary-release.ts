import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const runNumberPattern = /^[1-9]\d*$/;
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type StableVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
};

type DeriveCanaryVersionOptions = {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly runNumber: string;
};

type PrepareCanaryReleaseOptions = Omit<
  DeriveCanaryVersionOptions,
  "currentVersion"
> & {
  readonly packageDir: string;
  readonly githubOutput: string;
};

type PackageJson = Record<string, unknown> & {
  readonly version?: unknown;
};

const parseStableVersion = (version: string, label: string): StableVersion => {
  const match = stableVersionPattern.exec(version);

  if (!match) {
    throw new Error(
      `${label} must be a stable semantic version, got ${version}`
    );
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const formatVersion = ({ major, minor, patch }: StableVersion) =>
  `${major}.${minor}.${patch}`;

export const deriveCanaryVersion = ({
  currentVersion,
  latestVersion,
  runNumber,
}: DeriveCanaryVersionOptions): string => {
  const current = parseStableVersion(currentVersion, "Package version");
  const latest = parseStableVersion(latestVersion, "npm latest version");

  if (formatVersion(current) !== formatVersion(latest)) {
    throw new Error(
      `Selected branch has ${currentVersion}, but npm latest is ${latestVersion}. ` +
        "Rebase or update the branch before publishing a canary."
    );
  }

  if (!runNumberPattern.test(runNumber)) {
    throw new Error(
      `GitHub run number must be a positive integer, got ${runNumber}`
    );
  }

  const target = { ...current, patch: current.patch + 1 };

  return `${formatVersion(target)}-canary.${runNumber}`;
};

export const prepareCanaryRelease = ({
  packageDir,
  latestVersion,
  runNumber,
  githubOutput,
}: PrepareCanaryReleaseOptions): string => {
  const packageJsonPath = resolve(packageDir, "package.json");
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  ) as PackageJson;
  const currentVersion = packageJson.version;

  if (typeof currentVersion !== "string") {
    throw new Error(`${packageJsonPath} does not contain a string version`);
  }

  const version = deriveCanaryVersion({
    currentVersion,
    latestVersion,
    runNumber,
  });

  const updatedPackageJson = { ...packageJson, version };
  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(updatedPackageJson, null, 2)}\n`
  );
  appendFileSync(
    githubOutput,
    `base_version=${currentVersion}\nversion=${version}\n`
  );

  return version;
};

const main = () => {
  const latestVersion = process.env.LATEST_VERSION;
  const runNumber = process.env.GITHUB_RUN_NUMBER;
  const githubOutput = process.env.GITHUB_OUTPUT;

  if (!latestVersion || !runNumber || !githubOutput) {
    throw new Error(
      "LATEST_VERSION, GITHUB_RUN_NUMBER, and GITHUB_OUTPUT are required"
    );
  }

  const version = prepareCanaryRelease({
    packageDir,
    latestVersion,
    runNumber,
    githubOutput,
  });

  console.log(`Prepared canary version ${version}`);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
