import { Maybe } from "purify-ts";
import { useCallback } from "react";
import { tokenString } from "../../../../domain";
import type { TokenBalanceScanResponseDto } from "../../../../domain/types/token-balance";
import type { TokenDto } from "../../../../domain/types/tokens";
import type { DashboardYieldCategory } from "../../../../domain/types/yields";
import { getCachedFirstEligibleYield } from "../../../../hooks/api/use-multi-yields";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useTokenBalancesMap } from "./use-token-balances-map";

export const useGetInitYield = () => {
  const queryClient = useSKQueryClient();
  const tokenBalancesMap = useTokenBalancesMap();

  return useCallback(
    ({
      availableYields,
      selectedDashboardYieldCategory,
      selectedToken,
    }: {
      availableYields?: TokenBalanceScanResponseDto["availableYields"];
      selectedDashboardYieldCategory?: DashboardYieldCategory | null;
      selectedToken: TokenDto;
    }) =>
      (availableYields
        ? Maybe.of({ availableYields })
        : Maybe.fromNullable(tokenBalancesMap.get(tokenString(selectedToken)))
      ).chain((val) =>
        getCachedFirstEligibleYield({
          dashboardYieldCategory: selectedDashboardYieldCategory,
          queryClient,
          yieldIds: val.availableYields,
        })
      ),
    [queryClient, tokenBalancesMap]
  );
};
