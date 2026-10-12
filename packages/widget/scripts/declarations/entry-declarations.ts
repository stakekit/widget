/**
 * Transpiles a package entry into its published declaration.
 *
 * `src/index.package.ts` and `src/index.bundle.ts` are both the runtime entries
 * and the public contract. Each is transpiled on its own under
 * `isolatedDeclarations`, so implementation imports used only as initializers
 * drop out and the declaration can reference nothing but `src/public-api`,
 * which `tsconfig.build.json` emits next to it.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import { widgetRoot } from "../paths";
import { declarationSpecifiers } from "./declaration-graph.ts";

export const packageEntries = ["index.package", "index.bundle"] as const;

type PackageEntry = (typeof packageEntries)[number];

export type EntryDeclaration = Readonly<{
  /** Exports that would need implementation types to be stated. */
  diagnostics: ReadonlyArray<string>;
  /** Names the entry exports, so a removal is visible to hosts' reviewers. */
  exportedNames: ReadonlyArray<string>;
  /** Relative modules outside `src/public-api` the declaration would ship. */
  implementationImports: ReadonlyArray<string>;
  outputText: string;
  /** Types used in published signatures that hosts cannot import by name. */
  unexportedSignatureTypes: ReadonlyArray<string>;
  /** `export *` clauses, which hide what the entry publishes. */
  wildcardExports: ReadonlyArray<string>;
}>;

export const transpileEntryDeclaration = async (
  entry: PackageEntry
): Promise<EntryDeclaration> => {
  const sourcePath = join(widgetRoot, "src", `${entry}.ts`);
  const { diagnostics = [], outputText } = ts.transpileDeclaration(
    await readFile(sourcePath, "utf8"),
    {
      compilerOptions: { declaration: true, isolatedDeclarations: true },
      fileName: sourcePath,
      reportDiagnostics: true,
    }
  );
  const declaration = ts.createSourceFile(
    `${entry}.d.ts`,
    outputText,
    ts.ScriptTarget.ESNext
  );
  const exportedNames = new Set<string>();
  const signatureTypes = new Set<string>();
  const wildcardExports: string[] = [];

  for (const statement of declaration.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exportedNames.add(element.name.text);
        }
      } else {
        wildcardExports.push(statement.getText(declaration));
      }
    } else if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      for (const variable of statement.declarationList.declarations) {
        exportedNames.add(variable.name.getText(declaration));
      }
    } else if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("./public-api/") &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        signatureTypes.add(element.name.text);
      }
    }
  }

  return {
    diagnostics: diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    ),
    exportedNames: [...exportedNames].sort(),
    implementationImports: [
      ...declarationSpecifiers(`${entry}.d.ts`, outputText),
    ].filter(
      (specifier) =>
        specifier.startsWith(".") && !specifier.startsWith("./public-api/")
    ),
    outputText,
    unexportedSignatureTypes: [...signatureTypes].filter(
      (name) => !exportedNames.has(name)
    ),
    wildcardExports,
  };
};
