import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TokenDto } from "../../domain/types/tokens";
import {
  type DashboardYieldCategory,
  dashboardYieldCategories,
  getApiYieldTypesForDashboardCategory,
} from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKWallet } from "../../providers/sk-wallet";
import {
  DEFAULT_YIELD_SUMMARIES_PAGE_LIMIT,
  fetchYieldSummariesPage,
  getYieldSummariesQueryKey,
  isVisibleYieldSummary,
  type YieldSummariesParams,
  type YieldSummary,
} from "./use-yield-summaries";

type DashboardCategoryInitialSelection = {
  token: TokenDto;
  yieldDto: YieldSummary;
  yieldId: string;
};

const staleTime = 1000 * 60 * 2;

/**
 * Discovers available dashboard earn categories with one network-scoped,
 * reward-rate-sorted probe per category (no dependency on the wallet's token
 * holdings, no per-yield legacy hydration). The first visible summary of each
 * probe seeds that category's initial token + yield selection.
 */
export const useDashboardYieldCatalog = ({
  enabled = true,
  network,
}: {
  enabled?: boolean;
  network?: TokenDto["network"] | null;
} = {}) => {
  const { network: walletNetwork } = useSKWallet();
  const apiClient = useApiClient();

  const catalogNetwork = network ?? walletNetwork;
  const probeEnabled = enabled && !!catalogNetwork;

  const results = useQueries({
    queries: dashboardYieldCategories.map((category) => {
      const params: YieldSummariesParams = {
        network: catalogNetwork ?? undefined,
        types: getApiYieldTypesForDashboardCategory(category),
        sort: "rewardRateDesc",
        limit: DEFAULT_YIELD_SUMMARIES_PAGE_LIMIT,
      };

      return {
        enabled: probeEnabled,
        staleTime,
        queryKey: getYieldSummariesQueryKey(params),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchYieldSummariesPage({ apiClient, params, signal }),
      };
    }),
  });

  return useMemo(() => {
    const initialSelectionByCategory = new Map<
      DashboardYieldCategory,
      DashboardCategoryInitialSelection
    >();
    const availableCategories: DashboardYieldCategory[] = [];

    dashboardYieldCategories.forEach((category, index) => {
      const firstVisible = (results[index]?.data ?? []).find(
        isVisibleYieldSummary
      );

      if (!firstVisible) return;

      availableCategories.push(category);
      initialSelectionByCategory.set(category, {
        token: firstVisible.token,
        yieldDto: firstVisible,
        yieldId: firstVisible.id,
      });
    });

    return {
      availableCategories,
      initialSelectionByCategory,
      isLoading: probeEnabled && results.some((result) => result.isLoading),
    };
  }, [results, probeEnabled]);
};
