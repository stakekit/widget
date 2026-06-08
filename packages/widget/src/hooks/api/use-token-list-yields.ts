import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TokenBalanceScanResponseDto } from "../../domain/types/token-balance";
import { tokenString } from "../../domain/types/tokens";
import type { YieldDto } from "../../generated/api/yield";
import { useApiClient } from "../../providers/api/api-client-provider";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../utils/formatters";

const staleTime = 1000 * 60 * 2;

export type TokenMaxYieldRate = {
  rateFormatted: string;
  rateTypeLabel: string;
};

const getUniqueYieldIds = (
  tokenBalances: ReadonlyArray<TokenBalanceScanResponseDto>
) => [...new Set(tokenBalances.flatMap((tb) => tb.availableYields))];

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
  tokenBalances: ReadonlyArray<TokenBalanceScanResponseDto>
) => {
  const apiClient = useApiClient();
  const yieldIds = getUniqueYieldIds(tokenBalances);

  const query = useQuery({
    queryKey: ["token-list-yields", yieldIds],
    enabled: yieldIds.length > 0,
    staleTime,
    queryFn: async ({ signal }) => {
      const client = apiClient.withOptions({ signal });
      const result = await client.yield.YieldsControllerGetYields({
        params: {
          yieldIds,
          limit: yieldIds.length,
        },
      });

      return result.items ?? [];
    },
  });

  const yieldsById = new Map(
    (query.data ?? []).map((yieldDto) => [yieldDto.id, yieldDto])
  );

  const maxYieldRatesByToken = useMemo(() => {
    const map = new Map<string, TokenMaxYieldRate>();

    for (const tokenBalance of tokenBalances) {
      const maxYieldRate = getMaxYieldRateForToken(
        tokenBalance.availableYields,
        yieldsById
      );

      if (maxYieldRate) {
        map.set(tokenString(tokenBalance.token), maxYieldRate);
      }
    }

    return map;
  }, [tokenBalances, yieldsById]);

  return {
    maxYieldRatesByToken,
    isLoading: query.isLoading,
  };
};
