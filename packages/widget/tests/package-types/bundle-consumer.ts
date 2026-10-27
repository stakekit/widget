import {
  type ActionMeta,
  type BittensorTx,
  type BundledSKWidgetProps,
  EvmChainIds,
  type EvmTx,
  MiscChainIds,
  type SKBorrowExternalProviders,
  type SKExternalProviders,
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
} from "@stakekit/widget/bundle";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type PublicNetwork = NonNullable<ActionMeta["inputToken"]>["network"];
type InitialChain = NonNullable<BundledSKWidgetProps["initialChain"]>;

export type BundleTypeAssertions = [
  Assert<Equal<InitialChain, SupportedSKChainIds>>,
  Assert<Equal<EvmChainIds, (typeof EvmChainIds)[keyof typeof EvmChainIds]>>,
  Assert<Equal<42_162 extends SupportedSKChainIds ? true : false, false>>,
  Assert<Equal<Extract<keyof typeof EvmChainIds, number>, never>>,
  Assert<Equal<Extract<keyof typeof SubstrateChainIds, number>, never>>,
  Assert<Equal<Extract<keyof typeof MiscChainIds, number>, never>>,
  Assert<Equal<Extract<BundledSKWidgetProps, { variant: "zerion" }>, never>>,
  Assert<
    Equal<
      NonNullable<BundledSKWidgetProps["externalProviders"]>,
      SKExternalProviders | SKBorrowExternalProviders
    >
  >,
  Assert<
    Equal<NonNullable<BundledSKWidgetProps["tracking"]>, SKTrackingConfig>
  >,
  Assert<Equal<NonNullable<ActionMeta["inputToken"]>, SKToken>>,
  Assert<Equal<SKTx, EvmTx | SolanaTx | TonTx | TronTx | BittensorTx>>,
];

export const bundleValueAssertions = {
  category: YieldCategory.Stake,
  evmChainId: EvmChainIds.Ethereum satisfies SupportedSKChainIds,
  miscChainId: MiscChainIds.Solana satisfies SupportedSKChainIds,
  network: "ethereum" satisfies PublicNetwork,
  substrateChainId: SubstrateChainIds.Polkadot satisfies SupportedSKChainIds,
  walletPolicy: {
    deny: ["wallet-id"],
  } satisfies SKWalletPolicy,
};
