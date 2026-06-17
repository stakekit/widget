import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
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

type YieldTokenTypes = YieldTokenGetTokensParams["yieldTypes"];
type DefaultTokensQueryParams = {
  enabledYieldsOnly?: boolean;
  network?: TokenDto["network"];
  yieldTypes?: YieldTokenTypes;
};
type DefaultTokensPage = {
  nextOffset?: number;
  tokens: TokenBalanceScanResponseDto[];
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

export const fetchDefaultTokensPage = async ({
  apiClient,
  enabledYieldsOnly,
  limit = DEFAULT_TOKENS_PAGE_LIMIT,
  network,
  offset = 0,
  signal,
  yieldTypes,
}: FetchDefaultTokensPageParams): Promise<DefaultTokensPage> => {
  if (shouldUseYieldTokensApi({ enabledYieldsOnly, yieldTypes })) {
    const page = await apiClient
      .withOptions({ signal })
      .yield.TokensControllerGetTokens({
        params: {
          networks: network
            ? [
                network as NonNullable<
                  YieldTokenGetTokensParams["networks"]
                >[number],
              ]
            : undefined,
          yieldTypes,
          offset,
          limit,
        },
      });

    return {
      tokens: (page.items ?? []).map(toTokenBalanceScanResponse),
      nextOffset: getNextOffset(page),
    };
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
    tokens: tokens.map(toTokenBalanceScanResponse),
  };
};

const fetchDefaultTokenPages = async (
  params: FetchDefaultTokensPageParams
): Promise<DefaultTokensPages> => {
  const pages: DefaultTokensPage[] = [];
  const pageParams: number[] = [];
  let nextOffset: number | undefined = params.offset ?? 0;

  while (nextOffset !== undefined) {
    const offset = nextOffset;
    pageParams.push(offset);

    const page = await fetchDefaultTokensPage({ ...params, offset });
    pages.push(page);

    nextOffset = page.nextOffset;
  }

  return { pages, pageParams };
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

  return useInfiniteQuery({
    queryKey: getTokenGetTokensQueryKey(queryParams),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchDefaultTokensPage({
        ...queryParams,
        apiClient,
        offset: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    select: (data) => data.pages.flatMap((page) => page.tokens),
    staleTime: 1000 * 60 * 5,
  });
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
        const data = await fetchDefaultTokenPages(params);
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
