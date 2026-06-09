import type { QueryClient } from "@tanstack/react-query";
import { isSupportedChain } from "../../domain/types/chains";
import {
  isEthenaUsdeStaking,
  isNonZeroRewardRateYield,
  type YieldProviderDetails,
} from "../../domain/types/yields";
import type {
  YieldDto,
  YieldsControllerGetYieldsParams,
} from "../../generated/api/yield";
import type { useApiClient } from "../../providers/api/api-client-provider";
import { fetchYieldProviders } from "./use-yield-providers";

/**
 * A yield "summary" is the new yields API DTO, returned by
 * `YieldsControllerGetYields`. It contains everything category discovery and
 * list rendering need (`token`, `rewardRate`, `status`, `metadata`,
 * `mechanics.type`, `providerId`) and intentionally does NOT include the legacy
 * `__fallback__` hydration, which is only required for a selected yield.
 */
export type YieldSummary = YieldDto;
export type YieldSummaryWithProvider = YieldSummary & {
  provider?: YieldProviderDetails;
};

export const DEFAULT_YIELD_SUMMARIES_PAGE_LIMIT = 50;
const DEFAULT_YIELD_IDS_CHUNK_SIZE = 100;

export type YieldSummariesParams = Pick<
  YieldsControllerGetYieldsParams,
  "network" | "types" | "inputToken" | "sort" | "limit"
>;

/**
 * A summary is "visible" when it is enterable, on a supported chain, and has a
 * non-zero reward rate (matching the dashboard catalog's display semantics).
 */
export const isVisibleYieldSummary = (summary: YieldSummary): boolean =>
  summary.status.enter &&
  isSupportedChain(summary.token.network) &&
  isNonZeroRewardRateYield(summary);

export const getYieldSummariesQueryKey = (
  params: YieldSummariesParams & { allPages?: boolean }
) => ["yield-summaries", params];

type FetchArgs = {
  apiClient: ReturnType<typeof useApiClient>;
  params: YieldSummariesParams;
  signal?: AbortSignal;
};

type FetchByIdsArgs = {
  apiClient: ReturnType<typeof useApiClient>;
  chunkSize?: number;
  signal?: AbortSignal;
  suppressRichErrors?: boolean;
  yieldIds: ReadonlyArray<string>;
};

type FetchByIdsWithProvidersArgs = FetchByIdsArgs & {
  queryClient: QueryClient;
};

const unique = <T>(items: ReadonlyArray<T>) => [...new Set(items)];

const chunks = <T>(items: ReadonlyArray<T>, chunkSize: number): T[][] => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }

  return result;
};

/**
 * Fetch a single page of yield summaries.
 */
export const fetchYieldSummariesPage = async ({
  apiClient,
  params,
  signal,
}: FetchArgs): Promise<YieldSummary[]> => {
  const client = apiClient.withOptions({ signal });
  const result = await client.yield.YieldsControllerGetYields({ params });

  return [...(result.items ?? [])];
};

/**
 * Fetch yield summaries by ID without ever sending an unbounded `yieldIds`
 * query array. Results are ordered according to the first occurrence of each
 * requested ID.
 */
export const fetchYieldSummariesByIds = async ({
  apiClient,
  chunkSize = DEFAULT_YIELD_IDS_CHUNK_SIZE,
  signal,
  suppressRichErrors,
  yieldIds,
}: FetchByIdsArgs): Promise<YieldSummary[]> => {
  const ids = unique(yieldIds);

  if (ids.length === 0) {
    return [];
  }

  const client = apiClient.withOptions({ signal, suppressRichErrors });
  const normalizedChunkSize = Math.max(1, chunkSize);
  const summariesById = new Map<string, YieldSummary>();

  for (const chunk of chunks(ids, normalizedChunkSize)) {
    const result = await client.yield.YieldsControllerGetYields({
      params: {
        yieldIds: chunk,
        limit: chunk.length,
      },
    });

    for (const summary of result.items ?? []) {
      summariesById.set(summary.id, summary);
    }
  }

  return ids.flatMap((id) => {
    const summary = summariesById.get(id);

    return summary ? [summary] : [];
  });
};

const applyYieldSummaryOverrides = <T extends YieldSummary>(yieldDto: T): T =>
  isEthenaUsdeStaking(yieldDto.id)
    ? ({
        ...yieldDto,
        metadata: {
          ...yieldDto.metadata,
          name: yieldDto.metadata.name.replace(/staking/i, ""),
        },
      } as T)
    : yieldDto;

export const fetchYieldSummariesWithProvidersByIds = async ({
  apiClient,
  queryClient,
  signal,
  suppressRichErrors,
  yieldIds,
}: FetchByIdsWithProvidersArgs): Promise<YieldSummaryWithProvider[]> => {
  const client = apiClient.withOptions({ signal, suppressRichErrors });
  const summaries = await fetchYieldSummariesByIds({
    apiClient,
    signal,
    suppressRichErrors,
    yieldIds,
  });
  const providersById = await fetchYieldProviders({
    client,
    providerIds: summaries.map((yieldDto) => yieldDto.providerId),
    queryClient,
  });

  return summaries.map((summary) => {
    const provider = providersById.get(summary.providerId);

    return applyYieldSummaryOverrides({
      ...summary,
      ...(provider ? { provider } : {}),
    });
  });
};

/**
 * Fetch every page of yield summaries for the given params, looping `offset`
 * until all `total` items have been retrieved.
 */
export const fetchAllYieldSummaries = async ({
  apiClient,
  params,
  signal,
}: FetchArgs): Promise<YieldSummary[]> => {
  const client = apiClient.withOptions({ signal });
  const limit = params.limit ?? DEFAULT_YIELD_SUMMARIES_PAGE_LIMIT;

  const all: YieldSummary[] = [];
  let offset = 0;

  while (true) {
    const result = await client.yield.YieldsControllerGetYields({
      params: { ...params, limit, offset },
    });

    const items = result.items ?? [];
    all.push(...items);

    if (items.length === 0 || all.length >= result.total) {
      break;
    }

    offset += items.length;
  }

  return all;
};
