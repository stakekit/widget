import { Effect, Layer } from "effect";

import {
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";

const unexpectedCall = (method: string): Effect.Effect<never> =>
  Effect.die(new Error(`unexpected call: ${method}`));

/** Legacy API reads the test configures; any other read dies naming it. */
export const legacyResourceSourceLayer = (
  overrides: Partial<LegacyResourceSource["Service"]>
) =>
  Layer.succeed(
    LegacyResourceSource,
    LegacyResourceSource.of({
      getGasTokenBalances: () =>
        unexpectedCall("LegacyResourceSource.getGasTokenBalances"),
      getPrices: () => unexpectedCall("LegacyResourceSource.getPrices"),
      getTokenOptions: () =>
        unexpectedCall("LegacyResourceSource.getTokenOptions"),
      scanTokenBalances: () =>
        unexpectedCall("LegacyResourceSource.scanTokenBalances"),
      ...overrides,
    })
  );

/** Yield API reads the test configures; any other read dies naming it. */
export const yieldResourceSourceLayer = (
  overrides: Partial<YieldResourceSource["Service"]>
) =>
  Layer.succeed(
    YieldResourceSource,
    YieldResourceSource.of({
      getActivityAction: () =>
        unexpectedCall("YieldResourceSource.getActivityAction"),
      getEnabledWalletNetworks: unexpectedCall(
        "YieldResourceSource.getEnabledWalletNetworks"
      ),
      getHealth: unexpectedCall("YieldResourceSource.getHealth"),
      getKycStatus: () => unexpectedCall("YieldResourceSource.getKycStatus"),
      getOpportunity: () =>
        unexpectedCall("YieldResourceSource.getOpportunity"),
      getPositions: () => unexpectedCall("YieldResourceSource.getPositions"),
      getProvider: () => unexpectedCall("YieldResourceSource.getProvider"),
      getRewardsSummary: () =>
        unexpectedCall("YieldResourceSource.getRewardsSummary"),
      getRewardRateHistory: () =>
        unexpectedCall("YieldResourceSource.getRewardRateHistory"),
      getSingleYieldBalances: () =>
        unexpectedCall("YieldResourceSource.getSingleYieldBalances"),
      getTvlHistory: () => unexpectedCall("YieldResourceSource.getTvlHistory"),
      listActivity: () => unexpectedCall("YieldResourceSource.listActivity"),
      listCampaignPayouts: () =>
        unexpectedCall("YieldResourceSource.listCampaignPayouts"),
      listValidators: () =>
        unexpectedCall("YieldResourceSource.listValidators"),
      listWalletCampaignRewards: () =>
        unexpectedCall("YieldResourceSource.listWalletCampaignRewards"),
      listProjectCampaigns: () =>
        unexpectedCall("YieldResourceSource.listProjectCampaigns"),
      listYields: () => unexpectedCall("YieldResourceSource.listYields"),
      simulateAction: () =>
        unexpectedCall("YieldResourceSource.simulateAction"),
      ...overrides,
    })
  );
