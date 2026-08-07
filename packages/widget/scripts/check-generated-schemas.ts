import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUnsafeGeneratedSchemaUnions } from "./generated-schema-safety";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const widgetRoot = path.resolve(scriptDir, "..");
const generatedSchemaFiles = [
  "src/generated/api/borrow.ts",
  "src/generated/api/legacy-schema.ts",
  "src/generated/api/yield-schema.ts",
];

const diagnostics = (
  await Promise.all(
    generatedSchemaFiles.map(async (relativePath) => {
      const absolutePath = path.join(widgetRoot, relativePath);
      const sourceText = await readFile(absolutePath, "utf8");
      return findUnsafeGeneratedSchemaUnions(sourceText, relativePath).map(
        (issue) =>
          `${relativePath}:${issue.line}:${issue.column} ${issue.message}`
      );
    })
  )
).flat();

if (diagnostics.length > 0) {
  throw new Error(
    `Generated schema safety check failed:\n${diagnostics.join("\n")}`
  );
}
