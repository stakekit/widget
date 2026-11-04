/**
 * Design System migration allowlist check.
 *
 * Run via `pnpm check:design-system-allowlist` (part of `lint`). Finds every
 * file that breaks a Design System rule with no allowlist applied, using the
 * ast-grep rules and the dependency-cruiser configuration, then fails on an
 * offender `design-system-allowlist.ts` does not list and on a listed file
 * that no longer offends. It also fails on an entry (file and rule) that the
 * allowlist at the merge base with `main` does not have, so the list only
 * shrinks, and when an ast-grep rule's `ignores` do not mirror the allowlist;
 * `--write` rewrites those mirrors from it.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { cruise } from "dependency-cruiser";
import { parseDocument } from "yaml";
import { repositoryRoot, widgetRoot } from "../paths";
import { makeArchitectureConfiguration } from "./dependency-cruiser.config.mts";
import {
  type DesignSystemAllowlist,
  designSystemAllowlist,
  designSystemRuleIds,
} from "./design-system-allowlist";

const write = process.argv.includes("--write");
const widgetPrefix = "packages/widget/";
const ruleDirectory = join(repositoryRoot, "tools/ast-grep/rules");
const yamlOptions = { lineWidth: 0 };

const problems: string[] = [];
const offenders = new Map<string, Set<string>>();
const allowlistedFiles = new Map<string, string[]>();
const allowlistEntries = Object.entries(designSystemAllowlist).sort(
  ([left], [right]) => (left < right ? -1 : 1)
);
for (const [file, rules] of allowlistEntries) {
  if (rules.length === 0) {
    problems.push(`${file}: an allowlist entry names at least one rule.`);
  }
  for (const rule of rules) {
    allowlistedFiles.set(rule, [...(allowlistedFiles.get(rule) ?? []), file]);
  }
}
const addOffender = (rule: string, file: string) => {
  const files = offenders.get(rule) ?? new Set<string>();
  files.add(file);
  offenders.set(rule, files);
};

// ast-grep: glob `ignores` scope a rule; exact paths mirror the allowlist.
const inlineRules = designSystemRuleIds.astGrep.map((rule) => {
  const path = join(ruleDirectory, `${rule}.yml`);
  const document = parseDocument(readFileSync(path, "utf8"));
  const { ignores = [] }: { ignores?: ReadonlyArray<string> } = document.toJS();
  const scopeIgnores = ignores.filter((entry) => entry.includes("*"));
  const mirrored = ignores
    .filter((entry) => !entry.includes("*"))
    .map((entry) => entry.slice(widgetPrefix.length));
  const allowlisted = allowlistedFiles.get(rule) ?? [];

  const setIgnores = (entries: ReadonlyArray<string>) => {
    if (entries.length === 0) document.delete("ignores");
    else document.set("ignores", [...entries]);
  };

  const mirrorMatches =
    mirrored.length === allowlisted.length &&
    mirrored.every((entry, index) => entry === allowlisted[index]);
  if (!mirrorMatches) {
    if (write) {
      setIgnores([
        ...scopeIgnores,
        ...allowlisted.map((file) => `${widgetPrefix}${file}`),
      ]);
      writeFileSync(path, document.toString(yamlOptions));
    } else {
      problems.push(
        `tools/ast-grep/rules/${rule}.yml: its ignores do not mirror the allowlist; run this check with --write.`
      );
    }
  }

  setIgnores(scopeIgnores);
  return document.toString(yamlOptions);
});

const scan = spawnSync(
  join(repositoryRoot, "node_modules/.bin/ast-grep"),
  [
    "scan",
    "--json=stream",
    "--inline-rules",
    inlineRules.join("---\n"),
    `${widgetPrefix}src`,
  ],
  { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
);
if (scan.error !== undefined || (scan.status !== 0 && scan.status !== 1)) {
  throw new Error(`ast-grep scan failed: ${scan.error ?? scan.stderr}`);
}
for (const line of scan.stdout.split("\n")) {
  if (line.trim() === "") continue;
  const match: { ruleId: string; file: string } = JSON.parse(line);
  addOffender(match.ruleId, match.file.slice(widgetPrefix.length));
}

// dependency-cruiser: cruise only the Design System rules, with nothing allowlisted.
const { options = {}, forbidden = [] } = makeArchitectureConfiguration({});
const dependencyRules: ReadonlySet<string> = new Set(
  designSystemRuleIds.dependencyCruiser
);
const cruiseOutput = await cruise(["src"], {
  ...options,
  baseDir: widgetRoot,
  ruleSet: {
    forbidden: forbidden.filter(
      (rule) => rule.name !== undefined && dependencyRules.has(rule.name)
    ),
  },
  validate: true,
});
if (typeof cruiseOutput.output === "string") {
  throw new TypeError("dependency-cruiser returned text instead of its graph");
}
for (const violation of cruiseOutput.output.summary.violations) {
  addOffender(violation.rule.name, violation.from);
}

// Shrink-only: every entry must already be on the allowlist at the merge base
// with `main`, so a newly offending file cannot be allowlisted.
const allowlistPath = `${widgetPrefix}scripts/architecture/design-system-allowlist.ts`;
const git = (args: ReadonlyArray<string>) =>
  spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
const mergeBase = ["origin/main", "main"]
  .map((ref) => git(["merge-base", "HEAD", ref]))
  .find((result) => result.error === undefined && result.status === 0)
  ?.stdout.trim();
if (mergeBase === undefined) {
  process.stdout.write(
    "Design System migration allowlist: skipping the shrink-only check; git or a `main` branch to take the merge base with is unavailable.\n"
  );
} else {
  const baseSource = git(["show", `${mergeBase}:${allowlistPath}`]);
  if (baseSource.status !== 0) {
    process.stdout.write(
      `Design System migration allowlist: skipping the shrink-only check; the merge base ${mergeBase.slice(0, 12)} has no allowlist.\n`
    );
  } else {
    const directory = mkdtempSync(join(tmpdir(), "design-system-allowlist-"));
    // `.mts`: outside the package, a `.ts` file would load as CommonJS.
    const basePath = join(directory, "design-system-allowlist.mts");
    writeFileSync(basePath, baseSource.stdout);
    // Dynamic: the module is the merge base's copy, written out at run time.
    const baseModule: { designSystemAllowlist: DesignSystemAllowlist } =
      await import(pathToFileURL(basePath).href);
    rmSync(directory, { recursive: true });
    for (const [file, rules] of allowlistEntries) {
      const baseRules = new Set(baseModule.designSystemAllowlist[file] ?? []);
      for (const rule of rules.filter((entry) => !baseRules.has(entry))) {
        problems.push(
          `${rule}: ${file} is not on the allowlist at the merge base ${mergeBase.slice(0, 12)}; the allowlist only shrinks. Compose or extend the Design System instead (docs/design-system.md).`
        );
      }
    }
  }
}

for (const rule of [
  ...designSystemRuleIds.astGrep,
  ...designSystemRuleIds.dependencyCruiser,
]) {
  const offending = offenders.get(rule) ?? new Set<string>();
  const allowlisted = new Set(allowlistedFiles.get(rule));
  const unlisted = [...offending].filter((file) => !allowlisted.has(file));
  const stale = [...allowlisted].filter((file) => !offending.has(file));
  for (const file of unlisted.sort()) {
    problems.push(
      `${rule}: ${file} breaks the rule. Compose or extend the Design System instead (docs/design-system.md); the allowlist only shrinks.`
    );
  }
  for (const file of stale.sort()) {
    problems.push(
      `${rule}: ${file} no longer breaks the rule; delete its allowlist entry.`
    );
  }
}

if (problems.length > 0) {
  process.stderr.write(
    `Design System migration allowlist (scripts/architecture/design-system-allowlist.ts):\n${problems
      .map((problem) => `  ${problem}`)
      .join("\n")}\n`
  );
  process.exitCode = 1;
}
