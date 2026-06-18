import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import type { TokenBalanceScanResponseDto } from "../../domain/types/token-balance";
import type { TokenDto } from "../../domain/types/tokens";
import {
  type DashboardYieldCategory,
  getApiYieldTypesForDashboardCategory,
} from "../../domain/types/yields";
import type {
  TokenControllerGetTokensParams as LegacyTokenGetTokensParams,
  TokenWithAvailableYieldsDto as LegacyTokenWithAvailableYieldsDto,
} from "../../generated/api/legacy";
import type {
  TokensControllerGetTokensParams as YieldTokenGetTokensParams,
  TokenWithAvailableYieldsDto as YieldTokenWithAvailableYieldsDto,
} from "../../generated/api/yield";
import type { ApiClient } from "../../providers/api/api-client";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSettings } from "../../providers/settings";
import { useSKWallet } from "../../providers/sk-wallet";

const DEFAULT_TOKENS_PAGE_LIMIT = 100;
const DEFAULT_TOKENS_PAGE_CONCURRENCY = 5;

type YieldTokenTypes = YieldTokenGetTokensParams["yieldTypes"];
type DefaultTokensQueryParams = {
  enabledYieldsOnly?: boolean;
  network?: TokenDto["network"];
  yieldTypes?: YieldTokenTypes;
};
type DefaultTokensPage = {
  limit?: number;
  nextOffset?: number;
  offset?: number;
  tokens: TokenBalanceScanResponseDto[];
  total?: number;
};
type DefaultTokensPages = {
  pages: DefaultTokensPage[];
  pageParams: number[];
};
type FetchDefaultTokensPageParams = DefaultTokensQueryParams & {
  apiClient: ApiClient;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

const noopFetchNextPage = () => undefined;

const getTokenGetTokensQueryKey = (params?: DefaultTokensQueryParams) =>
  ["/v1/tokens", ...(params ? [params] : [])] as const;

const getAllDefaultTokensQueryKey = (params?: DefaultTokensQueryParams) =>
  ["/v1/tokens/all-pages", ...(params ? [params] : [])] as const;

const getNextOffset = ({
  limit,
  offset,
  total,
}: {
  limit: number;
  offset: number;
  total: number;
}) => {
  const nextOffset = offset + limit;

  return nextOffset < total ? nextOffset : undefined;
};

const shouldUseYieldTokensApi = ({
  enabledYieldsOnly,
  yieldTypes,
}: Pick<DefaultTokensQueryParams, "enabledYieldsOnly" | "yieldTypes">) =>
  !!enabledYieldsOnly || !!yieldTypes?.length;

const toTokenBalanceScanResponse = (
  tokenWithYields:
    | LegacyTokenWithAvailableYieldsDto
    | YieldTokenWithAvailableYieldsDto
): TokenBalanceScanResponseDto => ({
  token: tokenWithYields.token,
  availableYields: tokenWithYields.availableYields,
  amount: "0",
});

export const getYieldTypesForDashboardCategory = (
  yieldCategory?: DashboardYieldCategory | null
): YieldTokenTypes =>
  yieldCategory
    ? getApiYieldTypesForDashboardCategory(yieldCategory)
    : undefined;

export const fetchDefaultTokens = async ({
  apiClient,
  enabledYieldsOnly,
  limit = DEFAULT_TOKENS_PAGE_LIMIT,
  network,
  offset: firstOffset = 0,
  signal,
  yieldTypes,
}: FetchDefaultTokensPageParams): Promise<DefaultTokensPages> => {
  if (shouldUseYieldTokensApi({ enabledYieldsOnly, yieldTypes })) {
    const yieldTokenParams = {
      networks: network
        ? [
            network as NonNullable<
              YieldTokenGetTokensParams["networks"]
            >[number],
          ]
        : undefined,
      yieldTypes,
      limit,
    };

    const fetchYieldTokensPage = async (
      offset: number
    ): Promise<DefaultTokensPage> => {
      const page = await apiClient
        .withOptions({ signal })
        .yield.TokensControllerGetTokens({
          params: { ...yieldTokenParams, offset },
        });

      return {
        limit: page.limit,
        tokens: (page.items ?? []).map(toTokenBalanceScanResponse),
        nextOffset: getNextOffset(page),
        offset: page.offset,
        total: page.total,
      };
    };

    const firstPage = await fetchYieldTokensPage(firstOffset);

    if (firstPage.nextOffset === undefined) {
      return { pages: [firstPage], pageParams: [firstOffset] };
    }

    const remainingOffsets: number[] = [];
    for (
      let offset = firstPage.offset! + firstPage.limit!;
      offset < firstPage.total!;
      offset += firstPage.limit!
    ) {
      remainingOffsets.push(offset);
    }

    const pages = [firstPage];
    const pageParams = [firstOffset, ...remainingOffsets];

    for (
      let i = 0;
      i < remainingOffsets.length;
      i += DEFAULT_TOKENS_PAGE_CONCURRENCY
    ) {
      const chunk = remainingOffsets.slice(
        i,
        i + DEFAULT_TOKENS_PAGE_CONCURRENCY
      );
      const chunkPages = await Promise.all(
        chunk.map((offset) => fetchYieldTokensPage(offset))
      );

      pages.push(...chunkPages);
    }

    return { pages, pageParams };
  }

  const tokens = await apiClient
    .withOptions({ signal })
    .legacy.TokenControllerGetTokens({
      params: {
        enabledYieldsOnly: enabledYieldsOnly || undefined,
        network: network as LegacyTokenGetTokensParams["network"],
      },
    });

  return {
    pages: [{ tokens: tokens.map(toTokenBalanceScanResponse) }],
    pageParams: [firstOffset],
  };
};

export const useDefaultTokens = ({
  yieldCategory,
}: {
  yieldCategory?: DashboardYieldCategory | null;
} = {}) => {
  const { network } = useSKWallet();
  const { tokensForEnabledYieldsOnly } = useSettings();
  const apiClient = useApiClient();
  const queryParams: DefaultTokensQueryParams = {
    enabledYieldsOnly: !!tokensForEnabledYieldsOnly,
    network: network ?? undefined,
    yieldTypes: getYieldTypesForDashboardCategory(yieldCategory),
  };
  const shouldFetchAllPages = !!queryParams.yieldTypes?.length;

  const allPagesQuery = useQuery({
    queryKey: getAllDefaultTokensQueryKey(queryParams),
    enabled: shouldFetchAllPages,
    queryFn: async ({ signal }) => {
      const data = await fetchDefaultTokens({
        ...queryParams,
        apiClient,
        signal,
      });

      return data.pages.flatMap((page) => page.tokens);
    },
    staleTime: 1000 * 60 * 5,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: getTokenGetTokensQueryKey(queryParams),
    enabled: !shouldFetchAllPages,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      if (shouldUseYieldTokensApi(queryParams)) {
        const page = await apiClient
          .withOptions({ signal })
          .yield.TokensControllerGetTokens({
            params: {
              networks: queryParams.network
                ? [
                    queryParams.network as NonNullable<
                      YieldTokenGetTokensParams["networks"]
                    >[number],
                  ]
                : undefined,
              yieldTypes: queryParams.yieldTypes,
              offset: pageParam,
              limit: DEFAULT_TOKENS_PAGE_LIMIT,
            },
          });

        return {
          limit: page.limit,
          tokens: (page.items ?? []).map(toTokenBalanceScanResponse),
          nextOffset: getNextOffset(page),
          offset: page.offset,
          total: page.total,
        };
      }

      const tokens = await apiClient
        .withOptions({ signal })
        .legacy.TokenControllerGetTokens({
          params: {
            enabledYieldsOnly: queryParams.enabledYieldsOnly || undefined,
            network:
              queryParams.network as LegacyTokenGetTokensParams["network"],
          },
        });

      return {
        tokens: tokens.map(toTokenBalanceScanResponse),
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    select: (data) => data.pages.flatMap((page) => page.tokens),
    staleTime: 1000 * 60 * 5,
  });

  if (shouldFetchAllPages) {
    return {
      ...allPagesQuery,
      fetchNextPage: noopFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
    };
  }

  return infiniteQuery;
};

export const getDefaultTokens = (
  params: Omit<FetchDefaultTokensPageParams, "signal"> & {
    queryClient: QueryClient;
  }
) => {
  const queryParams: DefaultTokensQueryParams = {
    enabledYieldsOnly: params.enabledYieldsOnly,
    network: params.network,
    yieldTypes: params.yieldTypes,
  };

  return EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getAllDefaultTokensQueryKey(queryParams),
      queryFn: async () => {
        const data = await fetchDefaultTokens(params);
        params.queryClient.setQueryData<
          InfiniteData<DefaultTokensPage, number>
        >(getTokenGetTokensQueryKey(queryParams), data);

        return data.pages.flatMap((page) => page.tokens);
      },
      staleTime: 1000 * 60 * 5,
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get default tokens");
  });
};
