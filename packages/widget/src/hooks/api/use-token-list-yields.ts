import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TokenBalanceScanResponseDto } from "../../domain/types/token-balance";
import { tokenString } from "../../domain/types/tokens";
import {
  type DashboardYieldCategory,
  getDashboardYieldCategoryForApiYieldType,
} from "../../domain/types/yields";
import type { YieldDto } from "../../generated/api/yield";
import { useApiClient } from "../../providers/api/api-client-provider";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../utils/formatters";
import {
  fetchYieldSummariesByIds,
  isVisibleYieldSummary,
} from "./use-yield-summaries";

const staleTime = 1000 * 60 * 2;

export type TokenMaxYieldRate = {
  rateFormatted: string;
  rateTypeLabel: string;
};

const getUniqueYieldIds = (
  tokenBalances: ReadonlyArray<TokenBalanceScanResponseDto>
) => [...new Set(tokenBalances.flatMap((tb) => tb.availableYields))];

export const fetchTokenListYieldSummaries = ({
  apiClient,
  signal,
  tokenBalances,
}: {
  apiClient: ReturnType<typeof useApiClient>;
  signal?: AbortSignal;
  tokenBalances: ReadonlyArray<TokenBalanceScanResponseDto>;
}) =>
  fetchYieldSummariesByIds({
    apiClient,
    signal,
    yieldIds: getUniqueYieldIds(tokenBalances),
  });

export const getDashboardCategoryYieldIdsForToken = (
  availableYieldIds: ReadonlyArray<string>,
  yieldsById: ReadonlyMap<string, YieldDto>,
  category: DashboardYieldCategory
) =>
  availableYieldIds
    .filter((id) => {
      const yieldDto = yieldsById.get(id);

      return (
        !!yieldDto &&
        isVisibleYieldSummary(yieldDto) &&
        getDashboardYieldCategoryForApiYieldType(yieldDto.mechanics.type) ===
          category
      );
    })
    .sort((a, b) => {
      const left = yieldsById.get(a)?.rewardRate?.total ?? 0;
      const right = yieldsById.get(b)?.rewardRate?.total ?? 0;

      return right - left;
    });

export const getMaxYieldRateForToken = (
  availableYieldIds: ReadonlyArray<string>,
  yieldsById: ReadonlyMap<string, YieldDto>
): TokenMaxYieldRate | null => {
  const yields = availableYieldIds
    .map((id) => yieldsById.get(id))
    .filter((yieldDto): yieldDto is YieldDto => !!yieldDto);

  if (yields.length === 0) {
    return null;
  }

  const maxYield = yields.reduce((max, yieldDto) =>
    (yieldDto.rewardRate?.total ?? 0) > (max.rewardRate?.total ?? 0)
      ? yieldDto
      : max
  );

  const rewardType = maxYield.rewardRate?.rateType;
  const rateFormatted = getRewardRateFormatted({
    rewardRate: maxYield.rewardRate?.total,
  });

  const rateTypeLabel = getRewardTypeFormatted(rewardType);

  if (rateFormatted === "- %" || !rateTypeLabel) {
    return null;
  }

  return {
    rateFormatted,
    rateTypeLabel,
  };
};

export const useTokenListYields = (
  tokenBalances: ReadonlyArray<TokenBalanceScanResponseDto>,
  dashboardYieldCategory?: DashboardYieldCategory | null
) => {
  const apiClient = useApiClient();
  const yieldIds = getUniqueYieldIds(tokenBalances);

  const query = useQuery({
    queryKey: ["token-list-yields", yieldIds],
    enabled: yieldIds.length > 0,
    staleTime,
    queryFn: async ({ signal }) =>
      fetchTokenListYieldSummaries({
        apiClient,
        signal,
        tokenBalances,
      }),
  });

  const yieldsById = useMemo(
    () =>
      new Map((query.data ?? []).map((yieldDto) => [yieldDto.id, yieldDto])),
    [query.data]
  );

  const yieldIdsByToken = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const tokenBalance of tokenBalances) {
      map.set(
        tokenString(tokenBalance.token),
        dashboardYieldCategory
          ? getDashboardCategoryYieldIdsForToken(
              tokenBalance.availableYields,
              yieldsById,
              dashboardYieldCategory
            )
          : [...tokenBalance.availableYields]
      );
    }

    return map;
  }, [dashboardYieldCategory, tokenBalances, yieldsById]);

  const yieldCountsByToken = useMemo(
    () =>
      new Map(
        [...yieldIdsByToken.entries()].map(([token, tokenYieldIds]) => [
          token,
          tokenYieldIds.length,
        ])
      ),
    [yieldIdsByToken]
  );

  const maxYieldRatesByToken = useMemo(() => {
    const map = new Map<string, TokenMaxYieldRate>();

    for (const tokenBalance of tokenBalances) {
      const maxYieldRate = getMaxYieldRateForToken(
        yieldIdsByToken.get(tokenString(tokenBalance.token)) ?? [],
        yieldsById
      );

      if (maxYieldRate) {
        map.set(tokenString(tokenBalance.token), maxYieldRate);
      }
    }

    return map;
  }, [tokenBalances, yieldIdsByToken, yieldsById]);

  return {
    yieldIdsByToken,
    yieldCountsByToken,
    maxYieldRatesByToken,
    isLoading: query.isLoading,
  };
};
