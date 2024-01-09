import {
  TokenBalanceScanResponseDto,
  TokenWithAvailableYieldsDto,
  useTokenGetTokens,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { createSelector } from "reselect";

export const useDefaultTokens = () => {
  const { network, isConnected, isConnecting } = useSKWallet();

  return useTokenGetTokens(
    { network: network ?? undefined },
    {
      query: {
        enabled: !isConnected && !isConnecting,
        staleTime: 1000 * 60 * 5,
        select: defaultTokensSelector,
      },
    }
  );
};

const defaultTokensSelector = createSelector(
  (val: TokenWithAvailableYieldsDto[]) => val,
  (val) => val.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" }))
);
