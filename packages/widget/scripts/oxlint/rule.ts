/**
 * Shared types, file scoping and AST helpers for the widget's oxlint plugins
 * (`design-system-plugin.ts`, `effect-plugin.ts`, `widget-plugin.ts`,
 * `layout-plugin.ts`).
 *
 * oxlint exports no plugin types, so they are derived from `RuleTester`.
 * Each rule carries its own file scope, so its tests pin where it applies.
 */
import path from "node:path";

import type { RuleTester } from "oxlint/plugins-dev";

export type Rule = Parameters<RuleTester["run"]>[1];
export type Visitor = ReturnType<NonNullable<Rule["create"]>>;
/** oxlint exports no ESTree node union; every node's `parent` is typed as it. */
export type Node = NonNullable<
  Parameters<NonNullable<Visitor["Identifier"]>>[0]["parent"]
>;

/** Globs relative to `packages/widget`. */
export type FileScope = Readonly<{
  files: ReadonlyArray<string>;
  ignores?: ReadonlyArray<string>;
}>;

const widgetMarker = "/packages/widget/";

/** The file's path inside `packages/widget` with `/` separators, if it is one. */
const widgetPath = (filename: string): string | undefined => {
  const normalized = filename.split(path.sep).join("/");
  const at = normalized.lastIndexOf(widgetMarker);
  return at === -1 ? undefined : normalized.slice(at + widgetMarker.length);
};

const matchesAny = (file: string, globs: ReadonlyArray<string>) =>
  globs.some((glob) => path.matchesGlob(file, glob));

const inScope = (filename: string, scope: FileScope): boolean => {
  const file = widgetPath(filename);
  return (
    file !== undefined &&
    matchesAny(file, scope.files) &&
    !matchesAny(file, scope.ignores ?? [])
  );
};

/** A rule that visits only files in `scope`. */
export const scopedRule = (
  scope: FileScope,
  create: NonNullable<Rule["create"]>
): Rule => ({
  create: (context) =>
    inScope(context.filename, scope) ? create(context) : {},
});

/** `src` TypeScript outside the generated API clients. */
export const sourceFiles: FileScope = {
  files: ["src/**/*.ts", "src/**/*.tsx"],
  ignores: ["src/generated/**"],
};

/** `src` and `tests` TypeScript outside generated code. */
export const sourceAndTestFiles: FileScope = {
  files: [...sourceFiles.files, "tests/**/*.ts", "tests/**/*.tsx"],
  ignores: ["src/generated/**", "tests/generated/**"],
};

/** `scope` without the files matching `ignores`. */
export const excluding = (
  scope: FileScope,
  ignores: ReadonlyArray<string>
): FileScope => ({
  files: scope.files,
  ignores: [...(scope.ignores ?? []), ...ignores],
});

/** The property name of a non-computed `object.name` member expression. */
export const memberName = (node: Node): string | undefined =>
  node.type === "MemberExpression" &&
  !node.computed &&
  node.property.type === "Identifier"
    ? node.property.name
    : undefined;

/** `object.name` with an identifier object, e.g. `"Effect.fail"`. */
export const memberPath = (node: Node): string | undefined => {
  if (node.type !== "MemberExpression" || node.object.type !== "Identifier") {
    return undefined;
  }
  const name = memberName(node);
  return name === undefined ? undefined : `${node.object.name}.${name}`;
};

/** Whether `node` is `object.name` for one of the dotted `paths`. */
export const isMemberPath = (
  node: Node,
  paths: Record<string, true>
): boolean => paths[memberPath(node) ?? ""] === true;

/** The nearest proper ancestor of `node` that `matches` accepts. */
export const findAncestor = (
  node: Node,
  matches: (ancestor: Node) => boolean
): Node | undefined => {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (matches(ancestor)) return ancestor;
  }
  return undefined;
};

/** Whether a proper ancestor of `node` is one `matches` accepts. */
export const hasAncestor = (
  node: Node,
  matches: (ancestor: Node) => boolean
): boolean => findAncestor(node, matches) !== undefined;
