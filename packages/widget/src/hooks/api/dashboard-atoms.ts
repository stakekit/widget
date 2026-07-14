import BigNumber from "bignumber.js";
import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import type {
  HistoryPeriod,
  RewardsAddresses,
  RewardsSummary,
} from "../../domain/schema/dashboard-models";
import type { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import { isValidYieldIdForRewardsSummary } from "../../domain/types/rewards";
import { StakeKitApiService } from "../../providers/api/api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";
import { selectCurrentWalletAtom } from "../../providers/wallet";

const dashboardResourcePolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

export class YieldKycKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly enabled: boolean;
  readonly yieldId: YieldId | null;
}> {}

export const yieldKycStatusAtom = Atom.family((key: YieldKycKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.address || !key.yieldId) return null;

        const api = yield* StakeKitApiService;
        return yield* api.yield.getKycStatus({
          address: key.address,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

export class YieldHistoryKey extends Data.Class<{
  readonly period: HistoryPeriod;
  readonly yieldId: YieldId | null;
}> {}

const getYieldHistoryInterval = (period: HistoryPeriod) =>
  period === "1y" || period === "all" ? "week" : "day";

export const yieldRewardRateHistoryAtom = Atom.family((key: YieldHistoryKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) return null;

        const api = yield* StakeKitApiService;
        return yield* api.yield.getRewardRateHistory({
          interval: getYieldHistoryInterval(key.period),
          period: key.period,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

export const yieldTvlHistoryAtom = Atom.family((key: YieldHistoryKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) return null;

        const api = yield* StakeKitApiService;
        return yield* api.yield.getTvlHistory({
          interval: getYieldHistoryInterval(key.period),
          period: key.period,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

class RewardsSummaryKey extends Data.Class<{
  readonly addresses: RewardsAddresses | null;
  readonly enabled: boolean;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

const rewardsSummaryAtom = Atom.family((key: RewardsSummaryKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.addresses || key.yieldIds.length === 0) {
          return null;
        }

        const api = yield* StakeKitApiService;
        return yield* api.legacy.getRewardsSummaries({
          addresses: key.addresses,
          yieldIds: key.yieldIds,
        });
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.zero,
        revalidateOnMount: true,
      })
    )
);

type RewardsSummaryResult = Record<string, RewardsSummary>;

export class CurrentRewardsSummaryKey extends Data.Class<{
  readonly enabled: boolean;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

const currentRewardsAddressesAtom = selectCurrentWalletAtom((walletState) =>
  walletState.status === "connected"
    ? {
        address: walletState.address,
        ...(walletState.additionalAddresses
          ? { additionalAddresses: walletState.additionalAddresses }
          : {}),
      }
    : null
).pipe(Atom.withLabel("currentRewardsAddressesAtom"));

export const currentRewardsSummaryAtom = Atom.family(
  (key: CurrentRewardsSummaryKey) =>
    Atom.make((get) => {
      const filteredIds = key.yieldIds.filter(isValidYieldIdForRewardsSummary);
      const addresses = get(currentRewardsAddressesAtom);

      return get(
        rewardsSummaryAtom(
          new RewardsSummaryKey({
            addresses,
            enabled:
              key.enabled && addresses !== null && filteredIds.length > 0,
            yieldIds: filteredIds,
          })
        )
      );
    })
);

export const positiveRewardsSummaryAtom = Atom.family(
  (key: CurrentRewardsSummaryKey) =>
    currentRewardsSummaryAtom(key).pipe(
      Atom.mapResult((summaries) => {
        if (!summaries) return null;

        return key.yieldIds.reduce<RewardsSummaryResult>(
          (positive, yieldId) => {
            const summary = summaries[yieldId];

            if (summary && BigNumber(summary.rewards.total).gt(0)) {
              positive[yieldId] = summary;
            }

            return positive;
          },
          {}
        );
      })
    )
);
