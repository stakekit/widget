import { usePositionsData } from "../../../hooks/use-positions-data";
import { createSelector } from "reselect";
import BigNumber from "bignumber.js";
import { YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";

export const usePositions = () => {
  const { data, isLoading } = usePositionsData();

  const tableData = positionsTableDataSelector(data);

  return {
    isLoading,
    tableData,
  };
};

/**
 *
 * @summary This selector is used to map object with all default + validator balances to a map
 */
export const positionsTableDataSelector = createSelector(
  (data: ReturnType<typeof usePositionsData>["data"]) => data,
  (data) => {
    return [...data.values()].reduce(
      (acc, val) => {
        Object.entries(val.balanceData).forEach(([key, value]) => {
          if (
            value.some((v) => {
              const amount = new BigNumber(v.amount);

              return !amount.isZero() && !amount.isNaN();
            })
          ) {
            acc.push({
              integrationData: val.integrationData,
              balances: value,
              defaultOrValidatorId: key,
            });
          }
        });

        return acc;
      },
      [] as {
        integrationData: YieldDto;
        balances: YieldBalanceDto[];
        defaultOrValidatorId: "default" | (string & {}); // either default balance or balance by validator
      }[]
    );
  }
);
