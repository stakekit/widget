import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import type { KnipConfig } from "knip";

type IssueType = "exports" | "types";

type KnipSymbol = {
  readonly name: string;
  readonly line?: number;
  readonly col?: number;
};

type KnipFileIssues = {
  readonly file: string;
  readonly exports?: ReadonlyArray<KnipSymbol>;
  readonly types?: ReadonlyArray<KnipSymbol>;
};

type KnipReport = {
  readonly issues: ReadonlyArray<KnipFileIssues>;
};

type SymbolFinding = KnipSymbol & {
  readonly file: string;
  readonly issueType: IssueType;
};

const knipConfig = {
  ignoreExportsUsedInFile: true,
  workspaces: {
    "packages/widget": {
      entry: [
        "src/index.package.ts!",
        "src/index.bundle.ts!",
        "src/public-api/index.package.ts!",
        "src/public-api/index.bundle.ts!",
        "src/main.tsx!",
        "src/translation/i18next.d.ts!",
        "src/types/purify-extend.d.ts!",
        "src/types/window.d.ts!",
        "src/vite-env.d.ts!",
        "postcss.config.js!",
        "vite/*.ts!",
        "tests/utils/setup.browser.ts",
        "tests/utils/setup.dom.ts",
        "tests/**/*.test.ts",
        "tests/**/*.test.tsx",
        "scripts/*.test.ts",
        "scripts/prepare-canary-release.ts!",
        "scripts/generate-effect-openapi.ts!",
      ],
      project: [
        "src/**/*.{ts,tsx}!",
        "scripts/*.{ts,tsx}",
        "tests/**/*.{ts,tsx}",
        "vite/**/*.ts!",
      ],
      ignoreIssues: {
        "src/generated/api/legacy-schema.ts": ["exports", "types"],
        "src/types/yield-api-schema.d.ts": ["exports", "types"],
      },
    },
  },
} satisfies KnipConfig;

export default knipConfig;

const configOnlyEnvironmentVariable = "KNIP_TEST_ONLY_EXPORTS_CONFIG";
const scriptPath = resolve(process.argv[1] ?? "");
const repoRoot = resolve(dirname(scriptPath), "..");
const issueTypes = [
  "exports",
  "types",
] as const satisfies ReadonlyArray<IssueType>;
const baseArgs = [
  "--config",
  scriptPath,
  "--workspace",
  "@stakekit/widget",
  "--include",
  issueTypes.join(","),
  "--reporter",
  "json",
  "--no-progress",
  "--no-config-hints",
  "--no-exit-code",
];

const runKnip = ({
  production,
}: {
  readonly production: boolean;
}): KnipReport => {
  const result = spawnSync(
    "knip",
    production ? ["--production", ...baseArgs] : baseArgs,
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        [configOnlyEnvironmentVariable]: "1",
        NO_COLOR: "1",
      },
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr || `Knip exited with status ${result.status}`
    );
  }

  try {
    return JSON.parse(result.stdout) as KnipReport;
  } catch (error) {
    throw new Error(`Failed to parse Knip JSON output: ${result.stdout}`, {
      cause: error,
    });
  }
};

const collectSymbols = ({
  issues,
}: KnipReport): ReadonlyMap<string, SymbolFinding> => {
  const symbols = new Map<string, SymbolFinding>();

  for (const issue of issues) {
    for (const issueType of issueTypes) {
      for (const symbol of issue[issueType] ?? []) {
        const key = JSON.stringify([issue.file, issueType, symbol.name]);
        symbols.set(key, {
          ...symbol,
          file: issue.file,
          issueType,
        });
      }
    }
  }

  return symbols;
};

const main = () => {
  const productionSymbols = collectSymbols(runKnip({ production: true }));
  const allSymbols = collectSymbols(runKnip({ production: false }));
  const testOnlySymbols = [...productionSymbols]
    .filter(([key]) => !allSymbols.has(key))
    .map(([, symbol]) => symbol)
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.name.localeCompare(right.name)
    );

  if (testOnlySymbols.length === 0) {
    console.log("No test-only imports of otherwise unused runtime symbols.");
    return;
  }

  console.error(
    `Test-only imports of otherwise unused runtime symbols (${testOnlySymbols.length}):`
  );

  let currentFile: string | undefined;
  for (const symbol of testOnlySymbols) {
    if (symbol.file !== currentFile) {
      currentFile = symbol.file;
      console.error(`  ${currentFile}`);
    }

    const typeLabel = symbol.issueType === "types" ? " (type)" : "";
    const location = symbol.line ? `:${symbol.line}:${symbol.col ?? 1}` : "";
    console.error(`    - ${symbol.name}${typeLabel}${location}`);
  }

  process.exitCode = 1;
};

if (process.env[configOnlyEnvironmentVariable] !== "1") {
  main();
}
