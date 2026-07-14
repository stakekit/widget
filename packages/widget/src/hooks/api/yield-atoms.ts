import { Data, Duration, Effect, Option } from "effect";
import { chunksOf } from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { ProviderId, YieldId } from "../../domain/schema/identifiers";
import { isSupportedChain } from "../../domain/types/chains";
import {
  type DashboardYieldCategory,
  getDashboardYieldCategory,
} from "../../domain/types/yields";
import { StakeKitApiService } from "../../providers/api/api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";
import { currentWalletConnectedNetworkAtom } from "../../providers/wallet";

const yieldResourcePolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

class YieldProviderKey extends Data.Class<{
  readonly providerId: ProviderId;
}> {}

const yieldProviderAtom = Atom.family((key: YieldProviderKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* StakeKitApiService;
        return yield* api.yield.getProvider(key.providerId);
      })
    )
    .pipe(yieldResourcePolicy)
);

export class YieldOpportunityKey extends Data.Class<{
  readonly yieldId: YieldId | null;
}> {}

export const yieldOpportunityAtom = Atom.family((key: YieldOpportunityKey) =>
  widgetAtomRuntime
    .atom((get) =>
      Effect.gen(function* () {
        if (!key.yieldId) return null;

        const api = yield* StakeKitApiService;
        const yieldModel = yield* api.yield.getYield(key.yieldId);
        const provider = yield* get
          .result(
            yieldProviderAtom(
              new YieldProviderKey({
                providerId: yieldModel.providerId,
              })
            )
          )
          .pipe(Effect.option);

        return {
          ...yieldModel,
          ...(Option.isSome(provider) ? { provider: provider.value } : {}),
        } satisfies EarnYieldWithProvider;
      })
    )
    .pipe(yieldResourcePolicy)
);

export class MultiYieldsKey extends Data.Class<{
  readonly enabled: boolean;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

export const getUniqueYieldIdChunks = (
  yieldIds: ReadonlyArray<YieldId>,
  chunkSize = 100
) => chunksOf(Array.from(new Set(yieldIds)), Math.max(1, chunkSize));

const multiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  widgetAtomRuntime
    .atom((get) =>
      Effect.gen(function* () {
        if (!key.enabled || key.yieldIds.length === 0) return null;

        const api = yield* StakeKitApiService;
        const chunks = getUniqueYieldIdChunks(key.yieldIds);
        const ids = chunks.flat();
        const pages = yield* Effect.forEach(
          chunks,
          (chunk) =>
            api.yield.getYields({
              limit: chunk.length,
              yieldIds: chunk,
            }),
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
                Effect.map(
                  (provider) =>
                    ({
                      ...yieldModel,
                      ...(Option.isSome(provider)
                        ? { provider: provider.value }
                        : {}),
                    }) satisfies EarnYieldWithProvider
                )
              );
          },
          { concurrency: 5 }
        ).pipe(Effect.map((items) => items.filter((item) => item !== null)));
      })
    )
    .pipe(yieldResourcePolicy)
);

export const visibleMultiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  Atom.make((get) => {
    const connectedNetwork = get(currentWalletConnectedNetworkAtom);

    return get(multiYieldsAtom(key)).pipe(
      AsyncResult.map(
        (yields) =>
          yields?.filter((yieldModel) => {
            const visible =
              yieldModel.id !== "binance-bnb-native-staking" &&
              yieldModel.id !== "binance-testnet-bnb-native-staking" &&
              yieldModel.id !== "avax-native-staking" &&
              yieldModel.status.enter &&
              isSupportedChain(yieldModel.token.network);

            return (
              visible &&
              (connectedNetwork === null ||
                connectedNetwork === yieldModel.token.network)
            );
          }) ?? null
      )
    );
  })
);

export const multiYieldsByIdAtom = Atom.family((key: MultiYieldsKey) =>
  visibleMultiYieldsAtom(key).pipe(
    Atom.mapResult(
      (yields) =>
        new Map((yields ?? []).map((yieldModel) => [yieldModel.id, yieldModel]))
    )
  )
);

export const multiYieldCategoriesAtom = Atom.family((key: MultiYieldsKey) =>
  visibleMultiYieldsAtom(key).pipe(
    Atom.mapResult(
      (yields) =>
        new Map<YieldId, DashboardYieldCategory | null>(
          (yields ?? []).map((yieldModel) => [
            yieldModel.id,
            getDashboardYieldCategory(yieldModel),
          ])
        )
    )
  )
);
