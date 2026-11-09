/**
 * Finds `AsyncResult` values in Feature UI by type, not by import: a hook can
 * hand UI an `AsyncResult` without UI importing its module, which oxlint's
 * `no-async-result-in-feature-ui` cannot see. Feature `state/` publishes plain
 * values or view states (a `Presentable`) instead.
 *
 * Oxlint gives JS plugins no type information, so this asks the native
 * TypeScript 7 checker (`@typescript/native`) directly: one batched type query
 * over every identifier in Feature UI. Used by `check-architecture.ts`.
 */
import { join } from "node:path";

import { SyntaxKind, type Node } from "@typescript/native/unstable/ast";
import { isTypeNode } from "@typescript/native/unstable/ast/is";
import { API, type Type } from "@typescript/native/unstable/sync";

export type AsyncResultUse = Readonly<{
  file: string;
  line: number;
  column: number;
  text: string;
}>;

// Declaration paths come back case-folded on case-insensitive file systems.
const asyncResultModule = /\/reactivity\/asyncresult\.(?:d\.)?ts$/i;

const isAsyncResult = (type: Type): boolean =>
  [
    type.getAliasSymbol(),
    ...(type.isUnionType()
      ? type.getTypes().map((member) => member.getSymbol())
      : [type.getSymbol()]),
  ].some((symbol) =>
    symbol?.declarations.some((declaration) =>
      asyncResultModule.test(declaration.path)
    )
  );

/**
 * Every line of a file matching `isUiFile` in the project `tsconfigPath` names
 * that holds an `AsyncResult` value.
 */
export const findAsyncResultValues = (
  tsconfigPath: string,
  isUiFile: (fileName: string) => boolean
): ReadonlyArray<AsyncResultUse> => {
  const api = new API({ cwd: join(tsconfigPath, "..") });
  try {
    const project = api
      .updateSnapshot({ openProjects: [tsconfigPath] })
      .getProject(tsconfigPath);
    if (!project) throw new Error(`${tsconfigPath} has no project`);

    const identifiers = project.program
      .getSourceFileNames()
      .filter(isUiFile)
      .flatMap((fileName) => {
        const sourceFile = project.program.getSourceFile(fileName);
        const found: Node[] = [];
        const visit = (node: Node): void => {
          if (
            isTypeNode(node) ||
            node.kind === SyntaxKind.ImportDeclaration ||
            node.kind === SyntaxKind.ExportDeclaration
          ) {
            return;
          }
          if (node.kind === SyntaxKind.Identifier) found.push(node);
          node.forEachChild(visit);
        };
        sourceFile?.forEachChild(visit);
        return found;
      });

    const types = project.checker.getTypeAtLocation(identifiers);
    const reported = new Set<string>();
    return identifiers.flatMap((identifier, index) => {
      const type = types[index];
      if (!type || !isAsyncResult(type)) return [];
      const sourceFile = identifier.getSourceFile();
      const start = identifier.getStart(sourceFile);
      const { character, line } =
        sourceFile.getLineAndCharacterOfPosition(start);
      const key = `${sourceFile.fileName}:${line}`;
      if (reported.has(key)) return [];
      reported.add(key);
      return [
        {
          column: character + 1,
          file: sourceFile.fileName,
          line: line + 1,
          text: sourceFile.text.slice(start, identifier.end),
        },
      ];
    });
  } finally {
    api.close();
  }
};
