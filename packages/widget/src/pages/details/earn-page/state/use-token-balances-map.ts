import { useDefaultTokens } from "../../../../hooks/api/use-default-tokens";
import { useTokenBalancesScan } from "../../../../hooks/api/use-token-balances-scan";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

export const useTokenBalancesMap = () => {
  const tokenBalancesScan = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens();

  return useGetTokenBalancesMap()({
    defaultTokens: defaultTokens.data ?? [],
    tokenBalancesScan: tokenBalancesScan.data ?? [],
  });
};
