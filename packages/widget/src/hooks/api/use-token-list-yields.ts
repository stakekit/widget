import type { TokenBalanceScanResponseDto } from "../../domain/types/token-balance";
import {
  type DashboardYieldCategory,
  getDashboardYieldCategoryForApiYieldType,
} from "../../domain/types/yields";
import type { YieldDto } from "../../generated/api/yield";
import type { useApiClient } from "../../providers/api/api-client-provider";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../utils/formatters";
import {
  fetchYieldSummariesByIds,
  isVisibleYieldSummary,
} from "./use-yield-summaries";

type TokenMaxYieldRate = {
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
