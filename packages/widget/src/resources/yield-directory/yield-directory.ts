import { Data, Duration, Effect, Option, Result, Schedule } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type {
  EarnYield,
  EarnYieldWithProvider,
} from "../../domain/earn/yield-schema";
import type { ProviderId, YieldId } from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPages,
  loadAllPagesByIdChunks,
  YIELD_IDS_CHUNK_SIZE,
} from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import type { YieldProviderError } from "../yield-provider/yield-provider";
import { yieldProviderResourceAtom } from "../yield-provider/yield-provider";

const CONCURRENCY = 5;

type YieldType = EarnYield["mechanics"]["type"];

export class YieldDirectoryKey extends Data.TaggedClass("YieldDirectoryKey")<{
  readonly network: Network | null;
  readonly token: string | null;
  readonly types: ReadonlyArray<YieldType>;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: {
    readonly network?: Network | null;
    readonly token?: string | null;
    readonly types?: ReadonlyArray<YieldType>;
    readonly yieldIds?: ReadonlyArray<YieldId>;
  }) {
    super({
      network: input.network ?? null,
      token: input.token ?? null,
      types: [...new Set(input.types ?? [])].sort(),
      yieldIds: [...new Set(input.yieldIds ?? [])].sort(),
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

/**
 * A failure the API may not repeat: it was unreachable, was rate limited or
 * failed on its side. An answer it gave for the request itself, such as a
 * 400, or a body that could not be read, would fail again.
 */
const isTransientFailure = (error: ApiRequestError | ResponseDecodeError) => {
  if (error._tag !== "ApiRequestError") return false;
  const { failure } = error;
  if (failure._tag === "Unreachable") return true;
  return (
    failure._tag === "ErrorStatus" &&
    (failure.status === 429 || failure.status >= 500)
  );
};

/**
 * Past the transport's immediate retries, the directory asks again twice,
 * 1 s and then 2 s later, so a brief outage settles before the page shows
 * its failure.
 */
const transientBackoff = {
  schedule: Schedule.exponential(Duration.seconds(1)),
  times: 2,
  while: isTransientFailure,
} as const;

const yieldDirectoryCanonicalAtom = Atom.family((key: YieldDirectoryKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.token && key.yieldIds?.length === 0) {
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
            ...(key.token ? { token: key.token } : {}),
            ...(key.types.length > 0 ? { types: key.types } : {}),
            ...(yieldIds && yieldIds.length > 0 ? { yieldIds } : {}),
          });

        const items = key.token
          ? yield* loadAllPages({
              concurrency: CONCURRENCY,
              fetchPage: (offset) => fetchPage(offset),
              pageSize: API_MAX_PAGE_SIZE,
            })
          : yield* loadAllPagesByIdChunks({
              chunkSize: YIELD_IDS_CHUNK_SIZE,
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
      }).pipe(
        Effect.retry(transientBackoff),
        Effect.mapError((cause) => new YieldDirectoryError({ cause }))
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
      directoryPolicy,
      Atom.withLabel("yieldDirectoryResourceAtom")
    )
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
