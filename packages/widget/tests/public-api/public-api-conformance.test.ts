import { readFile } from "node:fs/promises";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  packageEntries,
  transpileEntryDeclaration,
} from "../../scripts/declarations/entry-declarations";
import { widgetRoot } from "../../scripts/paths";
import type {
  BundledSKWidgetProps,
  SKWallet as BundledWallet,
  SKWalletPolicy as BundledWalletPolicy,
  renderSKWidget,
} from "../../src/index.bundle";
import type {
  SKAppProps as PackageSKAppProps,
  SKWallet as PackageWallet,
  SKWalletPolicy as PackageWalletPolicy,
} from "../../src/index.package";
import type {
  HelpModalProps as PublicHelpModalProps,
  SKAppProps as PublicSKAppProps,
} from "../../src/public-api/react-types";
import type {
  BundledSKWidgetProps as PublicBundledSKWidgetProps,
  SKBorrowExternalProviders,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKBorrowWallet,
  SKEip712TypedData,
  SKExternalProviders,
  SKTx,
  SKTxMeta,
  SKWallet,
} from "../../src/public-api/types";

/**
 * `src/index.package.ts` and `src/index.bundle.ts` are both the runtime entries
 * and the published contract: `build:types` transpiles each on its own, so the
 * explicit annotations on their values are the declarations hosts compile
 * against, and `tsc` checks the implementations against them.
 *
 * - `describe("package and bundled entry contracts")` keeps the two entry
 *   modes on one wallet contract.
 * - `describe("entry declarations")` pins the published names and their
 *   deprecations; `build:types` itself rejects implementation imports and
 *   unstated value types.
 */

type YieldExternalProviderProps = {
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
> = YieldExternalProviderProps & {
  readonly borrowEnabled: true;
  readonly externalProviders: Omit<
    YieldExternalProviderProps["externalProviders"],
    "provider"
  > & {
    readonly provider: YieldExternalProviderProps["externalProviders"]["provider"] &
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
  it("preserves yield hosts and makes Borrow capability follow borrowEnabled", () => {
    expectTypeOf<YieldExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<BorrowExternalProviderProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<DynamicBorrowProps>().toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      YieldExternalProviderProps & { readonly borrowEnabled: true }
    >().not.toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf<
      BorrowExternalProviderPropsWith<
        Omit<BorrowProviderCallbacks, "signTypedData">
      >
    >().not.toMatchTypeOf<PublicSKAppProps>();
  });

  it("accepts an inline provider that also signs Zama permits", () => {
    const signZamaPermit = async () =>
      ({ type: "success", signature: "0xsignature" }) as const;
    const provider = {
      sendTransaction: async () => "0xhash",
      signMessage: async () => "0xsignature",
      switchChain: async () => {},
    };
    const borrow = {
      sendBorrowTransaction: async () =>
        ({ type: "success", txHash: "0xhash" }) as const,
      signTypedData: async () =>
        ({ type: "success", signature: "0xsignature" }) as const,
    };
    const externalProvider = {
      currentAddress: "0x1",
      type: "generic",
    } as const;

    // Spread members escape excess-property checks; the Zama callback must not.
    expectTypeOf({
      apiKey: "key",
      externalProviders: {
        ...externalProvider,
        provider: { ...provider, signZamaPermit },
      },
    } satisfies PublicSKAppProps).toMatchTypeOf<PublicSKAppProps>();
    expectTypeOf({
      apiKey: "key",
      borrowEnabled: true,
      externalProviders: {
        ...externalProvider,
        provider: { ...provider, ...borrow, signZamaPermit },
      },
    } satisfies PublicSKAppProps).toMatchTypeOf<PublicSKAppProps>();
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

  it("does not expose settings and callbacks the Widget never reads", () => {
    expectTypeOf<
      Extract<keyof PublicSKAppProps, "tokensForEnabledYieldsOnly">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<
        keyof SKExternalProviders | keyof SKBorrowExternalProviders,
        "supportsBorrow"
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof SKWallet | keyof SKBorrowWallet, "getTransactionReceipt">
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

describe("package and bundled entry contracts", () => {
  const packageProps = {
    apiKey: "public-contract-api-key",
    externalProviders: {
      type: "generic",
      currentAddress: "0x0000000000000000000000000000000000000001",
      currentChain: 1,
      supportedChainIds: [1],
      provider: {
        signMessage: async () => "signed-message",
        switchChain: async () => undefined,
        sendTransaction: async () => ({
          type: "success" as const,
          txHash: "0xbroadcast-hash",
        }),
      },
    },
  } satisfies PackageSKAppProps;

  it("keeps generic wallet callbacks Promise-based in both entry modes", () => {
    expectTypeOf<PackageWallet>().toEqualTypeOf<BundledWallet>();
    expectTypeOf<PackageWallet["signMessage"]>().returns.toEqualTypeOf<
      Promise<
        | string
        | { type: "success"; signature: string }
        | { type: "cancelled" }
        | { type: "error"; error: string }
      >
    >();
    expectTypeOf<PackageWallet["switchChain"]>().returns.toEqualTypeOf<
      Promise<void>
    >();
    expectTypeOf<PackageWallet["sendTransaction"]>().returns.toEqualTypeOf<
      Promise<
        | string
        | { type: "success"; txHash: string }
        | { type: "cancelled" }
        | { type: "error"; error: string; txHash?: string }
      >
    >();
  });

  it("keeps bundled lifecycle controls on the non-React configuration", () => {
    type BundledRenderProps = Parameters<typeof renderSKWidget>[0];
    const bundledRenderProps = {
      ...packageProps,
      container: {} as HTMLElement,
    } satisfies BundledRenderProps;

    expectTypeOf(packageProps).toMatchTypeOf<BundledSKWidgetProps>();
    expectTypeOf(bundledRenderProps).toMatchTypeOf<BundledRenderProps>();
    expectTypeOf<ReturnType<typeof renderSKWidget>>().toEqualTypeOf<{
      rerender: (newProps: BundledSKWidgetProps) => void;
      unmount: () => void;
    }>();
    expectTypeOf<BundledWalletPolicy>().toEqualTypeOf<PackageWalletPolicy>();
  });
});

const sharedEntryExports = [
  "ActionMeta",
  "BittensorTx",
  "YieldCategory",
  "EvmChainIds",
  "EvmTx",
  "MiscChainIds",
  "SKActionArguments",
  "SKActionType",
  "SKAppearance",
  "SKBorrowExternalProviders",
  "SKBorrowMarketsScope",
  "SKBorrowSignatureResult",
  "SKBorrowTx",
  "SKBorrowTxMeta",
  "SKBorrowTxResult",
  "SKBorrowWallet",
  "SKColorRole",
  "SKCustomTranslations",
  "SKEip712TypedData",
  "SKExternalProviders",
  "SKHostVariant",
  "SKLanguage",
  "SKLayout",
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
  "SKYieldProviderOrder",
  "SKZamaPermitMeta",
  "SKZamaPermitResult",
  "SolanaTx",
  "SubstrateChainIds",
  "SupportedSKChainIds",
  "TonTx",
  "TronTx",
  "YieldProviderId",
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
  it("export every published name explicitly", async () => {
    const { exportedNames, unexportedSignatureTypes, wildcardExports } =
      await transpileEntryDeclaration(entry);

    expect(exportedNames).toStrictEqual(
      [...publishedEntryExports[entry]].sort()
    );
    expect(unexportedSignatureTypes).toStrictEqual([]);
    expect(wildcardExports).toStrictEqual([]);
  });

  it("mark the legacy theme exports deprecated", async () => {
    const { outputText } = await transpileEntryDeclaration(entry);

    for (const name of ["darkTheme", "lightTheme"]) {
      expect(outputText).toMatch(
        new RegExp(`@deprecated[^/]*\\*/\\s*export declare const ${name}\\b`)
      );
    }
  });
});

/** Every property signature named `name` in a source file. */
const propertySignatures = (source: ts.SourceFile, name: string) => {
  const found: Array<ts.PropertySignature> = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertySignature(node) && node.name.getText(source) === name) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/**
 * The JSDoc tag names of each property signature named `name` in the
 * declaration `build:types` publishes for `src/public-api/types.ts`.
 */
const propertyTagNames = async (name: string) => {
  const path = join(widgetRoot, "src", "public-api", "types.ts");
  const { outputText } = ts.transpileDeclaration(await readFile(path, "utf8"), {
    compilerOptions: { declaration: true },
    fileName: path,
  });
  const declaration = ts.createSourceFile(
    "types.d.ts",
    outputText,
    ts.ScriptTarget.ESNext,
    true
  );
  return propertySignatures(declaration, name).map((prop) =>
    ts.getJSDocTags(prop).map((tag) => tag.tagName.text)
  );
};

describe.each(["theme", "dashboardVariant"])("legacy %s prop", (name) => {
  it("is marked deprecated wherever hosts can pass it", async () => {
    const tags = await propertyTagNames(name);

    expect(tags).not.toHaveLength(0);
    for (const propTags of tags) {
      expect(propTags).toContain("deprecated");
    }
  });
});
