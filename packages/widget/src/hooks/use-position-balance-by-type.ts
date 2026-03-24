import BigNumber from "bignumber.js";
import { useMemo } from "react";
import { createSelector } from "reselect";
import type { PositionBalancesByType } from "../domain/types/positions";
import type { YieldBalanceDto } from "../providers/yield-api-client-provider/types";
import type { usePositionBalances } from "./use-position-balances";

export const usePositionBalanceByType = ({
  positionBalancesData,
}: {
  positionBalancesData: ReturnType<typeof usePositionBalances>["data"];
}) => {
  /**
   * @summary Position balance by type
   */
  return useMemo(
    () =>
      positionBalancesData.map((val) =>
        getPositionBalanceByTypeWithUsd({
          pvd: val.balances,
        })
      ),
    [positionBalancesData]
  );
};

type Args = {
  pvd: YieldBalanceDto[];
};

const selectPvd = (val: Args) => val.pvd;

export const getPositionBalanceByTypeWithUsd = createSelector(
  selectPvd,
  (pvd) =>
    pvd.reduce((acc, cur) => {
      const amount = new BigNumber(cur.amount);
      if (amount.isZero() || amount.isNaN()) return acc;

      const tokenPriceInUsd = new BigNumber(
        String(cur.amountUsd ?? 0).replace(/,/g, "")
      );

      const prev = acc.get(cur.type);

      acc.set(cur.type, [...(prev ?? []), { ...cur, tokenPriceInUsd }]);

      return acc;
    }, new Map() as PositionBalancesByType)
);
