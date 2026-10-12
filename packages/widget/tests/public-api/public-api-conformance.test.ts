import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  packageEntries,
  transpileEntryDeclaration,
} from "../../scripts/declarations/entry-declarations";
import type {
  HelpModalProps as PublicHelpModalProps,
  SKAppProps as PublicSKAppProps,
} from "../../src/public-api/react-types";
import type {
  BundledSKWidgetProps as PublicBundledSKWidgetProps,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKEip712TypedData,
  SKTx,
  SKTxMeta,
} from "../../src/public-api/types";

/**
 * `src/index.package.ts` and `src/index.bundle.ts` are both the runtime entries
 * and the published contract: `build:types` transpiles each on its own, so the
 * explicit annotations on their values are the declarations hosts compile
 * against, and `tsc` checks the implementations against them.
 *
 * - `describe("entry declarations")` keeps those declarations free of
 *   implementation modules and removed exports.
 * - `describe("public API dependencies")` keeps host declarations on the
 *   deliberate Domain contract paths and rejects Domain implementation imports.
 */

type ClassicExternalProviderProps = {
  readonly apiKey: string;
  readonly externalProviders: {
    readonly currentAddress: string;
    readonly provider: {
      readonly sendTransaction: (tx: SKTx, txMeta: SKTxMeta) => Promise<string>;
      readonly signMessage: (message: string) => Promise<string>;
      readonly switchChain: (chainId: number) => Promise<void>;
    };
    readonly type: "generic";
  };
};

type BorrowProviderCallbacks = {
  readonly sendBorrowTransaction: (
    tx: SKBorrowTx,
    txMeta: SKBorrowTxMeta
  ) => Promise<
    | { readonly type: "success"; readonly txHash: string }
    | { readonly type: "cancelled" }
    | {
        readonly type: "error";
        readonly error: string;
        readonly txHash?: string;
      }
  >;
  readonly signTypedData: (
    typedData: SKEip712TypedData,
    txMeta: SKBorrowTxMeta
  ) => Promise<
    | { readonly type: "success"; readonly signature: string }
    | { readonly type: "cancelled" }
    | { readonly type: "error"; readonly error: string }
  >;
};

type BorrowExternalProviderPropsWith<
  Callbacks extends Partial<BorrowProviderCallbacks>,
> = ClassicExternalProviderProps & {
  readonly borrowEnabled: true;
  readonly externalProviders: Omit<
    ClassicExternalProviderProps["externalProviders"],
    "provider"
  > & {
    readonly provider: ClassicExternalProviderProps["externalProviders"]["provider"] &
      Callbacks;
  };
};

type BorrowExternalProviderProps =
  BorrowExternalProviderPropsWith<BorrowProviderCallbacks>;

type DynamicBorrowProps = {
  readonly apiKey: string;
  readonly borrowEnabled: boolean;
};

describe("public external-provider props", () => {
  it("preserves classic hosts and makes Borrow capability follow borrowEnabled", () => {
    expectTypeOf<ClassicExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      ClassicExternalProviderProps & {
        readonly externalProviders: { readonly supportsBorrow: false };
      }
    >().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<BorrowExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<DynamicBorrowProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      ClassicExternalProviderProps & { readonly borrowEnabled: true }
    >().not.toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      BorrowExternalProviderPropsWith<
        Omit<BorrowProviderCallbacks, "signTypedData">
      >
    >().not.toMatchTypeOf<PublicSKAppProps>();
  });
});

describe("removed public surface", () => {
  it("does not expose implementation-shaped Host Configuration", () => {
    type RemovedConfigurationKey = "mapWalletListFn" | "wagmi";

    expectTypeOf<
      Extract<keyof PublicSKAppProps, RemovedConfigurationKey>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof PublicBundledSKWidgetProps, RemovedConfigurationKey>
    >().toEqualTypeOf<never>();
  });

  it("keeps the widget-owned geo-block notice out of HelpModal", () => {
    expectTypeOf<{
      readonly modal: { readonly type: "getInTouch" };
    }>().toMatchTypeOf<PublicHelpModalProps>();
    expectTypeOf<{
      readonly modal: {
        readonly type: "geoBlock";
        readonly countryCode: string;
        readonly onClose: () => void;
        readonly regionCodeName: string | undefined;
        readonly tags: Set<string>;
      };
    }>().not.toMatchTypeOf<PublicHelpModalProps>();
  });
});

const removedEntryExports = [
  "SKBundleConfiguration",
  "createWallet",
  "evmChainGroup",
] as const;

const sharedEntryExports = [
  "ActionMeta",
  "BittensorTx",
  "DashboardYieldCategory",
  "EvmChainIds",
  "EvmTx",
  "MiscChainIds",
  "SKActionArguments",
  "SKActionType",
  "SKBorrowExternalProviders",
  "SKBorrowMarketsScope",
  "SKBorrowSignatureResult",
  "SKBorrowTx",
  "SKBorrowTxMeta",
  "SKBorrowTxResult",
  "SKBorrowWallet",
  "SKCustomTranslations",
  "SKEip712TypedData",
  "SKExternalProviders",
  "SKHostVariant",
  "SKLanguage",
  "SKNetwork",
  "SKPreferredTokenYieldsPerNetwork",
  "SKTheme",
  "SKToken",
  "SKTrackEvent",
  "SKTrackPage",
  "SKTrackingConfig",
  "SKSignMessageResult",
  "SKTransactionResult",
  "SKTransactionType",
  "SKTranslationTree",
  "SKTx",
  "SKTxMeta",
  "SKWallet",
  "SKWalletPolicy",
  "SolanaTx",
  "SubstrateChainIds",
  "SupportedSKChainIds",
  "TonTx",
  "TronTx",
  "darkTheme",
  "lightTheme",
];

// Hosts compile against these names; removing one is a breaking change.
const publishedEntryExports = {
  "index.package": [
    ...sharedEntryExports,
    "HelpModal",
    "HelpModalProps",
    "SKApp",
    "SKAppProps",
  ],
  "index.bundle": [
    ...sharedEntryExports,
    "BundledSKWidgetProps",
    "renderSKWidget",
  ],
} satisfies Record<(typeof packageEntries)[number], ReadonlyArray<string>>;

describe.each(packageEntries)("entry declarations: %s", (entry) => {
  it("reference only src/public-api and state every value type", async () => {
    const { diagnostics, implementationImports } =
      await transpileEntryDeclaration(entry);

    expect(diagnostics).toStrictEqual([]);
    expect(implementationImports).toStrictEqual([]);
  });

  it("export every published name explicitly", async () => {
    const { exportedNames, unexportedSignatureTypes, wildcardExports } =
      await transpileEntryDeclaration(entry);

    expect(exportedNames).toStrictEqual(
      [...publishedEntryExports[entry]].sort()
    );
    expect(unexportedSignatureTypes).toStrictEqual([]);
    expect(wildcardExports).toStrictEqual([]);
  });

  it("do not restore removed implementation-shaped exports", async () => {
    const { outputText } = await transpileEntryDeclaration(entry);

    expect(
      removedEntryExports.filter((name) =>
        new RegExp(`\\b${name}\\b`, "u").test(outputText)
      )
    ).toStrictEqual([]);
  });
});

const widgetRoot = path.resolve(import.meta.dirname, "..", "..");

const resolveModuleSpecifier = (
  fromRelativePath: string,
  specifier: string
): string => {
  // Declaration-reachable files carry the runtime `.js` specifier they publish.
  const base = path.join(
    path.dirname(path.join(widgetRoot, fromRelativePath)),
    specifier.replace(/\.js$/u, "")
  );
  const resolved = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find((candidate) => existsSync(candidate));

  if (!resolved) {
    throw new Error(
      `Cannot resolve "${specifier}" from ${fromRelativePath}. Public API ` +
        "files may only import relative paths inside packages/widget."
    );
  }

  return path.relative(widgetRoot, resolved);
};

describe("public API dependencies", () => {
  it("imports Domain only through contract.ts files", () => {
    const publicApiFiles = readdirSync(path.join(widgetRoot, "src/public-api"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => path.join("src/public-api", file));

    const disallowed = publicApiFiles.flatMap((publicApiFile) =>
      ts
        .createSourceFile(
          publicApiFile,
          readFileSync(path.join(widgetRoot, publicApiFile), "utf8"),
          ts.ScriptTarget.ESNext,
          true
        )
        .statements.flatMap((statement) =>
          (ts.isImportDeclaration(statement) ||
            ts.isExportDeclaration(statement)) &&
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
            ? [statement.moduleSpecifier.text]
            : []
        )
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) => resolveModuleSpecifier(publicApiFile, specifier))
        .filter((resolved) => !resolved.startsWith("src/public-api/"))
        .filter(
          (resolved) => !/^src\/domain\/.+\/contract\.ts$/u.test(resolved)
        )
        .map((resolved) => `${publicApiFile} -> ${resolved}`)
    );

    expect(disallowed).toStrictEqual([]);
  });
});
