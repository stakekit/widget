import type { YieldBalanceLabelDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { compare, Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { createSelector } from "reselect";
import type { YieldFindValidatorsParams } from "../../../../common/private-api";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useSettings } from "../../../../providers/settings";
import type { SettingsContextType } from "../../../../providers/settings/types";
import { useSKWallet } from "../../../../providers/sk-wallet";
import type {
  YieldBalanceDto,
  YieldBalanceType,
} from "../../../../providers/yield-api-client-provider/types";
import { defaultFormattedNumber } from "../../../../utils";

export const usePositions = () => {
  const { variant } = useSettings();
  const _positionsData = usePositionsData();
  const positionsDataMapped = useMemo(
    () =>
      positionsTableDataSelector({
        positionsData: _positionsData.data,
        variant,
      }),
    [_positionsData.data, variant]
  );

  const positionsData = { ..._positionsData, data: positionsDataMapped };

  const { isConnected } = useSKWallet();

  const showPositions =
    isConnected &&
    (!!positionsData.data.length ||
      (!positionsData.isLoading && !positionsData.isError));

  const listData = useMemo(
    () => ["header" as const, ...positionsData.data],
    [positionsData.data]
  );

  return {
    positionsData,
    listData,
    showPositions,
  };
};

type Input = {
  positionsData: ReturnType<typeof usePositionsData>["data"];
  variant: SettingsContextType["variant"];
};

const positionsTableDataSelector = createSelector(
  (data: Input) => data.positionsData,
  (data: Input) => data.variant,
  (data, variant) =>
    Just([...data.values()])
      .map((val) =>
        val.reduce(
          (acc, val) => {
            [...val.balanceData.entries()].forEach(([id, value]) => {
              Just(
                value.balances.filter((v) =>
                  Just(new BigNumber(v.amount))
                    .filter((v) => !v.isZero() && !v.isNaN())
                    .isJust()
                )
              )
                .filter((v) => !!v.length)
                .ifJust((v) =>
                  acc.push({
                    ...value,
                    integrationId: val.yieldId,
                    balancesWithAmount: v,
                    balanceId: id,
                    allBalances: value.balances,
                    yieldLabelDto: Maybe.empty() as Maybe<YieldBalanceLabelDto>,
                    token: List.head(
                      List.sort(
                        (a, b) =>
                          compare(priorityOrder[a.type], priorityOrder[b.type]),
                        value.balances
                      )
                    ).map((v) => v.token),
                    actionRequired: v.some(
                      (b) => b.type === "locked" || b.type === "claimable"
                    ),
                    pointsRewardTokenBalances: v
                      .filter((v) => !!v.token.isPoints)
                      .map((v) => ({
                        ...v,
                        amount: defaultFormattedNumber(v.amount),
                      })),
                    hasPendingClaimRewards: v.some((balance) =>
                      balance.pendingActions.some(
                        (action) => action.type === "CLAIM_REWARDS"
                      )
                    ),
                  })
                );
            });

            return acc;
          },
          [] as ({
            integrationId: string;
            balancesWithAmount: YieldBalanceDto[];
            allBalances: YieldBalanceDto[];
            balanceId: string;
            actionRequired: boolean;
            pointsRewardTokenBalances: YieldBalanceDto[];
            hasPendingClaimRewards: boolean;
            token: Maybe<YieldBalanceDto["token"]>;
            yieldLabelDto: Maybe<YieldBalanceLabelDto>;
          } & (
            | { type: "validators"; validatorsAddresses: string[] }
            | { type: "default" }
          ))[]
        )
      )
      .map((val) =>
        variant === "zerion"
          ? [...val].sort((a, b) => {
              if (a.hasPendingClaimRewards) return -1;
              if (b.hasPendingClaimRewards) return 1;
              return 0;
            })
          : val
      )
      .unsafeCoerce()
);

const priorityOrder: Record<YieldBalanceType, number> = {
  active: 1,
  entering: 2,
  exiting: 3,
  withdrawable: 4,
  claimable: 5,
  locked: 6,
};

export const getYieldFindValidatorsQueryKey = (
  params?: YieldFindValidatorsParams
) => {
  return ["/v1/yields/validators", ...(params ? [params] : [])] as const;
};
