import type {
  YieldBalanceDto,
  YieldBalanceLabelDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { compare, Just, List, type Maybe } from "purify-ts";
import { useMemo } from "react";
import { createSelector } from "reselect";
import type { YieldFindValidatorsParams } from "../../../../common/private-api";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useSettings } from "../../../../providers/settings";
import type { SettingsContextType } from "../../../../providers/settings/types";
import { useSKWallet } from "../../../../providers/sk-wallet";
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
                    integrationId: val.integrationId,
                    balancesWithAmount: v,
                    balanceId: id,
                    allBalances: value.balances,
                    yieldLabelDto: List.find(
                      (b) => !!b.label,
                      value.balances
                    ).chainNullable((v) => v.label),
                    token: List.head(
                      List.sort(
                        (a, b) =>
                          compare(priorityOrder[a.type], priorityOrder[b.type]),
                        value.balances
                      )
                    ).map((v) => ({
                      ...v.token,
                      pricePerShare: v.pricePerShare,
                    })),
                    actionRequired: v.some(
                      (b) => b.type === "locked" || b.type === "unstaked"
                    ),
                    pointsRewardTokenBalances: v
                      .filter((v) => !!v.token.isPoints)
                      .map((v) => ({
                        ...v,
                        amount: defaultFormattedNumber(v.amount),
                      })),
                    hasPendingClaimRewards: List.find(
                      (b) => b.type === "rewards",
                      v
                    )
                      .chain((b) =>
                        List.find(
                          (a) => a.type === "CLAIM_REWARDS",
                          b.pendingActions
                        )
                      )
                      .isJust(),
                  })
                );
            });

            return acc;
          },
          [] as ({
            integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
            balancesWithAmount: YieldBalanceDto[];
            allBalances: YieldBalanceDto[];
            balanceId: YieldBalanceDto["groupId"];
            actionRequired: boolean;
            pointsRewardTokenBalances: YieldBalanceDto[];
            hasPendingClaimRewards: boolean;
            token: Maybe<YieldBalanceDto["token"] & { pricePerShare: string }>;
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

const priorityOrder: { [key in YieldBalanceDto["type"]]: number } = {
  available: 1,
  staked: 2,
  unstaking: 3,
  unstaked: 4,
  preparing: 5,
  locked: 6,
  unlocking: 7,
  rewards: 8,
};

export const getYieldFindValidatorsQueryKey = (
  params?: YieldFindValidatorsParams
) => {
  return ["/v1/yields/validators", ...(params ? [params] : [])] as const;
};
