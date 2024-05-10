import type { TokenDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { useTokenBalancesMap } from "./use-token-balances-map";
import { useMemo } from "react";
import { tokenString } from "../../domain";
import BigNumber from "bignumber.js";

export const useTokenBalance = ({
  selectedToken,
}: {
  selectedToken: Maybe<TokenDto>;
}) => {
  const tokenBalancesMap = useTokenBalancesMap();

  const tokenBalance = useMemo(
    () =>
      selectedToken.chainNullable((val) =>
        tokenBalancesMap.get(tokenString(val))
      ),
    [selectedToken, tokenBalancesMap]
  );

  const availableAmount = useMemo(
    () => tokenBalance.map((v) => new BigNumber(v.amount)),
    [tokenBalance]
  );

  const availableYields = useMemo(
    () => tokenBalance.map((v) => v.availableYields),
    [tokenBalance]
  );

  return {
    availableAmount,
    availableYields,
    tokenBalance,
  };
};
