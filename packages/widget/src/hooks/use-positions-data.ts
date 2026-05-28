import { useMemo } from "react";
import { createSelector } from "reselect";
import {
  type BalanceDataKey,
  getPositionBalanceDataKey,
  type PositionsData,
  type YieldBalanceDto,
  type YieldBalancesByYieldDto,
} from "../domain/types/positions";
import { useYieldBalancesScan } from "./api/use-yield-balances-scan";

export const usePositionsData = () => {
  const { data, ...rest } = useYieldBalancesScan({
    select: positionsDataSelector,
  });

  const val = useMemo<NonNullable<typeof data>>(
    () => data ?? new Map(),
    [data]
  );

  return { data: val, ...rest };
};

const positionsDataSelector = createSelector(
  (balancesData: YieldBalancesByYieldDto[]) => balancesData,
  (balancesData) =>
    balancesData.reduce((acc, val) => {
      acc.set(val.yieldId, {
        yieldId: val.yieldId,
        rewardRate: val.rewardRate,
        balanceData: [...val.balances]
          .sort((a, b) =>
            getPositionBalanceDataKey(a).localeCompare(
              getPositionBalanceDataKey(b)
            )
          )
          .reduce(
            (acc, b) => {
              const key = getPositionBalanceDataKey(b);
              const prev = acc.get(key);
              const validators = getBalanceValidators(b);

              if (prev) {
                prev.balances.push(b);
              } else {
                if (key === "default") {
                  acc.set(key, {
                    balances: [b],
                    type: "default",
                  });
                } else {
                  acc.set(key, {
                    balances: [b],
                    type: "validators",
                    validators,
                  });
                }
              }

              return acc;
            },
            new Map<
              BalanceDataKey,
              { balances: YieldBalanceDto[] } & (
                | {
                    type: "validators";
                    validators: NonNullable<YieldBalanceDto["validators"]>;
                  }
                | { type: "default" }
              )
            >()
          ),
      });

      return acc;
    }, new Map() as PositionsData)
);

const getBalanceValidators = (balance: YieldBalanceDto) =>
  balance.validators ?? (balance.validator ? [balance.validator] : []);
