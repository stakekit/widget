import type { PositionsData } from "@sk-widget/domain/types/positions";
import type {
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { useMemo } from "react";
import { createSelector } from "reselect";
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

type YieldBalanceDtoID = YieldBalanceDto["groupId"];

const positionsDataSelector = createSelector(
  (balancesData: YieldBalancesWithIntegrationIdDto[]) => balancesData,
  (balancesData) =>
    balancesData.reduce((acc, val) => {
      acc.set(val.integrationId, {
        integrationId: val.integrationId,
        balanceData: val.balances
          .toSorted((a, b) => (a.groupId ?? "").localeCompare(b.groupId ?? ""))
          .reduce((acc, b) => {
            const prev = acc.get(b.groupId);

            if (prev) {
              prev.balances.push(b);
            } else {
              if (b.validatorAddresses || b.validatorAddress || b.providerId) {
                acc.set(b.groupId, {
                  balances: [b],
                  type: "validators",
                  validatorsAddresses:
                    b.validatorAddresses ??
                    (b.providerId ? [b.providerId] : [b.validatorAddress!]),
                });
              } else {
                acc.set(b.groupId, {
                  balances: [b],
                  type: "default",
                });
              }
            }

            return acc;
          }, new Map<
            YieldBalanceDtoID,
            { balances: YieldBalanceDto[] } & (
              | { type: "validators"; validatorsAddresses: string[] }
              | { type: "default" }
            )
          >()),
      });

      return acc;
    }, new Map() as PositionsData)
);
