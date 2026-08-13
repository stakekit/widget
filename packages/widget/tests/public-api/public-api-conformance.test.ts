import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

/**
 * The published package declares its surface twice.
 *
 * `src/public-api/index.package.ts` and `src/public-api/index.bundle.ts` are the
 * contract: `tsconfig.build.json` compiles `src/public-api` on its own and ships
 * the result as `dist/types`, which is where `package.json` points `types`.
 * `src/index.package.ts` and `src/index.bundle.ts` are the Vite library entries
 * that produce the shipped JavaScript.
 *
 * Hosts therefore take their types from one file and their runtime from another,
 * and nothing else in the repo relates the two. These assertions are that
 * missing relation:
 *
 * - `describe("declared value exports")` uses the type system, so `tsc` — and
 *   therefore `pnpm lint` — rejects a value the contract promises but the
 *   runtime entry does not ship, or ships with an incompatible type.
 * - `describe.each(entryPairs)` reads the entry files as source, because a
 *   type-only export is invisible to `keyof` and to assignability. It is the
 *   only thing here that can see a `SKTxMeta` that exists on one side only.
 * - `describe("contract is import-closed")` protects the reason the contract has
 *   to stay `declare`-only: `tsconfig.build.json` sets `rootDir` to
 *   `src/public-api`, so a single import reaching outside that directory breaks
 *   `build:types`.
 */

type PackageContract = typeof import("../../src/public-api/index.package.ts");
type PackageRuntime = typeof import("../../src/index.package.ts");
type BundleContract = typeof import("../../src/public-api/index.bundle.ts");
type BundleRuntime = typeof import("../../src/index.bundle.ts");
type PublicSKAppProps = import("../../src/public-api/types").SKAppProps;

type ClassicExternalProviderProps = {
  readonly apiKey: string;
  readonly externalProviders: {
    readonly currentAddress: string;
    readonly provider: {
      readonly sendTransaction: (
        tx: import("../../src/public-api/types").SKTx,
        txMeta: import("../../src/public-api/types").SKTxMeta
      ) => Promise<string>;
      readonly signMessage: (message: string) => Promise<string>;
      readonly switchChain: (chainId: number) => Promise<void>;
    };
    readonly type: "generic";
  };
};

type BorrowExternalProviderProps = ClassicExternalProviderProps & {
  readonly borrowEnabled: true;
  readonly externalProviders: Omit<
    ClassicExternalProviderProps["externalProviders"],
    "provider"
  > & {
    readonly supportsBorrow: true;
    readonly provider: ClassicExternalProviderProps["externalProviders"]["provider"] & {
      readonly sendBorrowTransaction: (
        tx: import("../../src/public-api/types").SKTx,
        txMeta: import("../../src/public-api/types").SKBorrowTxMeta
      ) => Promise<string>;
    };
  };
};

type DynamicBorrowProps = {
  readonly apiKey: string;
  readonly borrowEnabled: boolean;
};

/**
 * Fails to compile unless `Runtime` is assignable to `Contract`, reported as an
 * ordinary TypeScript assignability error naming the offending export.
 *
 * The direction is deliberate. The contract is allowed to be wider than the
 * implementation — `darkTheme` is published as `SKTheme` rather than as the
 * concrete token object — so demanding mutual assignability would reject the
 * surface the package intends to publish.
 */
const assertRuntimeSatisfiesContract = <Contract, Runtime extends Contract>(
  ..._runtime: ReadonlyArray<Runtime>
) => {};

describe("declared value exports", () => {
  it("match the package contract", () => {
    assertRuntimeSatisfiesContract<PackageContract, PackageRuntime>();
    expectTypeOf<keyof PackageRuntime>().toEqualTypeOf<keyof PackageContract>();
  });

  it("match the bundle contract", () => {
    assertRuntimeSatisfiesContract<BundleContract, BundleRuntime>();
    expectTypeOf<keyof BundleRuntime>().toEqualTypeOf<keyof BundleContract>();
  });
});

describe("public external-provider props", () => {
  it("preserves classic hosts and makes Borrow capability explicit", () => {
    expectTypeOf<ClassicExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<BorrowExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<DynamicBorrowProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      ClassicExternalProviderProps & { readonly borrowEnabled: true }
    >().not.toMatchTypeOf<PublicSKAppProps>();
  });
});

const widgetRoot = path.resolve(import.meta.dirname, "..", "..");

type ExportedSymbol = {
  /**
   * `"<path relative to packages/widget>#<name>"` for a re-export, so that two
   * entries agree on the declaration and not merely on the name. `undefined`
   * when the entry declares the symbol itself, which is how the contract states
   * the type of every value it publishes.
   */
  readonly origin: string | undefined;
  readonly typeOnly: boolean;
};

const entryPairs = [
  {
    label: "package entry",
    contract: "src/public-api/index.package.ts",
    runtime: "src/index.package.ts",
  },
  {
    label: "bundle entry",
    contract: "src/public-api/index.bundle.ts",
    runtime: "src/index.bundle.ts",
  },
] as const;

const parse = (relativePath: string) =>
  ts.createSourceFile(
    relativePath,
    readFileSync(path.join(widgetRoot, relativePath), "utf8"),
    ts.ScriptTarget.ESNext,
    true
  );

const resolveModuleSpecifier = (
  fromRelativePath: string,
  specifier: string
): string => {
  const base = path.join(
    path.dirname(path.join(widgetRoot, fromRelativePath)),
    specifier
  );
  const resolved = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find((candidate) => existsSync(candidate));

  if (!resolved) {
    throw new Error(
      `Cannot resolve "${specifier}" from ${fromRelativePath}. Public entries ` +
        "may only re-export relative paths inside packages/widget."
    );
  }

  return path.relative(widgetRoot, resolved);
};

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const collectExports = (
  relativePath: string
): ReadonlyMap<string, ExportedSymbol> => {
  const source = parse(relativePath);
  const exports = new Map<string, ExportedSymbol>();

  const declareLocal = (name: string, typeOnly: boolean) =>
    exports.set(name, { origin: undefined, typeOnly });

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;

      if (!clause || !ts.isNamedExports(clause)) {
        throw new Error(
          `${relativePath} uses \`export *\`. Public entries must enumerate ` +
            "their exports so that the contract and the runtime entry can be " +
            "compared name by name."
        );
      }

      for (const specifier of clause.elements) {
        const localName = (specifier.propertyName ?? specifier.name).text;
        const typeOnly = statement.isTypeOnly || specifier.isTypeOnly;

        if (!statement.moduleSpecifier) {
          declareLocal(specifier.name.text, typeOnly);
          continue;
        }

        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
          throw new Error(`${relativePath} has a non-literal export source.`);
        }

        exports.set(specifier.name.text, {
          origin: `${resolveModuleSpecifier(
            relativePath,
            statement.moduleSpecifier.text
          )}#${localName}`,
          typeOnly,
        });
      }

      continue;
    }

    if (!hasExportModifier(statement)) continue;

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          throw new Error(`${relativePath} exports a destructured binding.`);
        }

        declareLocal(declaration.name.text, false);
      }

      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (!statement.name) {
        throw new Error(`${relativePath} has a default or anonymous export.`);
      }

      declareLocal(statement.name.text, false);
      continue;
    }

    if (
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement)
    ) {
      declareLocal(statement.name.text, true);
      continue;
    }

    throw new Error(
      `${relativePath} has an export that the conformance check does not ` +
        `understand (${ts.SyntaxKind[statement.kind]}).`
    );
  }

  return exports;
};

const sortedNames = (exports: ReadonlyMap<string, ExportedSymbol>) =>
  [...exports.keys()].sort();

describe.each(entryPairs)("$label", ({ contract, runtime }) => {
  const contractExports = collectExports(contract);
  const runtimeExports = collectExports(runtime);

  it("exports the same names as its contract", () => {
    expect(sortedNames(runtimeExports)).toStrictEqual(
      sortedNames(contractExports)
    );
  });

  it("agrees with its contract on which exports are type-only", () => {
    const typeOnlyNames = (exports: ReadonlyMap<string, ExportedSymbol>) =>
      sortedNames(exports).filter((name) => exports.get(name)?.typeOnly);

    expect(typeOnlyNames(runtimeExports)).toStrictEqual(
      typeOnlyNames(contractExports)
    );
  });

  it("re-exports every published type from the same declaration", () => {
    // The contract cannot restate a type without becoming a second definition
    // of it, so it re-exports types from `src/public-api/types.ts`. The runtime
    // entry has to reach that same declaration: resolving `SupportedSKChainIds`
    // through a structurally identical copy elsewhere in `src` type-checks and
    // is still drift, so it is rejected here.
    const typeOrigins = (exports: ReadonlyMap<string, ExportedSymbol>) =>
      Object.fromEntries(
        [...exports]
          .filter(([, exported]) => exported.typeOnly)
          .map(([name, exported]) => [name, exported.origin])
      );

    expect(typeOrigins(runtimeExports)).toStrictEqual(
      typeOrigins(contractExports)
    );
  });
});

describe("contract is import-closed", () => {
  it.each(entryPairs.map(({ contract }) => contract))(
    "%s reaches nothing outside src/public-api",
    (contract) => {
      const escaping = parse(contract)
        .statements.flatMap((statement) =>
          (ts.isImportDeclaration(statement) ||
            ts.isExportDeclaration(statement)) &&
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
            ? [statement.moduleSpecifier.text]
            : []
        )
        .filter((specifier) => specifier.startsWith("."))
        .filter(
          (specifier) =>
            !resolveModuleSpecifier(contract, specifier).startsWith(
              path.join("src", "public-api")
            )
        );

      expect(escaping).toStrictEqual([]);
    }
  );
});
