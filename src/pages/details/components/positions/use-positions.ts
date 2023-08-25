import { usePositionsData } from "../../../../hooks/use-positions-data";
import { createSelector } from "reselect";
import BigNumber from "bignumber.js";

export const usePositions = () => {
  const { positionsData, isLoading } = usePositionsData();

  const tableData = positionsTableDataSelector(positionsData);

  return {
    isLoading,
    tableData,
  };
};

export const positionsTableDataSelector = createSelector(
  (data: ReturnType<typeof usePositionsData>["positionsData"]) => data,
  (data) =>
    [...data.values()].filter((p) => {
      return p.balanceData.balances.some((b) => {
        const amount = new BigNumber(b.amount);

        return !amount.isZero() && !amount.isNaN();
      });
    })
);
