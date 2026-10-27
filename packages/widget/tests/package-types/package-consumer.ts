import {
  type ActionMeta,
  type BittensorTx,
  EvmChainIds,
  type EvmTx,
  type HelpModalProps,
  MiscChainIds,
  type SKAppProps,
  type SKBorrowExternalProviders,
  type SKCustomTranslations,
  type SKExternalProviders,
  type SKLanguage,
  type SKPreferredTokenYieldsPerNetwork,
  type SKToken,
  type SKTrackingConfig,
  type SKTx,
  type SKWalletPolicy,
  type SolanaTx,
  SubstrateChainIds,
  type SupportedSKChainIds,
  type TonTx,
  type TronTx,
  YieldCategory,
} from "@stakekit/widget";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type PublicNetwork = NonNullable<ActionMeta["inputToken"]>["network"];
type InitialChain = NonNullable<SKAppProps["initialChain"]>;

export type PackageTypeAssertions = [
  Assert<Equal<InitialChain, SupportedSKChainIds>>,
  Assert<Equal<EvmChainIds, (typeof EvmChainIds)[keyof typeof EvmChainIds]>>,
  Assert<Equal<42_162 extends SupportedSKChainIds ? true : false, false>>,
  Assert<Equal<Extract<keyof typeof EvmChainIds, number>, never>>,
  Assert<Equal<Extract<keyof typeof SubstrateChainIds, number>, never>>,
  Assert<Equal<Extract<keyof typeof MiscChainIds, number>, never>>,
  Assert<
    Equal<
      NonNullable<SKAppProps["externalProviders"]>,
      SKExternalProviders | SKBorrowExternalProviders
    >
  >,
  Assert<Equal<NonNullable<SKAppProps["tracking"]>, SKTrackingConfig>>,
  Assert<Equal<NonNullable<SKAppProps["language"]>, SKLanguage>>,
  Assert<
    Equal<NonNullable<SKAppProps["customTranslations"]>, SKCustomTranslations>
  >,
  Assert<
    Equal<
      NonNullable<SKAppProps["preferredTokenYieldsPerNetwork"]>,
      SKPreferredTokenYieldsPerNetwork
    >
  >,
  Assert<Equal<NonNullable<ActionMeta["inputToken"]>, SKToken>>,
  Assert<Equal<SKTx, EvmTx | SolanaTx | TonTx | TronTx | BittensorTx>>,
  Assert<
    Equal<HelpModalProps["modal"]["type"], "getInTouch" | "whatIsStakeKit">
  >,
];

export const packageValueAssertions = {
  category: YieldCategory.Stake,
  evmChainId: EvmChainIds.Ethereum satisfies SupportedSKChainIds,
  miscChainId: MiscChainIds.Solana satisfies SupportedSKChainIds,
  network: "ethereum" satisfies PublicNetwork,
  substrateChainId: SubstrateChainIds.Polkadot satisfies SupportedSKChainIds,
  walletPolicy: {
    allow: ["wallet-id"],
  } satisfies SKWalletPolicy,
};
