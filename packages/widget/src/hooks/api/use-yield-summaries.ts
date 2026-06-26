import type { QueryClient } from "@tanstack/react-query";
import { chunksOf } from "effect/Array";
import { isSupportedChain } from "../../domain/types/chains";
import {
  isEthenaUsdeStaking,
  isNonZeroRewardRateYield,
  type YieldProviderDetails,
} from "../../domain/types/yields";
import type { YieldDto } from "../../generated/api/yield";
import type { useApiClient } from "../../providers/api/api-client-provider";
import { fetchYieldProviders } from "./use-yield-providers";

/**
 * A yield "summary" is the new yields API DTO, returned by
 * `YieldsControllerGetYields`. It contains everything category discovery and
 * list rendering need (`token`, `rewardRate`, `status`, `metadata`,
 * `mechanics.type`, `providerId`).
 */
export type YieldSummary = YieldDto;
type YieldSummaryWithProvider = YieldSummary & {
  provider?: YieldProviderDetails;
};

const DEFAULT_YIELD_IDS_CHUNK_SIZE = 100;

/**
 * A summary is "visible" when it is enterable, on a supported chain, and has a
 * non-zero reward rate (matching the dashboard catalog's display semantics).
 */
export const isVisibleYieldSummary = (summary: YieldSummary): boolean =>
  summary.status.enter &&
  isSupportedChain(summary.token.network) &&
  isNonZeroRewardRateYield(summary);

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

  for (const chunk of chunksOf(ids, normalizedChunkSize)) {
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
