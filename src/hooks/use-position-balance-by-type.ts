import { usePrices } from "./api/use-prices";
import { YieldBalanceDto } from "@stakekit/api-hooks";
import { getTokenPriceInUSD } from "../domain";
import { useMemo } from "react";
import { PositionBalancesByType } from "../domain/types/positions";
import { createSelector } from "reselect";
import { Prices } from "../domain/types";
import BigNumber from "bignumber.js";
import { usePositionBalances } from "./use-position-balances";

export const usePositionBalanceByType = ({
  positionBalancesData,
  prices,
}: {
  positionBalancesData: ReturnType<typeof usePositionBalances>["data"];
  prices: ReturnType<typeof usePrices>;
}) => {
  /**
   * @summary Position balance by type
   */
  return useMemo(
    () =>
      positionBalancesData.map((val) =>
        getPositionBalanceByTypeWithPrices({
          prices: prices.data,
          pvd: val.balances,
        })
      ),
    [positionBalancesData, prices.data]
  );
};

const selectPrices = (val: {
  prices: Prices | undefined;
  pvd: YieldBalanceDto[];
}) => val.prices;

const selectPvd = (val: {
  prices: Prices | undefined;
  pvd: YieldBalanceDto[];
}) => val.pvd;

const getPositionBalanceByTypeWithPrices = createSelector(
  selectPrices,
  selectPvd,
  (prices, pvd) =>
    pvd.reduce((acc, cur) => {
      const amount = new BigNumber(cur.amount);
      if (amount.isZero() || amount.isNaN()) return acc;

      const tokenPriceInUsd = prices
        ? getTokenPriceInUSD({
            amount: cur.amount,
            prices,
            token: cur.token,
            pricePerShare: cur.pricePerShare,
          })
        : new BigNumber(0);

      const prev = acc.get(cur.type);

      acc.set(cur.type, [...(prev ?? []), { ...cur, tokenPriceInUsd }]);

      return acc;
    }, new Map() as PositionBalancesByType)
);
