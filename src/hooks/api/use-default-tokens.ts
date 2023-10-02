import {
  TokenBalanceScanResponseDto,
  useTokenGetTokens,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../wallet/use-sk-wallet";

export const useDefaultTokens = () =>
  useTokenGetTokens(undefined, {
    query: {
      enabled: useSKWallet().isNotConnectedOrReconnecting,
      staleTime: 1000 * 60 * 5,
      select: (data) =>
        data.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" })),
    },
  });
