import type { StakeKitErrorDto, YieldDto } from "@stakekit/api-hooks";
import type { UseQueryResult } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { createContext, useCallback, useContext, useMemo } from "react";
import { config } from "../config";
import { getBaseToken, getTokenPriceInUSD } from "../domain";
import { getPositionTotalAmount } from "../domain/types/positions";
import type { Prices } from "../domain/types/price";
import type { EnabledRewardsSummaryYieldId } from "../domain/types/rewards";
import { usePositions } from "../pages/details/positions-page/hooks/use-positions";
import { useMultiYields } from "./api/use-multi-yields";
import { usePrices } from "./api/use-prices";
import { useTokenBalancesScan } from "./api/use-token-balances-scan";
import { getProviderDetails } from "./use-provider-details";
import {
  type RewardsSummaryResult,
  useMultiRewardsSummary,
} from "./use-rewards-summary";

const SummaryContext = createContext<
  | {
      allPositionsQuery: {
        data:
          | {
              allPositions: {
                yieldName: string;
                usdAmount: number;
                providerDetails: ReturnType<typeof getProviderDetails>;
              }[];
              allPositionsSum: BigNumber;
            }
          | undefined;
        isLoading: boolean;
      };
      rewardsPositionsQuery: UseQueryResult<
        {
          rewardsPositions: {
            yieldName: string;
            total: BigNumber;
            lastMonth: BigNumber;
            lastWeek: BigNumber;
          }[];
          rewardsPositionsTotalSum: BigNumber;
          rewardsPositionsLastMonthSum: BigNumber;
          rewardsPositionsLastWeekSum: BigNumber;
        },
        StakeKitErrorDto
      >;
      averageApyQuery: {
        data: BigNumber | undefined;
        isLoading: boolean;
      };
      availableBalanceSumQuery: UseQueryResult<BigNumber, StakeKitErrorDto>;
    }
  | undefined
>(undefined);

export const SummaryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { positionsData } = usePositions();

  const yieldIds = useMemo(
    () => [...new Set(positionsData.data.map((p) => p.integrationId)).values()],
    [positionsData.data]
  );

  const multiYieldsMapQuery = useMultiYields(yieldIds, {
    select: useCallback(
      (val: YieldDto[]) => new Map(val.map((y) => [y.id, y])),
      []
    ),
  });

  const rewardsSummaryQuery = useMultiRewardsSummary(yieldIds, {
    select: useCallback(
      (val: RewardsSummaryResult) =>
        Object.keys(val).reduce((acc, key) => {
          const item = val[key as EnabledRewardsSummaryYieldId];

          if (BigNumber(item.rewards.total).gt(0)) {
            acc[key as EnabledRewardsSummaryYieldId] = item;
          }

          return acc;
        }, {} as RewardsSummaryResult),
      []
    ),
  });

  const allPositionsQuery = useMemo(() => {
    if (!multiYieldsMapQuery.data) {
      return {
        data: undefined as undefined,
        isLoading: multiYieldsMapQuery.isLoading,
      };
    }

    const allPositions = positionsData.data.flatMap((p) => {
      const yieldDto = multiYieldsMapQuery.data.get(p.integrationId);

      if (!yieldDto) return [];

      const positionTotalAmount = getPositionTotalAmount(p.balancesWithAmount);

      const yields = [...multiYieldsMapQuery.data.values()];

      const providerDetails = getProviderDetails({
        integrationData: Maybe.of(yieldDto),
        validatorAddress:
          p.type === "validators"
            ? List.head(p.validatorsAddresses)
            : Maybe.empty(),
        selectedProviderYieldId: Maybe.empty(),
        yields: Maybe.of(yields),
      });

      return {
        yieldName: yieldDto.metadata.name,
        providerDetails,
        usdAmount: positionTotalAmount.amountUsd.toNumber(),
      };
    });

    const allPositionsSum = allPositions.reduce(
      (acc, p) => acc.plus(p.usdAmount),
      new BigNumber(0)
    );

    return {
      data: { allPositions, allPositionsSum },
      isLoading: false as const,
    };
  }, [
    multiYieldsMapQuery.data,
    multiYieldsMapQuery.isLoading,
    positionsData.data,
  ]);

  const rewardsPositionsQuery = usePrices(
    {
      currency: config.currency,
      tokenList: useMemo(
        () => Object.values(rewardsSummaryQuery.data ?? {}).map((v) => v.token),
        [rewardsSummaryQuery.data]
      ),
    },
    {
      enabled: !rewardsSummaryQuery.isLoading && !multiYieldsMapQuery.isLoading,
      select: useCallback(
        (prices: Prices) => {
          if (!rewardsSummaryQuery.data || !multiYieldsMapQuery.data) {
            return {
              rewardsPositions: [],
              rewardsPositionsTotalSum: new BigNumber(0),
              rewardsPositionsLastMonthSum: new BigNumber(0),
              rewardsPositionsLastWeekSum: new BigNumber(0),
            };
          }

          const rewardsPositions = Object.entries(
            rewardsSummaryQuery.data
          ).flatMap(([integrationId, rewardSummary]) => {
            const yieldDto = multiYieldsMapQuery.data.get(integrationId);

            if (!yieldDto) return [];

            const baseToken = getBaseToken(yieldDto);

            const common = {
              pricePerShare: "1",
              baseToken,
              token: rewardSummary.token,
              prices,
            };

            return {
              yieldName: yieldDto.metadata.name,
              total: getTokenPriceInUSD({
                ...common,
                amount: rewardSummary.rewards.total,
              }),
              lastMonth: getTokenPriceInUSD({
                ...common,
                amount: rewardSummary.rewards.last30D,
              }),
              lastWeek: getTokenPriceInUSD({
                ...common,
                amount: rewardSummary.rewards.last7D,
              }),
            };
          });

          const rewardsPositionsTotalSum = rewardsPositions.reduce(
            (acc, p) => acc.plus(p.total),
            new BigNumber(0)
          );

          const rewardsPositionsLastMonthSum = rewardsPositions.reduce(
            (acc, p) => acc.plus(p.lastMonth),
            new BigNumber(0)
          );

          const rewardsPositionsLastWeekSum = rewardsPositions.reduce(
            (acc, p) => acc.plus(p.lastWeek),
            new BigNumber(0)
          );

          return {
            rewardsPositions,
            rewardsPositionsTotalSum,
            rewardsPositionsLastMonthSum,
            rewardsPositionsLastWeekSum,
          };
        },
        [multiYieldsMapQuery.data, rewardsSummaryQuery.data]
      ),
    }
  );

  const averageApyQuery = useMemo(() => {
    if (!multiYieldsMapQuery.data) {
      return {
        data: undefined as undefined,
        isLoading: multiYieldsMapQuery.isLoading,
      };
    }

    const { totalWeightedApy, totalValue } = positionsData.data.reduce(
      (acc, p) => {
        const yieldDto = multiYieldsMapQuery.data.get(p.integrationId);

        if (!yieldDto) return acc;

        const positionTotalAmount = getPositionTotalAmount(
          p.balancesWithAmount
        );

        const usdAmount = positionTotalAmount.amountUsd;

        if (yieldDto.rewardRate > 0 && usdAmount.gt(0)) {
          return {
            totalWeightedApy: acc.totalWeightedApy.plus(
              usdAmount.times(yieldDto.rewardRate * 100)
            ),
            totalValue: acc.totalValue.plus(usdAmount),
          };
        }

        return acc;
      },
      {
        totalWeightedApy: new BigNumber(0),
        totalValue: new BigNumber(0),
      }
    );

    const data = totalValue.gt(0)
      ? totalWeightedApy.div(totalValue)
      : new BigNumber(0);

    return { data, isLoading: false as const };
  }, [
    multiYieldsMapQuery.data,
    multiYieldsMapQuery.isLoading,
    positionsData.data,
  ]);

  const tokenBalancesScan = useTokenBalancesScan();

  const tokenList = useMemo(
    () => tokenBalancesScan.data?.map((tb) => tb.token),
    [tokenBalancesScan.data]
  );

  const availableBalanceSumQuery = usePrices(
    tokenList
      ? {
          currency: config.currency,
          tokenList,
        }
      : null,
    {
      enabled: !tokenBalancesScan.isLoading && !tokenBalancesScan.isPending,
      select: useCallback(
        (prices: Prices) => {
          if (!tokenBalancesScan.data) return BigNumber(0);

          return tokenBalancesScan.data.reduce(
            (acc, tb) =>
              acc.plus(
                getTokenPriceInUSD({
                  amount: tb.amount,
                  pricePerShare: "1",
                  baseToken: tb.token,
                  token: tb.token,
                  prices,
                })
              ),
            BigNumber(0)
          );
        },
        [tokenBalancesScan.data]
      ),
    }
  );

  const value = useMemo(
    () => ({
      allPositionsQuery,
      rewardsPositionsQuery,
      averageApyQuery,
      availableBalanceSumQuery,
    }),
    [
      allPositionsQuery,
      rewardsPositionsQuery,
      averageApyQuery,
      availableBalanceSumQuery,
    ]
  );

  return (
    <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
  );
};

export const useSummary = () => {
  const value = useContext(SummaryContext);

  if (!value) {
    throw new Error("useSummary must be used within a SummaryProvider");
  }

  return value;
};
