import { Data, Duration, Effect, Option, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  EarnYield,
  EarnYieldWithProvider,
} from "../../domain/earn/models";
import type { ProviderId, YieldId } from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPagesByIdChunks,
} from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import type { YieldProviderError } from "../yield-provider/index";
import { yieldProviderResourceAtom } from "../yield-provider/index";

const CONCURRENCY = 5;

type YieldType = EarnYield["mechanics"]["type"];

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
  staleTime: Duration.minutes(5),
});

const yieldDirectoryCanonicalAtom = Atom.family((key: YieldDirectoryKey) =>
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
        const fetchPage = (offset: number, yieldIds?: ReadonlyArray<YieldId>) =>
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

export const yieldDirectoryResourceAtom = makePresentableResourceFamily(
  yieldDirectoryCanonicalAtom
);

const enrichedYieldDirectoryCanonicalAtom = Atom.family(
  (key: YieldDirectoryKey) =>
    appRuntime
      .atom((context) =>
        Effect.gen(function* () {
          const directory = yield* context.result(
            yieldDirectoryResourceAtom.local(key)
          );
          const providerIds = [
            ...new Set(
              directory.items.map((yieldModel) => yieldModel.providerId)
            ),
          ];
          const providerResults = yield* Effect.forEach(
            providerIds,
            (providerId) =>
              context.result(yieldProviderResourceAtom.local(providerId)).pipe(
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

export const enrichedYieldDirectoryResourceAtom = makePresentableResourceFamily(
  enrichedYieldDirectoryCanonicalAtom
);
