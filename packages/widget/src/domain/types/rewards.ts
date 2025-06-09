import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "@stakekit/common";

const enabledRewardsSummaryYieldIds = {
  [SubstrateNetworks.Polkadot]: ["polkadot-dot-validator-staking"],
  [EvmNetworks.AvalancheC]: ["avalanche-avax-liquid-staking"],
  [CosmosNetworks.Cronos]: ["cronos-cro-native-staking"],
  [EvmNetworks.Ethereum]: ["ethereum-matic-native-staking"],
  [MiscNetworks.BinanceBeacon]: ["bsc-bnb-native-staking"],
  [MiscNetworks.Tron]: ["tron-trx-native-staking"],
} as const;

const enabledRewardsSummaryYieldIdsSet = new Set(
  Object.values(enabledRewardsSummaryYieldIds).flat()
);

export type EnabledRewardsSummaryYieldId =
  (typeof enabledRewardsSummaryYieldIds)[keyof typeof enabledRewardsSummaryYieldIds][number];

export const isValidYieldIdForRewardsSummary = (
  yieldId: string
): yieldId is EnabledRewardsSummaryYieldId =>
  enabledRewardsSummaryYieldIdsSet.has(yieldId as EnabledRewardsSummaryYieldId);
