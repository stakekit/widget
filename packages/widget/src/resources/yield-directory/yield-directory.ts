import { Data, Duration, Effect, Option, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type {
  EarnYield,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";
import type { ProviderId, YieldId } from "../../domain/schema/identifiers";
import type { Network } from "../../domain/schema/network-model";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPagesByIdChunks,
} from "../../shared/effect/pagination";
import type { YieldProviderError } from "../yield-provider/yield-provider";
import { yieldProviderResourceAtom } from "../yield-provider/yield-provider";

const CONCURRENCY = 5;

type YieldType = (typeof EarnYield.Type)["mechanics"]["type"];

export class YieldDirectoryKey extends Data.TaggedClass("YieldDirectoryKey")<{
  readonly network: Network | null;
  readonly types: ReadonlyArray<YieldType>;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: {
    readonly network?: Network | null;
    readonly types?: ReadonlyArray<YieldType>;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) {
    super({
      network: input.network ?? null,
      types: [...new Set(input.types ?? [])].sort(),
      yieldIds: [...new Set(input.yieldIds)].sort(),
    });
  }
}

export class YieldFirstPageKey extends Data.TaggedClass("YieldFirstPageKey")<{
  readonly network: Network | null;
  readonly types: ReadonlyArray<YieldType>;
}> {
  constructor(input: {
    readonly network?: Network | null;
    readonly types: ReadonlyArray<YieldType>;
  }) {
    super({
      network: input.network ?? null,
      types: [...new Set(input.types)].sort(),
    });
  }
}

export class YieldDirectoryError extends Data.TaggedError(
  "YieldDirectoryError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

type YieldDirectoryResult = {
  readonly items: ReadonlyArray<EarnYield>;
  readonly missingYieldIds: ReadonlyArray<YieldId>;
};

type EnrichedYieldDirectoryResult = {
  readonly items: ReadonlyArray<EarnYieldWithProvider>;
  readonly missingProviderIds: ReadonlyArray<ProviderId>;
  readonly missingYieldIds: ReadonlyArray<YieldId>;
  readonly providerFailures: ReadonlyArray<YieldProviderError>;
};

const directoryPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(5),
  revalidateOnMount: true,
});

export const yieldFirstPageResourceAtom = Atom.family(
  (key: YieldFirstPageKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source
            .listYields({
              limit: 10,
              offset: 0,
              ...(key.network ? { network: key.network } : {}),
              types: key.types,
            })
            .pipe(
              Effect.map((page) => page.items ?? []),
              Effect.mapError((cause) => new YieldDirectoryError({ cause }))
            )
        )
      )
      .pipe(directoryPolicy, Atom.withLabel("yieldFirstPageResourceAtom"))
);

export const yieldDirectoryResourceAtom = Atom.family(
  (key: YieldDirectoryKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (key.yieldIds?.length === 0) {
            return {
              items: [],
              missingYieldIds: [],
            } satisfies YieldDirectoryResult;
          }

          const source = yield* YieldResourceSource;
          const fetchPage = (
            offset: number,
            yieldIds?: ReadonlyArray<YieldId>
          ) =>
            source.listYields({
              limit: API_MAX_PAGE_SIZE,
              offset,
              ...(key.network ? { network: key.network } : {}),
              ...(key.types.length > 0 ? { types: key.types } : {}),
              ...(yieldIds ? { yieldIds } : {}),
            });

          const items = yield* loadAllPagesByIdChunks({
            chunkSize: API_MAX_PAGE_SIZE,
            concurrency: CONCURRENCY,
            fetchPage: ({ ids, offset }) => fetchPage(offset, ids),
            getItemId: (yieldModel) => yieldModel.id,
            ids: key.yieldIds,
            pageSize: API_MAX_PAGE_SIZE,
          });
          const returnedIds = new Set(items.map((yieldModel) => yieldModel.id));

          return {
            items,
            missingYieldIds: key.yieldIds.filter(
              (yieldId) => !returnedIds.has(yieldId)
            ),
          } satisfies YieldDirectoryResult;
        }).pipe(Effect.mapError((cause) => new YieldDirectoryError({ cause })))
      )
      .pipe(directoryPolicy, Atom.withLabel("yieldDirectoryResourceAtom"))
);

export const enrichedYieldDirectoryResourceAtom = Atom.family(
  (key: YieldDirectoryKey) =>
    appRuntime
      .atom((context) =>
        Effect.gen(function* () {
          const directory = yield* context.result(
            yieldDirectoryResourceAtom(key)
          );
          const providerIds = [
            ...new Set(
              directory.items.map((yieldModel) => yieldModel.providerId)
            ),
          ];
          const providerResults = yield* Effect.forEach(
            providerIds,
            (providerId) =>
              context.result(yieldProviderResourceAtom(providerId)).pipe(
                Effect.result,
                Effect.map((provider) => [providerId, provider] as const)
              ),
            { concurrency: CONCURRENCY }
          );
          const providers = new Map(
            providerResults.flatMap(([providerId, provider]) =>
              Result.isSuccess(provider) && Option.isSome(provider.success)
                ? [[providerId, provider.success.value]]
                : []
            )
          );

          return {
            items: directory.items.map((yieldModel) => {
              const provider = providers.get(yieldModel.providerId);
              return {
                ...yieldModel,
                ...(provider ? { provider } : {}),
              } satisfies EarnYieldWithProvider;
            }),
            missingProviderIds: providerResults.flatMap(
              ([providerId, provider]) =>
                Result.isSuccess(provider) && Option.isNone(provider.success)
                  ? [providerId]
                  : []
            ),
            missingYieldIds: directory.missingYieldIds,
            providerFailures: providerResults.flatMap(([, provider]) =>
              Result.isFailure(provider) ? [provider.failure] : []
            ),
          } satisfies EnrichedYieldDirectoryResult;
        })
      )
      .pipe(Atom.withLabel("enrichedYieldDirectoryResourceAtom"))
);
