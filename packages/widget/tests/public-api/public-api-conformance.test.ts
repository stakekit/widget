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
 * - `describe("entry declarations")` keeps those declarations free of
 *   implementation modules and removed exports.
 * - `describe("public API dependencies")` keeps host declarations on the
 *   deliberate Domain contract paths and rejects Domain implementation imports.
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

const removedEntryExports = [
  "SKBundleConfiguration",
  "createWallet",
  "evmChainGroup",
] as const;

const sharedEntryExports = [
  "ActionMeta",
  "BittensorTx",
  "YieldCategory",
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
