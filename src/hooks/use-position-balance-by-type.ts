import { usePrices } from "./api/use-prices";
import { usePositionData } from "./use-position-data";
import { PriceRequestDto, YieldBalanceDto } from "@stakekit/api-hooks";
import { config } from "../config";
import { tokenToTokenDto } from "../utils/mappers";
import { getBaseToken, getTokenPriceInUSD } from "../domain";
import { Token } from "@stakekit/common";
import { useMemo } from "react";
import { PositionBalancesByType } from "../domain/types/positions";
import { createSelector } from "reselect";
import { Prices } from "../domain/types";
import BigNumber from "bignumber.js";

export const usePositionBalanceByType = (
  position: ReturnType<typeof usePositionData>["position"],
  defaultOrValidatorId: "default" | (string & {})
) => {
  const positionsByValidatorOrDefault = position.map(
    (p) => p.balanceData[defaultOrValidatorId]
  );

  const prices = usePrices(
    useMemo(
      () =>
        positionsByValidatorOrDefault
          .map<PriceRequestDto>((val) => ({
            currency: config.currency,
            tokenList: val.flatMap((v, i) =>
              i === 0
                ? [tokenToTokenDto(getBaseToken(v.token as Token)), v.token]
                : [v.token]
            ),
          }))
          .extractNullable(),
      [positionsByValidatorOrDefault]
    )
  );

  /**
   * @summary Position balance by type
   */
  return useMemo(
    () =>
      positionsByValidatorOrDefault.map((val) =>
        getPositionBalanceByTypeWithPrices({ prices: prices.data, pvd: val })
      ),
    [positionsByValidatorOrDefault, prices.data]
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
            token: cur.token as Token,
            pricePerShare: cur.pricePerShare,
          })
        : new BigNumber(0);

      acc.set(cur.type, { ...cur, tokenPriceInUsd });

      return acc;
    }, new Map() as PositionBalancesByType)
);
