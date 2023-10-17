import {
  TokenBalanceScanResponseDto,
  useTokenGetTokens,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";

export const useDefaultTokens = () =>
  useTokenGetTokens(
    { network: useSKWallet().network ?? undefined },
    {
      query: {
        staleTime: 1000 * 60 * 5,
        select: (data) =>
          data.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" })),
      },
    }
  );
