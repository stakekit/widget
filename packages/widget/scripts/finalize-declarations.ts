import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { resolveDeclarationImport } from "./declaration-graph.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const declarationRoot = join(scriptDirectory, "../dist/types");

const finalizedSpecifier = async (fromPath: string, specifier: string) => {
  if (!specifier.startsWith(".") || specifier.endsWith(".json")) {
    return { specifier } as const;
  }

  const resolved = await resolveDeclarationImport({
    declarationRoot,
    fromPath,
    specifier,
  });
  return {
    declaration: resolved.declarationPath,
    specifier: resolved.finalizedSpecifier,
  } as const;
};

const finalizeDeclaration = async (path: string) => {
  const sourceText = await readFile(path, "utf8");
  const imports = ts.preProcessFile(sourceText, true, true).importedFiles;
  const resolvedImports = await Promise.all(
    imports.map(async ({ end, fileName, pos }) => ({
      end,
      pos,
      resolved: await finalizedSpecifier(path, fileName),
    }))
  );
  const replacements = resolvedImports.map(({ end, pos, resolved }) => ({
    end: end + 1,
    pos: pos + 1,
    text: resolved.specifier,
  }));
  const finalized = replacements
    .toSorted((left, right) => right.pos - left.pos)
    .reduce(
      (text, replacement) =>
        `${text.slice(0, replacement.pos)}${replacement.text}${text.slice(
          replacement.end
        )}`,
      sourceText
    );

  if (finalized !== sourceText) await writeFile(path, finalized, "utf8");

  return resolvedImports.flatMap(({ resolved }) =>
    "declaration" in resolved && typeof resolved.declaration === "string"
      ? [resolved.declaration]
      : []
  );
};

const pending = [
  join(declarationRoot, "public-api/index.bundle.d.ts"),
  join(declarationRoot, "public-api/index.package.d.ts"),
];
const visited = new Set<string>();

while (pending.length > 0) {
  const path = pending.pop();
  if (!path || visited.has(path)) continue;
  visited.add(path);
  pending.push(...(await finalizeDeclaration(path)));
}

console.log("[declarations] Relative ESM references finalized");
