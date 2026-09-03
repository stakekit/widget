import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { WalletAddress, YieldId } from "../../domain/identity/identifiers";
import type { HistoryPeriod } from "../../domain/portfolio/models";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const insightPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(2),
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

const yieldKycStatusCanonicalAtom = Atom.family((key: YieldKycStatusKey) =>
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

export const yieldKycStatusResourceAtom = makePresentableResourceFamily(
  yieldKycStatusCanonicalAtom
);

const yieldRewardRateHistoryCanonicalAtom = Atom.family(
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

export const yieldRewardRateHistoryResourceAtom = makePresentableResourceFamily(
  yieldRewardRateHistoryCanonicalAtom
);

const yieldTvlHistoryCanonicalAtom = Atom.family(
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

export const yieldTvlHistoryResourceAtom = makePresentableResourceFamily(
  yieldTvlHistoryCanonicalAtom
);
