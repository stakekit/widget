/**
 * Fails when the translation files drift: English and French must hold the
 * same keys with the same placeholders, each Utila overlay key must exist in
 * its language, and every key must be read somewhere in `src`. Knip cannot see
 * JSON keys, so dead copy would otherwise linger and keep being translated.
 *
 * Run via `pnpm check-hygiene:translations`; part of `check-hygiene`.
 */

import { glob, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { widgetRoot } from "../paths";
import {
  findParityIssues,
  findUnusedKeys,
  translationLeaves,
} from "./translation-rules";

const translationDirectory = "src/services/translation";

const readLeaves = async (path: string) =>
  translationLeaves(
    JSON.parse(
      await readFile(join(widgetRoot, translationDirectory, path), "utf8")
    )
  );

const english = await readLeaves("English/translations.json");
const french = await readLeaves("French/translations.json");
const overlays = [
  ["English/utila-variant.json", english],
  ["French/utila-variant.json", french],
] as const;

const sourceFiles = (
  await Array.fromAsync(glob("src/**/*.{ts,tsx}", { cwd: widgetRoot }))
).filter(
  (file) =>
    !file.startsWith(translationDirectory) && !file.startsWith("src/generated/")
);
const source = (
  await Promise.all(
    sourceFiles.map((file) => readFile(join(widgetRoot, file), "utf8"))
  )
).join("\n");

const issues = [
  ...findParityIssues(english, french),
  ...(
    await Promise.all(
      overlays.map(async ([path, base]) =>
        [...(await readLeaves(path)).keys()]
          .filter((key) => !base.has(key))
          .map((key) => `${path} overrides ${key}, which does not exist`)
      )
    )
  ).flat(),
  ...findUnusedKeys(english.keys(), source).map(
    (key) => `${key} is not read anywhere in src`
  ),
];

if (issues.length > 0) {
  process.exitCode = 1;
  console.error(
    [
      `${relative(process.cwd(), join(widgetRoot, translationDirectory))}: ${issues.length} issues`,
      ...issues.map((issue) => `  ${issue}`),
    ].join("\n")
  );
} else {
  console.log(`translations: ${english.size} keys, English and French agree`);
}
