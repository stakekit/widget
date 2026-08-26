/**
 * Walks `.d.ts` specifiers and resolves relative declaration imports.
 *
 * Used by `finalize-declarations.ts` (`build:types`) and
 * `check-package-types.ts`.
 */
import { access } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";

const readablePath = async (candidates: ReadonlyArray<string>) => {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }
  }

  return undefined;
};

const assertInsideDeclarationRoot = (
  declarationRoot: string,
  declarationPath: string,
  specifier: string
) => {
  const relativePath = relative(declarationRoot, declarationPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(
      `Declaration import ${specifier} escapes ${declarationRoot}`
    );
  }
};

const explicitDeclarationPath = (importPath: string, extension: string) => {
  if (extension === "mjs") return importPath.replace(/\.mjs$/u, ".d.mts");
  if (extension === "cjs") return importPath.replace(/\.cjs$/u, ".d.cts");
  return importPath.replace(/\.js$/u, ".d.ts");
};

export const resolveDeclarationImport = async ({
  declarationRoot,
  fromPath,
  specifier,
}: {
  readonly declarationRoot: string;
  readonly fromPath: string;
  readonly specifier: string;
}) => {
  const importPath = resolve(dirname(fromPath), specifier);
  const explicitRuntimeExtension = specifier.match(/\.(cjs|mjs|js)$/u)?.[1];
  const candidates = explicitRuntimeExtension
    ? [
        {
          declarationPath: explicitDeclarationPath(
            importPath,
            explicitRuntimeExtension
          ),
          finalizedSpecifier: specifier,
        },
      ]
    : [
        {
          declarationPath: `${importPath}.d.ts`,
          finalizedSpecifier: `${specifier}.js`,
        },
        {
          declarationPath: `${importPath}.d.mts`,
          finalizedSpecifier: `${specifier}.mjs`,
        },
        {
          declarationPath: `${importPath}.d.cts`,
          finalizedSpecifier: `${specifier}.cjs`,
        },
        {
          declarationPath: join(importPath, "index.d.ts"),
          finalizedSpecifier: `${specifier}/index.js`,
        },
      ];
  const declarationPath = await readablePath(
    candidates.map((candidate) => candidate.declarationPath)
  );
  if (!declarationPath) {
    throw new Error(
      `Declaration import ${specifier} from ${relative(
        declarationRoot,
        fromPath
      )} is missing`
    );
  }

  assertInsideDeclarationRoot(declarationRoot, declarationPath, specifier);
  const candidate = candidates.find(
    (value) => value.declarationPath === declarationPath
  );
  if (!candidate) throw new Error(`Unresolved declaration ${declarationPath}`);

  return candidate;
};

export const declarationSpecifiers = (path: string, sourceText: string) => {
  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const specifiers = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.add(node.argument.literal.text);
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.add(node.moduleReference.expression.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  for (const reference of source.typeReferenceDirectives) {
    specifiers.add(reference.fileName);
  }

  return specifiers;
};
