/**
 * Test layout policy: every test lives under a directory that mirrors the
 * `src` owner of its subject, or under a fixed support directory.
 *
 * Paths are POSIX-style and relative to `tests` (test files) or `src`
 * (source directories).
 */
import { posix } from "node:path";

const supportDirectories = [
  "app/journeys",
  "fixtures",
  "generated",
  "mocks",
  "package-types",
  "scripts",
  "utils",
] as const;

const testFilePattern = /\.test\.tsx?$/;

export const isTestFile = (path: string): boolean => testFilePattern.test(path);

const isSupportDirectory = (directory: string): boolean =>
  supportDirectories.some(
    (support) => directory === support || directory.startsWith(`${support}/`)
  );

/**
 * Returns the sorted, unique test directories that contain test files but
 * neither belong to a support directory nor mirror a `src` directory. Test
 * files directly under `tests` are reported as `.`.
 */
export const findMisplacedTestDirectories = ({
  sourceDirectories,
  testFiles,
}: {
  readonly sourceDirectories: ReadonlySet<string>;
  readonly testFiles: ReadonlyArray<string>;
}): ReadonlyArray<string> => {
  const misplaced = new Set<string>();

  for (const testFile of testFiles) {
    if (!isTestFile(testFile)) continue;
    const directory = posix.dirname(testFile);
    if (directory === ".") {
      misplaced.add(directory);
      continue;
    }
    if (isSupportDirectory(directory) || sourceDirectories.has(directory)) {
      continue;
    }
    misplaced.add(directory);
  }

  return [...misplaced].sort();
};
