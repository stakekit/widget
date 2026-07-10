import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import {
  type HistoryPeriod,
  KycStatus,
  RewardRateHistoryResponse,
  type RewardsAddresses,
  RewardsSummaryRecord,
  TvlHistoryResponse,
} from "../../domain/schema/dashboard-models";
import type { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

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

export const yieldKycStatusAtom = valueEqualAtomFamily((key: YieldKycKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.address || !key.yieldId) return null;

        const api = yield* StakeKitApiService;
        const response = yield* api.yield
          .KycControllerGetStatus(key.yieldId, {
            params: { address: key.address },
          })
          .pipe(withApiRequestError("yield-kyc-status"));

        return yield* Schema.decodeUnknownEffect(KycStatus)(response).pipe(
          withResponseDecodeError("yield-kyc-status")
        );
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

export const yieldRewardRateHistoryAtom = valueEqualAtomFamily(
  (key: YieldHistoryKey) =>
    stakeKitApiRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (!key.yieldId) return null;

          const api = yield* StakeKitApiService;
          const response = yield* api.yield
            .YieldsControllerGetYieldRewardRateHistory(key.yieldId, {
              params: {
                interval: getYieldHistoryInterval(key.period),
                period: key.period,
              },
            })
            .pipe(withApiRequestError("yield-reward-rate-history"));

          return yield* Schema.decodeUnknownEffect(RewardRateHistoryResponse)(
            response
          ).pipe(withResponseDecodeError("yield-reward-rate-history"));
        })
      )
      .pipe(dashboardResourcePolicy)
);

export const yieldTvlHistoryAtom = valueEqualAtomFamily(
  (key: YieldHistoryKey) =>
    stakeKitApiRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (!key.yieldId) return null;

          const api = yield* StakeKitApiService;
          const response = yield* api.yield
            .YieldsControllerGetYieldTvlHistory(key.yieldId, {
              params: {
                interval: getYieldHistoryInterval(key.period),
                period: key.period,
              },
            })
            .pipe(withApiRequestError("yield-tvl-history"));

          return yield* Schema.decodeUnknownEffect(TvlHistoryResponse)(
            response
          ).pipe(withResponseDecodeError("yield-tvl-history"));
        })
      )
      .pipe(dashboardResourcePolicy)
);

export class RewardsSummaryKey extends Data.Class<{
  readonly addresses: RewardsAddresses | null;
  readonly enabled: boolean;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

export const rewardsSummaryAtom = valueEqualAtomFamily(
  (key: RewardsSummaryKey) =>
    stakeKitApiRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (!key.enabled || !key.addresses || key.yieldIds.length === 0) {
            return null;
          }

          const api = yield* StakeKitApiService;
          const addresses = key.addresses;
          const responses = yield* Effect.forEach(
            key.yieldIds,
            (yieldId) =>
              api.legacy
                .YieldControllerGetSingleYieldRewardsSummary(yieldId, {
                  payload: { addresses },
                })
                .pipe(
                  withApiRequestError("yield-rewards-summary"),
                  Effect.map((response) => [yieldId, response] as const)
                ),
            { concurrency: 5 }
          );

          return yield* Schema.decodeUnknownEffect(RewardsSummaryRecord)(
            Object.fromEntries(responses)
          ).pipe(withResponseDecodeError("yield-rewards-summary"));
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
