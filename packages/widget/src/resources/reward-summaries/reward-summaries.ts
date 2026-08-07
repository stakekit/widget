import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type {
  RewardsAddresses,
  RewardsSummary,
} from "../../domain/schema/dashboard-models";
import type { YieldId } from "../../domain/schema/identifiers";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class RewardSummariesKey extends Data.TaggedClass("RewardSummariesKey")<{
  readonly addresses: RewardsAddresses;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: {
    readonly addresses: RewardsAddresses;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) {
    super({
      addresses: input.addresses,
      yieldIds: [...new Set(input.yieldIds)].sort(),
    });
  }
}

export class RewardSummariesError extends Data.TaggedError(
  "RewardSummariesError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

type RewardSummaries = Readonly<Record<string, RewardsSummary | null>>;

const rewardsPolicy = withApiResourcePolicy({
  staleTime: Duration.seconds(30),
});

const rewardSummariesCanonicalAtom = Atom.family((key: RewardSummariesKey) =>
  appRuntime
    .atom(() =>
      key.yieldIds.length === 0
        ? Effect.succeed({} as RewardSummaries)
        : LegacyResourceSource.use((source) =>
            source
              .getRewardsSummaries({
                addresses: key.addresses,
                yieldIds: key.yieldIds,
              })
              .pipe(
                Effect.map(
                  (summaries): RewardSummaries =>
                    Object.fromEntries(
                      key.yieldIds.map((yieldId) => [
                        yieldId,
                        summaries[yieldId] ?? null,
                      ])
                    )
                )
              )
          ).pipe(
            Effect.mapError((cause) => new RewardSummariesError({ cause }))
          )
    )
    .pipe(rewardsPolicy, Atom.withLabel("rewardSummariesResourceAtom"))
);

export const rewardSummariesResourceAtom = makePresentableResourceFamily(
  rewardSummariesCanonicalAtom
);
