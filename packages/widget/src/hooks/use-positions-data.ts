import { useMemo } from "react";
import { createSelector } from "reselect";
import {
  type BalanceDataKey,
  getPositionBalanceDataKey,
  type PositionsData,
} from "../domain/types/positions";
import type {
  YieldBalanceDto,
  YieldBalancesByYieldDto,
} from "../providers/yield-api-client-provider/types";
import {
  normalizeYieldBalancesForPosition,
  useYieldBalancesScan,
} from "./api/use-yield-balances-scan";

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
    normalizeYieldBalancesForPosition(balancesData).reduce((acc, val) => {
      acc.set(val.yieldId, {
        yieldId: val.yieldId,
        balanceData: [...val.balances]
          .sort((a, b) =>
            getPositionBalanceDataKey(a).localeCompare(
              getPositionBalanceDataKey(b)
            )
          )
          .reduce((acc, b) => {
            const key = getPositionBalanceDataKey(b);
            const prev = acc.get(key);
            const validatorsAddresses = getBalanceValidatorAddresses(b);

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
                  validatorsAddresses,
                });
              }
            }

            return acc;
          }, new Map<
            BalanceDataKey,
            { balances: YieldBalanceDto[] } & (
              | { type: "validators"; validatorsAddresses: string[] }
              | { type: "default" }
            )
          >()),
      });

      return acc;
    }, new Map() as PositionsData)
);

const getBalanceValidatorAddresses = (balance: YieldBalanceDto) =>
  (
    balance.validators?.map((validator) => validator.address) ??
    (balance.validator?.address ? [balance.validator.address] : [])
  ).filter(Boolean);
