import {
  type ExtendedYieldType,
  getExtendedYieldType,
} from "@sk-widget/domain/types";
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
    ({
      selectedToken,
      selectedYieldType,
    }: {
      selectedToken: TokenDto;
      selectedYieldType: Maybe<ExtendedYieldType>;
    }) =>
      Maybe.fromNullable(tokenBalancesMap.get(tokenString(selectedToken)))
        .chain((val) =>
          getCachedMultiYields({
            queryClient,
            yieldIds: val.availableYields,
          })
            .chain((yields) =>
              selectedYieldType
                .map((type) =>
                  yields.filter(
                    (yieldDto) => getExtendedYieldType(yieldDto) === type
                  )
                )
                .alt(Maybe.of(yields))
            )
            .map((yields) => ({
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
