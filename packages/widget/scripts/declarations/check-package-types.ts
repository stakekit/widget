/**
 * Type-checks the packed Widget from isolated consumer projects.
 *
 * Run via `pnpm check:package-types` after `build:types`. Source checks can
 * resolve unpublished files and undeclared dependencies from the workspace.
 * These consumers install only the tarball and their declared peer setup, so
 * resolution follows the package manifest and packed contents.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { widgetRoot } from "../paths";
import {
  declarationSpecifiers,
  resolveDeclarationImport,
} from "./declaration-graph.ts";

const fixtureRoot = join(widgetRoot, "tests/package-types");
const requireFromWidget = createRequire(import.meta.url);
const typescriptCli = requireFromWidget.resolve("typescript/lib/tsc.js");

type ModuleResolution = "Bundler" | "NodeNext";
type Consumer = {
  readonly allowedExternalTypes: ReadonlyArray<string>;
  readonly declarationEntry: string;
  readonly fixture: string;
  readonly label: string;
  readonly reactPeers: boolean;
};

const consumers = [
  {
    allowedExternalTypes: ["effect"],
    declarationEntry: "dist/types/public-api/index.bundle.d.ts",
    fixture: "bundle-consumer.ts",
    label: "standalone bundle",
    reactPeers: false,
  },
  {
    allowedExternalTypes: ["effect", "react"],
    declarationEntry: "dist/types/public-api/index.package.d.ts",
    fixture: "package-consumer.ts",
    label: "React package",
    reactPeers: true,
  },
] as const satisfies ReadonlyArray<Consumer>;

const moduleResolutions = ["Bundler", "NodeNext"] as const;

const packageNameFromSpecifier = (specifier: string) => {
  const firstSeparator = specifier.indexOf("/");
  if (!specifier.startsWith("@") || firstSeparator === -1) {
    return firstSeparator === -1
      ? specifier
      : specifier.slice(0, firstSeparator);
  }

  const secondSeparator = specifier.indexOf("/", firstSeparator + 1);
  return secondSeparator === -1
    ? specifier
    : specifier.slice(0, secondSeparator);
};

const checkDeclarationGraph = async (
  widgetDirectory: string,
  consumer: Consumer
) => {
  const declarationRoot = join(widgetDirectory, "dist/types");
  const pending = [join(widgetDirectory, consumer.declarationEntry)];
  const visited = new Set<string>();
  const externalTypes = new Set<string>();

  while (pending.length > 0) {
    const declarationPath = pending.pop();
    if (!declarationPath || visited.has(declarationPath)) continue;
    visited.add(declarationPath);

    const sourceText = await readFile(declarationPath, "utf8");
    for (const specifier of declarationSpecifiers(
      declarationPath,
      sourceText
    )) {
      if (specifier.startsWith(".")) {
        pending.push(
          (
            await resolveDeclarationImport({
              declarationRoot,
              fromPath: declarationPath,
              specifier,
            })
          ).declarationPath
        );
      } else {
        externalTypes.add(packageNameFromSpecifier(specifier));
      }
    }
  }

  const actual = [...externalTypes].sort();
  const expected = [...consumer.allowedExternalTypes].sort();
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(
      `${consumer.label} declarations reference [${actual.join(
        ", "
      )}], expected only [${expected.join(", ")}]`
    );
  }
};

const checkPackedManifest = async (
  widgetDirectory: string,
  consumer: Consumer
) => {
  const manifest = JSON.parse(
    await readFile(join(widgetDirectory, "package.json"), "utf8")
  ) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };

  for (const packageName of consumer.allowedExternalTypes) {
    const classification =
      packageName === "react" ? "peerDependencies" : "dependencies";
    if (!manifest[classification]?.[packageName]) {
      throw new Error(
        `${consumer.label} declarations require ${packageName}, but the packed ` +
          `manifest does not declare it in ${classification}`
      );
    }
  }
};

const run = async (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  options: { readonly quiet?: boolean } = {}
) => {
  console.log(`[package-types] ${label}`);
  console.log(`[package-types] $ ${command} ${args.join(" ")}`);

  const child = spawn(command, [...args], {
    cwd,
    env: process.env,
    stdio: options.quiet
      ? (["inherit", "ignore", "inherit"] as const)
      : "inherit",
  });
  const [code, signal] = await once(child, "exit");

  if (code !== 0) {
    throw new Error(
      `${label} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`
    );
  }
};

const packageManagerCommand = () => {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli) {
    return {
      argsPrefix: [pnpmCli],
      command: process.execPath,
    } as const;
  }

  return { argsPrefix: [], command: "pnpm" } as const;
};

const runPnpm = async (
  label: string,
  args: ReadonlyArray<string>,
  cwd: string,
  options?: { readonly quiet?: boolean }
) => {
  const { argsPrefix, command } = packageManagerCommand();
  await run(label, command, [...argsPrefix, ...args], cwd, options);
};

const findInstalledPackage = async (packageName: string) => {
  const linkedDirectory = join(
    widgetRoot,
    "node_modules",
    ...packageName.split("/")
  );
  try {
    const packageJson = JSON.parse(
      await readFile(join(linkedDirectory, "package.json"), "utf8")
    ) as { readonly name?: string; readonly version?: string };
    if (packageJson.name === packageName && packageJson.version) {
      return {
        directory: await realpath(linkedDirectory),
        version: packageJson.version,
      } as const;
    }
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  let currentDirectory = dirname(requireFromWidget.resolve(packageName));

  while (currentDirectory !== dirname(currentDirectory)) {
    const packageJsonPath = join(currentDirectory, "package.json");
    try {
      const packageJson = JSON.parse(
        await readFile(packageJsonPath, "utf8")
      ) as { readonly name?: string; readonly version?: string };
      if (packageJson.name === packageName && packageJson.version) {
        return {
          directory: currentDirectory,
          version: packageJson.version,
        } as const;
      }
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }

    currentDirectory = dirname(currentDirectory);
  }

  throw new Error(`Could not resolve the installed version of ${packageName}`);
};

const writeJson = async (path: string, value: unknown) => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeConsumerPackage = async (
  directory: string,
  tarballPath: string,
  reactPeers: boolean
) => {
  const dependencies: Record<string, string> = {
    "@stakekit/widget": `file:${tarballPath}`,
  };
  const devDependencies: Record<string, string> = {};

  if (reactPeers) {
    for (const packageName of ["react", "react-dom"] as const) {
      dependencies[packageName] = (
        await findInstalledPackage(packageName)
      ).version;
    }
    for (const packageName of ["@types/react", "@types/react-dom"] as const) {
      devDependencies[packageName] = (
        await findInstalledPackage(packageName)
      ).version;
    }
  }

  await writeJson(join(directory, "package.json"), {
    name: "@stakekit/package-types-consumer",
    private: true,
    type: "module",
    dependencies,
    ...(reactPeers ? { devDependencies } : {}),
  });
};

const writeTsConfig = async (
  directory: string,
  moduleResolution: ModuleResolution
) => {
  const module = moduleResolution === "NodeNext" ? "NodeNext" : "ESNext";
  const configPath = join(
    directory,
    `tsconfig.${moduleResolution.toLowerCase()}.json`
  );

  await writeJson(configPath, {
    compilerOptions: {
      exactOptionalPropertyTypes: true,
      lib: ["ES2022", "ESNext.Disposable", "DOM", "DOM.Iterable"],
      module,
      moduleResolution,
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: "ES2022",
      types: [],
      verbatimModuleSyntax: true,
    },
    files: ["./consumer.ts"],
  });

  return configPath;
};

const linkConsumerPeer = async (directory: string, packageName: string) => {
  const peer = await findInstalledPackage(packageName);
  const pathSegments = packageName.split("/");
  const peerPath = join(directory, "node_modules", ...pathSegments);
  await mkdir(dirname(peerPath), { recursive: true });
  await symlink(peer.directory, peerPath, "dir");
};

const installPackedWidget = async (
  directory: string,
  tarballPath: string,
  consumer: Consumer
) => {
  const widgetDirectory = join(directory, "node_modules/@stakekit/widget");
  await mkdir(widgetDirectory, { recursive: true });
  await run(
    "extract packed Widget",
    "tar",
    ["-xzf", tarballPath, "-C", widgetDirectory, "--strip-components", "1"],
    directory
  );
  await checkPackedManifest(widgetDirectory, consumer);

  for (const packageName of consumer.allowedExternalTypes) {
    if (packageName !== "react") {
      await linkConsumerPeer(widgetDirectory, packageName);
    }
  }

  if (consumer.reactPeers) {
    for (const packageName of [
      "react",
      "react-dom",
      "@types/react",
      "@types/react-dom",
    ] as const) {
      await linkConsumerPeer(directory, packageName);
    }
  }

  return widgetDirectory;
};

const checkConsumer = async (
  rootDirectory: string,
  tarballPath: string,
  consumer: Consumer
) => {
  const consumerDirectory = join(
    rootDirectory,
    consumer.reactPeers ? "package-consumer" : "bundle-consumer"
  );
  await mkdir(consumerDirectory, { recursive: true });
  await copyFile(
    join(fixtureRoot, consumer.fixture),
    join(consumerDirectory, "consumer.ts")
  );
  await writeConsumerPackage(
    consumerDirectory,
    tarballPath,
    consumer.reactPeers
  );
  const widgetDirectory = await installPackedWidget(
    consumerDirectory,
    tarballPath,
    consumer
  );
  await checkDeclarationGraph(widgetDirectory, consumer);

  for (const moduleResolution of moduleResolutions) {
    const configPath = await writeTsConfig(consumerDirectory, moduleResolution);
    await run(
      `type-check ${consumer.label} with ${moduleResolution} resolution`,
      process.execPath,
      [typescriptCli, "--project", configPath, "--pretty", "false"],
      consumerDirectory
    );
  }
};

const main = async () => {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "stakekit-package-types-")
  );
  const tarballPath = join(temporaryRoot, "stakekit-widget.tgz");

  try {
    await access(join(widgetRoot, "dist/types/public-api/index.package.d.ts"));
    await access(join(widgetRoot, "dist/types/public-api/index.bundle.d.ts"));
    await runPnpm("pack Widget", ["pack", "--out", tarballPath], widgetRoot, {
      quiet: true,
    });
    for (const consumer of consumers) {
      await checkConsumer(temporaryRoot, tarballPath, consumer);
    }

    console.log(
      "[package-types] Packed declarations resolve for every consumer"
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
};

await main();
