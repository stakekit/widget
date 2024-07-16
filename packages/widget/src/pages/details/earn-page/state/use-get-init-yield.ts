import type { TokenDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useCallback } from "react";
import { tokenString } from "../../../../domain";
import { getInitialYield } from "../../../../domain/types/stake";
import { getCachedMultiYields } from "../../../../hooks/api/use-multi-yields";
import { useInitParams } from "../../../../hooks/use-init-params";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useTokenBalancesMap } from "./use-token-balances-map";

export const useGetInitYield = () => {
  const initParams = useInitParams();
  const queryClient = useSKQueryClient();
  const tokenBalancesMap = useTokenBalancesMap();

  return useCallback(
    ({ selectedToken }: { selectedToken: TokenDto }) =>
      Maybe.fromNullable(tokenBalancesMap.get(tokenString(selectedToken)))
        .chain((val) =>
          getCachedMultiYields({
            queryClient,
            yieldIds: val.availableYields,
          }).map((yields) => ({
            yields,
            availableAmount: new BigNumber(val.amount),
          }))
        )
        .chain((val) =>
          getInitialYield({
            initQueryParams: Maybe.fromNullable(initParams.data),
            yieldDtos: val.yields,
            tokenBalanceAmount: val.availableAmount,
          })
        ),
    [initParams.data, queryClient, tokenBalancesMap]
  );
};
