import type { DashboardYieldCategory } from "../../../../domain/types/yields";
import { useDefaultTokens } from "../../../../hooks/api/use-default-tokens";
import { useTokenBalancesScan } from "../../../../hooks/api/use-token-balances-scan";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

export const useTokenBalancesMap = ({
  selectedDashboardYieldCategory,
}: {
  selectedDashboardYieldCategory?: DashboardYieldCategory | null;
} = {}) => {
  const tokenBalancesScan = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens({
    yieldCategory: selectedDashboardYieldCategory,
  });

  return useGetTokenBalancesMap()({
    defaultTokens: defaultTokens.data ?? [],
    tokenBalancesScan: tokenBalancesScan.data ?? [],
  });
};
