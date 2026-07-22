import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { HistoryPeriod } from "../../domain/schema/dashboard-models";
import type { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";

const insightPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

export class YieldKycStatusKey extends Data.TaggedClass("YieldKycStatusKey")<{
  readonly address: WalletAddress;
  readonly yieldId: YieldId;
}> {}

export class YieldHistoryResourceKey extends Data.TaggedClass(
  "YieldHistoryResourceKey"
)<{
  readonly interval: "day" | "week";
  readonly period: HistoryPeriod;
  readonly yieldId: YieldId;
}> {}

export class YieldInsightError extends Data.TaggedError("YieldInsightError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
  readonly operation: "kyc" | "reward-rate-history" | "tvl-history";
}> {}

export const yieldKycStatusResourceAtom = Atom.family(
  (key: YieldKycStatusKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) => source.getKycStatus(key)).pipe(
          Effect.mapError(
            (cause) => new YieldInsightError({ cause, operation: "kyc" })
          )
        )
      )
      .pipe(insightPolicy, Atom.withLabel("yieldKycStatusResourceAtom"))
);

export const yieldRewardRateHistoryResourceAtom = Atom.family(
  (key: YieldHistoryResourceKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source.getRewardRateHistory(key)
        ).pipe(
          Effect.mapError(
            (cause) =>
              new YieldInsightError({
                cause,
                operation: "reward-rate-history",
              })
          )
        )
      )
      .pipe(insightPolicy, Atom.withLabel("yieldRewardRateHistoryResourceAtom"))
);

export const yieldTvlHistoryResourceAtom = Atom.family(
  (key: YieldHistoryResourceKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) => source.getTvlHistory(key)).pipe(
          Effect.mapError(
            (cause) =>
              new YieldInsightError({ cause, operation: "tvl-history" })
          )
        )
      )
      .pipe(insightPolicy, Atom.withLabel("yieldTvlHistoryResourceAtom"))
);
