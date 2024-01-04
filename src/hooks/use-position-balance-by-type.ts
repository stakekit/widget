import { usePrices } from "./api/use-prices";
import { PriceRequestDto, YieldBalanceDto } from "@stakekit/api-hooks";
import { config } from "../config";
import { tokenToTokenDto } from "../utils/mappers";
import { getBaseToken, getTokenPriceInUSD } from "../domain";
import { useMemo } from "react";
import { PositionBalancesByType } from "../domain/types/positions";
import { createSelector } from "reselect";
import { Prices } from "../domain/types";
import BigNumber from "bignumber.js";
import { usePositionBalances } from "./use-position-balances";

export const usePositionBalanceByType = (
  positionBalancesData: ReturnType<typeof usePositionBalances>["data"]
) => {
  const prices = usePrices(
    useMemo(
      () =>
        positionBalancesData
          .map<PriceRequestDto>((val) => ({
            currency: config.currency,
            tokenList: val.balances.flatMap((v, i) =>
              i === 0
                ? [tokenToTokenDto(getBaseToken(v.token)), v.token]
                : [v.token]
            ),
          }))
          .extractNullable(),
      [positionBalancesData]
    )
  );

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
