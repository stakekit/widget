import { Schema } from "effect";
import type { Resources } from "i18next";
import type { EarnYieldWithProvider } from "../earn/models";
import { YieldId } from "../identity/identifiers";
import type { Network } from "../network/network";

const decodeYieldId = Schema.decodeSync(YieldId);

const enabledRewardsSummaryYieldIds = {
  polkadot: [
    {
      id: decodeYieldId("polkadot-dot-validator-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.polkadot_dot_validator_staking",
    },
  ],
  "avalanche-c": [
    {
      id: decodeYieldId("avalanche-avax-liquid-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.avalanche_avax_liquid_staking",
    },
  ],
  cronos: [
    {
      id: decodeYieldId("cronos-cro-native-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.cronos_cro_native_staking",
    },
  ],
  ethereum: [
    {
      id: decodeYieldId("ethereum-matic-native-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.ethereum_matic_native_staking",
    },
  ],
  binancebeacon: [
    {
      id: decodeYieldId("bsc-bnb-native-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.bsc_bnb_native_staking",
    },
  ],
  tron: [
    {
      id: decodeYieldId("tron-trx-native-staking"),
      name: "dashboard.enabled_rewards_summary_yield_names.tron_trx_native_staking",
    },
  ],
} as const satisfies Partial<
  Record<
    Network,
    {
      id: EarnYieldWithProvider["id"];
      name: `dashboard.enabled_rewards_summary_yield_names.${keyof Resources["translation"]["dashboard"]["enabled_rewards_summary_yield_names"]}`;
    }[]
  >
>;

const enabledRewardsSummaryYieldIdsSet = new Set(
  Object.values(enabledRewardsSummaryYieldIds).flatMap((v) =>
    v.map((v) => v.id)
  )
);

type EnabledRewardsSummaryYieldId =
  (typeof enabledRewardsSummaryYieldIds)[keyof typeof enabledRewardsSummaryYieldIds][number]["id"];

export const isValidYieldIdForRewardsSummary = (
  yieldId: string
): yieldId is EnabledRewardsSummaryYieldId =>
  enabledRewardsSummaryYieldIdsSet.has(yieldId as EnabledRewardsSummaryYieldId);
