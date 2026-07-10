const generatedImportAllowlist = [
  "src/borrow/domain/",
  "src/domain/schema/",
  "src/providers/api/api-client.ts",
  "tests/generated/",
] as const;

const tanStackImportAllowlist = new Set([
  "src/providers/query-client/index.tsx",
]);

const isGeneratedImportAllowed = (file: string) =>
  generatedImportAllowlist.some((entry) =>
    entry.endsWith("/") ? file.startsWith(entry) : file === entry
  );

const importPattern =
  /(?:from\s+|import\s*\()\s*["'](?<specifier>[^"']+)["']/gu;

export const getSourceArchitectureViolations = (
  file: string,
  source: string
): ReadonlyArray<string> => {
  const violations: string[] = [];

  for (const match of source.matchAll(importPattern)) {
    const specifier = match.groups?.specifier;
    if (!specifier) continue;

    if (
      specifier.includes("generated/api") &&
      !isGeneratedImportAllowed(file)
    ) {
      violations.push(
        `${file}: generated API import '${specifier}' is outside the approved transport/domain-schema boundary`
      );
    }

    if (
      specifier === "@tanstack/react-query" &&
      !tanStackImportAllowlist.has(file)
    ) {
      violations.push(
        `${file}: TanStack Query may only provide third-party Wagmi/RainbowKit infrastructure`
      );
    }
  }

  return violations;
};
