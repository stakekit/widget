import {
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { useMemo } from "react";
import { useYieldBalancesScan } from "./api/use-yield-balances-scan";

export const usePositionsData = () => {
  const yieldYieldBalancesScan = useYieldBalancesScan();

  const data = useMemo<ReturnType<typeof positionsDataSelector>>(() => {
    return yieldYieldBalancesScan.data
      ? positionsDataSelector(yieldYieldBalancesScan.data)
      : new Map();
  }, [yieldYieldBalancesScan.data]);

  return {
    ...yieldYieldBalancesScan,
    data,
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
