import type { YieldDto } from "@stakekit/api-hooks";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "@stakekit/common";
import type { Resources } from "i18next";

const enabledRewardsSummaryYieldIds = {
  [SubstrateNetworks.Polkadot]: [
    {
      id: "polkadot-dot-validator-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.polkadot_dot_validator_staking",
    },
  ],
  [EvmNetworks.AvalancheC]: [
    {
      id: "avalanche-avax-liquid-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.avalanche_avax_liquid_staking",
    },
  ],
  [CosmosNetworks.Cronos]: [
    {
      id: "cronos-cro-native-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.cronos_cro_native_staking",
    },
  ],
  [EvmNetworks.Ethereum]: [
    {
      id: "ethereum-matic-native-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.ethereum_matic_native_staking",
    },
  ],
  [MiscNetworks.BinanceBeacon]: [
    {
      id: "bsc-bnb-native-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.bsc_bnb_native_staking",
    },
  ],
  [MiscNetworks.Tron]: [
    {
      id: "tron-trx-native-staking",
      name: "dashboard.enabled_rewards_summary_yield_names.tron_trx_native_staking",
    },
  ],
} as const satisfies Record<
  | SubstrateNetworks.Polkadot
  | EvmNetworks.AvalancheC
  | CosmosNetworks.Cronos
  | EvmNetworks.Ethereum
  | MiscNetworks.BinanceBeacon
  | MiscNetworks.Tron,
  {
    id: YieldDto["id"];
    name: `dashboard.enabled_rewards_summary_yield_names.${keyof Resources["translation"]["dashboard"]["enabled_rewards_summary_yield_names"]}`;
  }[]
>;

export const enabledRewardsSummaryYieldNames = Object.values(
  enabledRewardsSummaryYieldIds
).flatMap((v) => v.map((v) => v.name));

const enabledRewardsSummaryYieldIdsSet = new Set(
  Object.values(enabledRewardsSummaryYieldIds).flatMap((v) =>
    v.map((v) => v.id)
  )
);

export type EnabledRewardsSummaryYieldId =
  (typeof enabledRewardsSummaryYieldIds)[keyof typeof enabledRewardsSummaryYieldIds][number]["id"];

export const isValidYieldIdForRewardsSummary = (
  yieldId: string
): yieldId is EnabledRewardsSummaryYieldId =>
  enabledRewardsSummaryYieldIdsSet.has(yieldId as EnabledRewardsSummaryYieldId);
