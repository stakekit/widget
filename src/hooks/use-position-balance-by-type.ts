import type { usePrices } from "./api/use-prices";
import type { TokenDto, YieldBalanceDto } from "@stakekit/api-hooks";
import { getTokenPriceInUSD } from "../domain";
import { useMemo } from "react";
import type { PositionBalancesByType } from "../domain/types/positions";
import { createSelector } from "reselect";
import type { Prices } from "../domain/types";
import BigNumber from "bignumber.js";
import type { usePositionBalances } from "./use-position-balances";
import { Maybe } from "purify-ts";

export const usePositionBalanceByType = ({
  positionBalancesData,
  prices,
  baseToken,
}: {
  positionBalancesData: ReturnType<typeof usePositionBalances>["data"];
  prices: ReturnType<typeof usePrices>;
  baseToken: Maybe<TokenDto>;
}) => {
  /**
   * @summary Position balance by type
   */
  return useMemo(
    () =>
      Maybe.fromRecord({ positionBalancesData, baseToken }).map((val) =>
        getPositionBalanceByTypeWithPrices({
          baseToken: val.baseToken,
          prices: prices.data,
          pvd: val.positionBalancesData.balances,
        })
      ),
    [positionBalancesData, prices, baseToken]
  );
};

type Args = {
  prices: Prices | undefined;
  pvd: YieldBalanceDto[];
  baseToken: TokenDto;
};

const selectPrices = (val: Args) => val.prices;
const selectPvd = (val: Args) => val.pvd;
const selectBaseToken = (val: Args) => val.baseToken;

const getPositionBalanceByTypeWithPrices = createSelector(
  selectPrices,
  selectPvd,
  selectBaseToken,
  (prices, pvd, baseToken) =>
    pvd.reduce((acc, cur) => {
      const amount = new BigNumber(cur.amount);
      if (amount.isZero() || amount.isNaN()) return acc;

      const tokenPriceInUsd = prices
        ? getTokenPriceInUSD({
            amount: cur.amount,
            prices,
            token: cur.token,
            pricePerShare: cur.pricePerShare,
            baseToken,
          })
        : new BigNumber(0);

      const prev = acc.get(cur.type);

      acc.set(cur.type, [...(prev ?? []), { ...cur, tokenPriceInUsd }]);

      return acc;
    }, new Map() as PositionBalancesByType)
);
