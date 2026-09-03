import {
  type ActionMeta,
  type BundledSKWidgetProps,
  DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  type SKWalletPolicy,
  SubstrateChainIds,
  type SupportedSKChainIds,
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
];

export const bundleValueAssertions = {
  category: DashboardYieldCategory.Stake,
  evmChainId: EvmChainIds.Ethereum satisfies SupportedSKChainIds,
  miscChainId: MiscChainIds.Solana satisfies SupportedSKChainIds,
  network: "ethereum" satisfies PublicNetwork,
  substrateChainId: SubstrateChainIds.Polkadot satisfies SupportedSKChainIds,
  walletPolicy: {
    deny: ["wallet-id"],
  } satisfies SKWalletPolicy,
};
