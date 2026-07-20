import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import ts from "typescript";

type ArchitectureBaseline = {
  readonly path: string;
  readonly reason: string;
  readonly sha256: string;
};

const reviewedExternalReactBoundaries: ReadonlyArray<ArchitectureBaseline> = [
  {
    path: "src/app/embedding/widget-instance-react-boundary.tsx",
    reason:
      "A callback ref must acquire the document claim at the actual React-owned DOM mount boundary.",
    sha256: "5783a0d268f9b3b2b30f7cf217222c770a509aedfb203e4c009ab0bb130993b2",
  },
];

const classicFlowViewPath =
  /(?:^|\/)src\/features\/transaction-flow\/(?:react|ui)\//;
const classicFlowSourcePath =
  /(?:^|\/)src\/features\/transaction-flow\/.*\.(?:ts|tsx)$/;

export const checkFlowSessionArchitecture = (
  sources: ReadonlyArray<{
    readonly content: string;
    readonly path: string;
  }>
): ReadonlyArray<string> => {
  const failures: string[] = [];

  for (const source of sources) {
    const normalizedPath = source.path.replaceAll("\\", "/");
    const forbiddenTerms = [
      "ClassicTransactionFlowIdentity",
      "ClassicTransactionFlowWorkflowHandoff",
      "flowIdentity",
    ];

    for (const term of forbiddenTerms) {
      if (source.content.includes(term)) {
        failures.push(
          `${normalizedPath} reintroduces removed Classic Flow coordination term ${term}.`
        );
      }
    }

    if (/phase\s*:\s*["'](?:Reviewing|Executable)["']/.test(source.content)) {
      failures.push(
        `${normalizedPath} reintroduces stored Reviewing/Executable phase state.`
      );
    }

    if (
      source.content.includes("Atom.keepAlive") &&
      !normalizedPath.endsWith("/state/classic-flow-session-store.ts")
    ) {
      failures.push(
        `${normalizedPath} keeps Classic Flow state alive outside the intake store.`
      );
    }
  }

  return failures;
};

const isPromiseLike = (checker: ts.TypeChecker, type: ts.Type): boolean => {
  if (type.isUnion()) {
    return type.types.some((member) => isPromiseLike(checker, member));
  }

  const then = checker.getPropertyOfType(type, "then");
  const declaration = then?.valueDeclaration ?? then?.declarations?.[0];
  if (!then || !declaration) return false;

  const thenType = checker.getTypeOfSymbolAtLocation(then, declaration);
  return (
    checker.getSignaturesOfType(thenType, ts.SignatureKind.Call).length > 0
  );
};

const isPromiseReturning = (
  checker: ts.TypeChecker,
  node: ts.Expression
): boolean =>
  checker
    .getSignaturesOfType(checker.getTypeAtLocation(node), ts.SignatureKind.Call)
    .some((signature) =>
      isPromiseLike(checker, checker.getReturnTypeOfSignature(signature))
    );

const getImportDeclaration = (
  node: ts.Node
): ts.ImportDeclaration | undefined => {
  let current: ts.Node | undefined = node;
  while (current && !ts.isImportDeclaration(current)) {
    current = current.parent;
  }
  return current;
};

const isReactRouterUseNavigate = (
  checker: ts.TypeChecker,
  expression: ts.Expression
): boolean => {
  if (!ts.isIdentifier(expression)) return false;

  const symbol = checker.getSymbolAtLocation(expression);
  return (
    symbol?.declarations?.some((declaration) => {
      if (!ts.isImportSpecifier(declaration)) return false;

      const importedName = declaration.propertyName ?? declaration.name;
      const importDeclaration = getImportDeclaration(declaration);
      return (
        importedName.text === "useNavigate" &&
        importDeclaration !== undefined &&
        ts.isStringLiteral(importDeclaration.moduleSpecifier) &&
        ["react-router", "react-router-dom"].includes(
          importDeclaration.moduleSpecifier.text
        )
      );
    }) ?? false
  );
};

const isRouterNavigateBinding = (
  checker: ts.TypeChecker,
  expression: ts.Expression
): boolean => {
  if (!ts.isIdentifier(expression)) return false;

  const symbol = checker.getSymbolAtLocation(expression);
  return (
    symbol?.declarations?.some(
      (declaration) =>
        ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
        declaration.initializer !== undefined &&
        ts.isCallExpression(declaration.initializer) &&
        isReactRouterUseNavigate(checker, declaration.initializer.expression)
    ) ?? false
  );
};

const isRouterNavigation = (
  checker: ts.TypeChecker,
  expression: ts.Expression
): boolean =>
  ts.isCallExpression(expression) &&
  isRouterNavigateBinding(checker, expression.expression);

const isRouterNavigationHandler = (
  checker: ts.TypeChecker,
  expression: ts.Expression
): boolean =>
  isRouterNavigateBinding(checker, expression) ||
  ((ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) &&
    ts.isExpression(expression.body) &&
    isRouterNavigation(checker, expression.body));

type FunctionWithBody =
  | ts.ArrowFunction
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.MethodDeclaration;

const isFunctionWithBody = (node: ts.Node): node is FunctionWithBody =>
  ts.isArrowFunction(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isMethodDeclaration(node);

const containsOwnedPromiseCall = (
  checker: ts.TypeChecker,
  node: FunctionWithBody
): boolean => {
  let found = false;

  const visit = (child: ts.Node): void => {
    if (found || isFunctionWithBody(child)) return;

    if (
      ts.isCallExpression(child) &&
      !isRouterNavigation(checker, child) &&
      isPromiseLike(checker, checker.getTypeAtLocation(child))
    ) {
      found = true;
      return;
    }

    ts.forEachChild(child, visit);
  };

  ts.forEachChild(node, visit);
  return found;
};

const getLocation = (sourceFile: ts.SourceFile, node: ts.Node): string => {
  const { character, line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );
  return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
};

export const checkPromiseOwnership = (
  program: ts.Program,
  includeSourceFile: (sourceFile: ts.SourceFile) => boolean = (sourceFile) =>
    classicFlowViewPath.test(sourceFile.fileName)
): ReadonlyArray<string> => {
  const checker = program.getTypeChecker();
  const failures: string[] = [];

  const visit = (sourceFile: ts.SourceFile, node: ts.Node): void => {
    if (
      isFunctionWithBody(node) &&
      node.body !== undefined &&
      !(
        (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
        isRouterNavigationHandler(checker, node)
      ) &&
      !containsOwnedPromiseCall(checker, node)
    ) {
      const signature = checker.getSignatureFromDeclaration(node);
      if (
        signature &&
        isPromiseLike(checker, checker.getReturnTypeOfSignature(signature))
      ) {
        failures.push(
          `${getLocation(sourceFile, node)} declares a Promise-returning function in a Classic Flow view.`
        );
      }
    }

    if (
      ts.isCallExpression(node) &&
      !isRouterNavigation(checker, node) &&
      isPromiseLike(checker, checker.getTypeAtLocation(node))
    ) {
      failures.push(
        `${getLocation(sourceFile, node)} starts Promise-returning work in a Classic Flow view.`
      );
    }

    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      !isRouterNavigationHandler(checker, node.initializer.expression) &&
      isPromiseReturning(checker, node.initializer.expression)
    ) {
      failures.push(
        `${getLocation(sourceFile, node)} passes a Promise-returning JSX handler in a Classic Flow view.`
      );
    }

    if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && /^on[A-Z]/.test(node.name.text)) ||
        (ts.isStringLiteral(node.name) && /^on[A-Z]/.test(node.name.text))) &&
      !isRouterNavigationHandler(checker, node.initializer) &&
      isPromiseReturning(checker, node.initializer)
    ) {
      failures.push(
        `${getLocation(sourceFile, node)} publishes a Promise-returning event handler in a Classic Flow view.`
      );
    }

    ts.forEachChild(node, (child) => visit(sourceFile, child));
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !includeSourceFile(sourceFile)) {
      continue;
    }
    visit(sourceFile, sourceFile);
  }

  return failures;
};

const sha256 = (content: string) =>
  createHash("sha256").update(content).digest("hex");

const verifyBaseline = async ({
  path,
  reason,
  sha256: expected,
}: ArchitectureBaseline): Promise<string | null> => {
  const actual = sha256(await readFile(path, "utf8"));
  if (actual === expected) return null;

  return [
    `${path} changed after its architecture review.`,
    reason,
    "Remove the legacy exception or re-review the named external boundary; do not refresh this hash as a routine update.",
  ].join(" ");
};

const main = async () => {
  const failures = (
    await Promise.all(reviewedExternalReactBoundaries.map(verifyBaseline))
  ).filter((failure): failure is string => failure !== null);

  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  if (config.error) {
    failures.push(
      "Could not read tsconfig.json for Classic Flow architecture lint."
    );
  } else {
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
    const viewFiles = parsed.fileNames.filter((fileName) =>
      classicFlowViewPath.test(fileName.replaceAll("\\", "/"))
    );
    const program = ts.createProgram(viewFiles, parsed.options);
    failures.push(...checkPromiseOwnership(program));
    const flowSessionSources = await Promise.all(
      parsed.fileNames
        .filter((fileName) =>
          classicFlowSourcePath.test(fileName.replaceAll("\\", "/"))
        )
        .map(async (path) => ({ content: await readFile(path, "utf8"), path }))
    );
    failures.push(...checkFlowSessionArchitecture(flowSessionSources));
  }

  if (failures.length === 0) return;

  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
