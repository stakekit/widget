import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSourceArchitectureViolations } from "./architecture-rules";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

const getSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return getSourceFiles(absolutePath);
      return sourceExtensions.has(path.extname(entry.name))
        ? [absolutePath]
        : [];
    })
  );

  return files.flat();
};

const checkArchitecture = async () => {
  const files = (
    await Promise.all(
      ["src", "tests"].map((directory) =>
        getSourceFiles(path.join(packageRoot, directory))
      )
    )
  ).flat();
  const violations = (
    await Promise.all(
      files.map(async (absolutePath) => {
        const file = path
          .relative(packageRoot, absolutePath)
          .split(path.sep)
          .join("/");
        if (file === "tests/architecture/boundary.test.ts") return [];
        const source = await readFile(absolutePath, "utf8");
        return getSourceArchitectureViolations(file, source);
      })
    )
  ).flat();

  if (violations.length > 0) {
    throw new Error(
      `Architecture boundary violations:\n${violations.join("\n")}`
    );
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  checkArchitecture().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
