import { Data, Duration, Effect, Option, Schema } from "effect";
import { chunksOf } from "effect/Array";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import { ResponseDecodeError } from "../../domain/schema/api-errors";
import {
  EarnProvider,
  EarnYield,
  EarnYieldPage,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";
import type { ProviderId, YieldId } from "../../domain/schema/identifiers";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

const yieldResourcePolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

class YieldProviderKey extends Data.Class<{
  readonly providerId: ProviderId;
}> {}

const yieldProviderAtom = valueEqualAtomFamily((key: YieldProviderKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* StakeKitApiService;
        const response = yield* api.yield
          .ProvidersControllerGetProvider(key.providerId, undefined)
          .pipe(withApiRequestError("yield-provider"));

        return yield* Schema.decodeUnknownEffect(EarnProvider)(response).pipe(
          withResponseDecodeError("yield-provider")
        );
      })
    )
    .pipe(yieldResourcePolicy)
);

export class YieldOpportunityKey extends Data.Class<{
  readonly decodeIssue: string | null;
  readonly yieldId: YieldId | null;
}> {}

export const yieldOpportunityAtom = valueEqualAtomFamily(
  (key: YieldOpportunityKey) =>
    stakeKitApiRuntime
      .atom((get) =>
        Effect.gen(function* () {
          if (key.decodeIssue) {
            return yield* new ResponseDecodeError({
              operation: "yield-opportunity-key",
              issue: key.decodeIssue,
              cause: new Error(key.decodeIssue),
            });
          }

          if (!key.yieldId) return null;

          const api = yield* StakeKitApiService;
          const response = yield* api.yield
            .YieldsControllerGetYield(key.yieldId, undefined)
            .pipe(withApiRequestError("yield-opportunity"));
          const yieldModel = yield* Schema.decodeUnknownEffect(EarnYield)(
            response
          ).pipe(withResponseDecodeError("yield-opportunity"));
          const provider = yield* get
            .result(
              yieldProviderAtom(
                new YieldProviderKey({
                  providerId: yieldModel.providerId,
                })
              )
            )
            .pipe(Effect.option);

          return yield* Schema.decodeUnknownEffect(EarnYieldWithProvider)({
            ...yieldModel,
            ...(Option.isSome(provider) ? { provider: provider.value } : {}),
          }).pipe(withResponseDecodeError("yield-opportunity"));
        })
      )
      .pipe(yieldResourcePolicy)
);

export class MultiYieldsKey extends Data.Class<{
  readonly decodeIssue: string | null;
  readonly enabled: boolean;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

export const getUniqueYieldIdChunks = (
  yieldIds: ReadonlyArray<YieldId>,
  chunkSize = 100
) => chunksOf(Array.from(new Set(yieldIds)), Math.max(1, chunkSize));

export const multiYieldsAtom = valueEqualAtomFamily((key: MultiYieldsKey) =>
  stakeKitApiRuntime
    .atom((get) =>
      Effect.gen(function* () {
        if (key.decodeIssue) {
          return yield* new ResponseDecodeError({
            operation: "multi-yields-key",
            issue: key.decodeIssue,
            cause: new Error(key.decodeIssue),
          });
        }

        if (!key.enabled || key.yieldIds.length === 0) return null;

        const api = yield* StakeKitApiService;
        const chunks = getUniqueYieldIdChunks(key.yieldIds);
        const ids = chunks.flat();
        const pages = yield* Effect.forEach(
          chunks,
          (chunk) =>
            api.yield
              .YieldsControllerGetYields({
                params: {
                  limit: chunk.length,
                  yieldIds: chunk,
                },
              })
              .pipe(
                withApiRequestError("multi-yields"),
                Effect.flatMap((response) =>
                  Schema.decodeUnknownEffect(EarnYieldPage)(response).pipe(
                    withResponseDecodeError("multi-yields")
                  )
                )
              ),
          { concurrency: 3 }
        );
        const yieldsById = new Map(
          pages
            .flatMap((page) => page.items ?? [])
            .map((item) => [item.id, item])
        );

        return yield* Effect.forEach(
          ids,
          (yieldId) => {
            const yieldModel = yieldsById.get(yieldId);

            if (!yieldModel) return Effect.succeed(null);

            return get
              .result(
                yieldProviderAtom(
                  new YieldProviderKey({
                    providerId: yieldModel.providerId,
                  })
                )
              )
              .pipe(
                Effect.option,
                Effect.flatMap((provider) =>
                  Schema.decodeUnknownEffect(EarnYieldWithProvider)({
                    ...yieldModel,
                    ...(Option.isSome(provider)
                      ? { provider: provider.value }
                      : {}),
                  }).pipe(withResponseDecodeError("multi-yields"))
                )
              );
          },
          { concurrency: 5 }
        ).pipe(Effect.map((items) => items.filter((item) => item !== null)));
      })
    )
    .pipe(yieldResourcePolicy)
);
