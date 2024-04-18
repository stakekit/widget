import type {
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { useYieldBalancesScan } from "./api/use-yield-balances-scan";
import { useMemo } from "react";

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
    balancesData.reduce(
      (acc, val) => {
        acc.set(val.integrationId, {
          integrationId: val.integrationId,
          balanceData: [...val.balances]
            .sort((a, b) => (a.groupId ?? "").localeCompare(b.groupId ?? ""))
            .reduce((acc, b) => {
              const prev = acc.get(b.groupId);

              if (prev) {
                prev.balances.push(b);
              } else {
                if (b.validatorAddresses || b.validatorAddress) {
                  acc.set(b.groupId, {
                    balances: [b],
                    type: "validators",
                    validatorsAddresses: b.validatorAddresses ?? [
                      b.validatorAddress!,
                    ],
                  });
                } else {
                  acc.set(b.groupId, {
                    balances: [b],
                    type: "default",
                  });
                }
              }

              return acc;
            }, new Map<YieldBalanceDtoID, { balances: YieldBalanceDto[] } & ({ type: "validators"; validatorsAddresses: string[] } | { type: "default" })>()),
        });

        return acc;
      },
      new Map<
        YieldBalancesWithIntegrationIdDto["integrationId"],
        {
          integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
          balanceData: Map<
            YieldBalanceDtoID,
            { balances: YieldBalanceDto[] } & (
              | { type: "validators"; validatorsAddresses: string[] }
              | { type: "default" }
            )
          >;
        }
      >()
    )
);
