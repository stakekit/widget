import {
  YieldBalanceDto,
  YieldBalancesWithMetadataDto,
  getYieldGetMultipleYieldBalancesQueryKey,
  useStakeKitQueryClient,
} from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { useCallback, useMemo } from "react";
import { useYieldYieldBalancesScan } from "./api/use-yield-balances-scan";

export const usePositionsData = () => {
  const yieldYieldBalancesScan = useYieldYieldBalancesScan();

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
  (balancesData: YieldBalancesWithMetadataDto[]) => balancesData,
  (balancesData) =>
    balancesData.reduce(
      (acc, val) => {
        acc.set(val.id, {
          integrationData: val,
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
        YieldBalancesWithMetadataDto["id"],
        {
          integrationData: Omit<YieldBalancesWithMetadataDto, "balances">;
          balanceData: {
            default: YieldBalanceDto[];
          } & Record<ValidatorAddress, YieldBalanceDto[]>;
        }
      >()
    )
);

export const useInvalidateBalances = () => {
  const queryClient = useStakeKitQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [getYieldGetMultipleYieldBalancesQueryKey({} as any)[0]],
    });
  }, [queryClient]);
};
