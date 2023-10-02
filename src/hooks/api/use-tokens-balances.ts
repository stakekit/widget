import { useSKWallet } from "../wallet/use-sk-wallet";
import { useDefaultTokens } from "./use-default-tokens";
import { useTokenBalancesScan } from "./use-token-balances-scan";

export const useTokensBalances = () => {
  const { isNotConnectedOrReconnecting } = useSKWallet();

  const tokenBalances = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens();

  return isNotConnectedOrReconnecting ? defaultTokens : tokenBalances;
};
