import {
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { useMemo } from "react";
import { useYieldBalancesScan } from "./api/use-yield-balances-scan";
import { Maybe } from "purify-ts";

export const usePositionsData = () => {
  const yieldYieldBalancesScan = useYieldBalancesScan();

  return {
    ...yieldYieldBalancesScan,
    data: useMemo<ReturnType<typeof positionsDataSelector>>(
      () =>
        Maybe.fromNullable(yieldYieldBalancesScan.data)
          .map(positionsDataSelector)
          .orDefault(new Map()),
      [yieldYieldBalancesScan.data]
    ),
  };
};

type ValidatorAddress = NonNullable<YieldBalanceDto["validatorAddress"]>;

const positionsDataSelector = createSelector(
  (balancesData: YieldBalancesWithIntegrationIdDto[]) => balancesData,
  (balancesData) =>
    balancesData.reduce(
      (acc, val) => {
        acc.set(val.integrationId, {
          integrationId: val.integrationId,
          balanceData: val.balances.reduce(
            (acc, b) => {
              if (b.validatorAddress) {
                if (!acc[b.validatorAddress]) acc[b.validatorAddress] = [];
                acc[b.validatorAddress].push(b);
              } else {
                if (!acc["default"]) acc["default"] = [];
                acc["default"].push(b);
              }
              return acc;
            },
            {} as {
              default: YieldBalanceDto[];
            } & Record<ValidatorAddress, YieldBalanceDto[]>
          ),
        });

        return acc;
      },
      new Map<
        YieldBalancesWithIntegrationIdDto["integrationId"],
        {
          integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
          balanceData: {
            default: YieldBalanceDto[];
          } & Record<ValidatorAddress, YieldBalanceDto[]>;
        }
      >()
    )
);
