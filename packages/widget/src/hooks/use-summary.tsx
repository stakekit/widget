import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { createContext, useContext, useMemo } from "react";
import { config } from "../config";
import { getTokenPriceInUSD } from "../domain";
import { getPositionTotalAmount } from "../domain/types/positions";

import { usePositions } from "../pages/details/positions-page/hooks/use-positions";
import {
  CurrentRewardsSummaryKey,
  positiveRewardsSummaryAtom,
} from "./api/dashboard-atoms";
import { PricesKey, pricesAtom } from "./api/prices-atoms";
import { tokenBalancesScanAtom } from "./api/token-balances-atoms";
import { MultiYieldsKey, multiYieldsByIdAtom } from "./api/yield-atoms";
import { getProviderDetails } from "./use-provider-details";

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
      rewardsPositionsQuery: {
        data:
          | {
              rewardsPositions: {
                yieldName: string;
                total: BigNumber;
                lastMonth: BigNumber;
                lastWeek: BigNumber;
              }[];
              rewardsPositionsTotalSum: BigNumber;
              rewardsPositionsLastMonthSum: BigNumber;
              rewardsPositionsLastWeekSum: BigNumber;
            }
          | undefined;
        isLoading: boolean;
      };
      averageApyQuery: {
        data: BigNumber | undefined;
        isLoading: boolean;
      };
      availableBalanceSumQuery: {
        data: BigNumber | undefined;
        isLoading: boolean;
      };
    }
  | undefined
>(undefined);

export const SummaryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { positions } = usePositions();

  const yieldIds = useMemo(
    () => [...new Set(positions.map((position) => position.integrationId))],
    [positions]
  );

  const multiYieldsMapResult = useAtomValue(
    multiYieldsByIdAtom(
      new MultiYieldsKey({
        enabled: yieldIds.length > 0,
        yieldIds,
      })
    )
  );
  const multiYieldsMap = AsyncResult.getOrElse(
    multiYieldsMapResult,
    () => null
  );
  const rewardsSummaryResult = useAtomValue(
    positiveRewardsSummaryAtom(
      new CurrentRewardsSummaryKey({
        enabled: yieldIds.length > 0,
        yieldIds,
      })
    )
  );
  const rewardsSummaryData = AsyncResult.getOrElse(
    rewardsSummaryResult,
    () => null
  );

  const allPositionsQuery = useMemo(() => {
    if (!multiYieldsMap) {
      return {
        data: undefined as undefined,
        isLoading: AsyncResult.isInitial(multiYieldsMapResult),
      };
    }

    const allPositions = positions.flatMap((p) => {
      const yieldDto = multiYieldsMap.get(p.integrationId);

      if (!yieldDto) return [];

      const positionTotalAmount = getPositionTotalAmount(
        p.balancesWithAmount,
        yieldDto.token
      );

      const yields = [...multiYieldsMap.values()];

      const providerDetails = getProviderDetails({
        integrationData: yieldDto,
        validator: p.type === "validators" ? (p.validators[0] ?? null) : null,
        selectedProviderYieldId: null,
        yields,
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
  }, [multiYieldsMap, multiYieldsMapResult, positions]);

  const rewardsPricesResult = useAtomValue(
    pricesAtom(
      new PricesKey({
        request:
          AsyncResult.isInitial(rewardsSummaryResult) ||
          AsyncResult.isInitial(multiYieldsMapResult)
            ? null
            : {
                currency: config.currency,
                tokenList: Object.values(rewardsSummaryData ?? {}).map(
                  (summary) => summary.token
                ),
              },
      })
    )
  );
  const rewardsPrices = AsyncResult.getOrElse(rewardsPricesResult, () => null);
  const rewardsPositionsQuery = useMemo(() => {
    if (!rewardsPrices || !rewardsSummaryData || !multiYieldsMap) {
      return {
        data: undefined,
        isLoading: AsyncResult.isInitial(rewardsPricesResult),
      };
    }

    const rewardsPositions = yieldIds.flatMap((integrationId) => {
      const rewardSummary = rewardsSummaryData[integrationId];
      const yieldDto = multiYieldsMap.get(integrationId);

      if (!rewardSummary || !yieldDto) return [];

      const common = {
        pricePerShare: "1",
        baseToken: yieldDto.token,
        token: rewardSummary.token,
        prices: rewardsPrices,
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

    return {
      data: {
        rewardsPositions,
        rewardsPositionsTotalSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.total),
          new BigNumber(0)
        ),
        rewardsPositionsLastMonthSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.lastMonth),
          new BigNumber(0)
        ),
        rewardsPositionsLastWeekSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.lastWeek),
          new BigNumber(0)
        ),
      },
      isLoading: false,
    };
  }, [
    multiYieldsMap,
    rewardsPrices,
    rewardsPricesResult,
    rewardsSummaryData,
    yieldIds,
  ]);

  const averageApyQuery = useMemo(() => {
    if (!multiYieldsMap) {
      return {
        data: undefined as undefined,
        isLoading: AsyncResult.isInitial(multiYieldsMapResult),
      };
    }

    const { totalWeightedApy, totalValue } = positions.reduce(
      (acc, p) => {
        const yieldDto = multiYieldsMap.get(p.integrationId);

        if (!yieldDto) return acc;

        const positionTotalAmount = getPositionTotalAmount(
          p.balancesWithAmount,
          yieldDto.token
        );

        const usdAmount = positionTotalAmount.amountUsd;

        const rewardRate = yieldDto.rewardRate.total;

        if (rewardRate > 0 && usdAmount.gt(0)) {
          return {
            totalWeightedApy: acc.totalWeightedApy.plus(
              usdAmount.times(rewardRate * 100)
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
  }, [multiYieldsMap, multiYieldsMapResult, positions]);

  const tokenBalancesScan = useAtomValue(tokenBalancesScanAtom);
  const tokenBalances = AsyncResult.getOrElse(
    tokenBalancesScan.result,
    () => null
  );
  const availableBalancePricesResult = useAtomValue(
    pricesAtom(
      new PricesKey({
        request: tokenBalances
          ? {
              currency: config.currency,
              tokenList: tokenBalances.map((balance) => balance.token),
            }
          : null,
      })
    )
  );
  const availableBalancePrices = AsyncResult.getOrElse(
    availableBalancePricesResult,
    () => null
  );
  const availableBalanceSumQuery = useMemo(() => {
    if (!availableBalancePrices || !tokenBalances) {
      return {
        data: undefined,
        isLoading:
          tokenBalancesScan.enabled &&
          (AsyncResult.isInitial(tokenBalancesScan.result) ||
            AsyncResult.isInitial(availableBalancePricesResult)),
      };
    }

    return {
      data: tokenBalances.reduce(
        (sum, balance) =>
          sum.plus(
            getTokenPriceInUSD({
              amount: balance.amount,
              pricePerShare: "1",
              baseToken: balance.token,
              token: balance.token,
              prices: availableBalancePrices,
            })
          ),
        BigNumber(0)
      ),
      isLoading: false,
    };
  }, [
    availableBalancePrices,
    availableBalancePricesResult,
    tokenBalances,
    tokenBalancesScan.enabled,
    tokenBalancesScan.result,
  ]);

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
