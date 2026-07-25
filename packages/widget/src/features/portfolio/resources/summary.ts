import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RewardsSummary } from "../../../domain/schema/dashboard-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { Prices } from "../../../domain/schema/health-price-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import { getPositionTotalAmount } from "../../../domain/types/positions";
import { getTokenPriceInUSD } from "../../../domain/types/price";
import { PricesKey, pricesAtom } from "../../../resources/token-prices/prices";
import {
  CurrentRewardsSummaryKey,
  MultiYieldsKey,
  multiYieldsByIdAtom,
  positiveRewardsSummaryAtom,
} from "../../yield-summary/state";
import { type PositionItem, positionsTableDataAtom } from "./positions";
import { tokenBalancesScanAtom } from "./token-balances";

const DEFAULT_CURRENCY = "USD";

type SummaryQuery<A> = {
  readonly data: A | undefined;
  readonly isLoading: boolean;
};

type RewardsPositionsSummary = {
  readonly rewardsPositions: ReadonlyArray<{
    readonly lastMonth: BigNumber;
    readonly lastWeek: BigNumber;
    readonly total: BigNumber;
    readonly yieldName: string;
  }>;
  readonly rewardsPositionsLastMonthSum: BigNumber;
  readonly rewardsPositionsLastWeekSum: BigNumber;
  readonly rewardsPositionsTotalSum: BigNumber;
};

const positionsResultAtom = positionsTableDataAtom;

const yieldIdsAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(positionsResultAtom), () => [] as PositionItem[])
    .map((position) => position.integrationId)
    .filter((yieldId, index, values) => values.indexOf(yieldId) === index)
);

const summaryYieldsResultAtom = Atom.make((get) => {
  const yieldIds = get(yieldIdsAtom);

  return get(multiYieldsByIdAtom(new MultiYieldsKey({ yieldIds })));
});

export const getPositionsTotal = (
  positions: ReadonlyArray<PositionItem>,
  yields: ReadonlyMap<YieldId, EarnYieldWithProvider>
) =>
  positions.reduce((sum, position) => {
    const yieldDto = yields.get(position.integrationId);
    if (!yieldDto) return sum;

    return sum.plus(
      getPositionTotalAmount(position.balancesWithAmount, yieldDto.token)
        .amountUsd
    );
  }, new BigNumber(0));

export const getPositionsAverageApy = (
  positions: ReadonlyArray<PositionItem>,
  yields: ReadonlyMap<YieldId, EarnYieldWithProvider>
) => {
  const weighted = positions.reduce(
    (summary, position) => {
      const yieldDto = yields.get(position.integrationId);
      if (!yieldDto) return summary;

      const value = getPositionTotalAmount(
        position.balancesWithAmount,
        yieldDto.token
      ).amountUsd;
      const rewardRate = yieldDto.rewardRate.total;

      return rewardRate > 0 && value.gt(0)
        ? {
            totalValue: summary.totalValue.plus(value),
            weightedApy: summary.weightedApy.plus(
              value.times(rewardRate * 100)
            ),
          }
        : summary;
    },
    { totalValue: new BigNumber(0), weightedApy: new BigNumber(0) }
  );

  return weighted.totalValue.gt(0)
    ? weighted.weightedApy.div(weighted.totalValue)
    : new BigNumber(0);
};

export const allPositionsSummaryAtom = Atom.make(
  (
    get
  ): SummaryQuery<{
    readonly allPositionsSum: BigNumber;
  }> => {
    const positionsResult = get(positionsResultAtom);
    const yieldsResult = get(summaryYieldsResultAtom);
    const yields = AsyncResult.getOrElse(yieldsResult, () => null);

    if (!yields) {
      return {
        data: undefined,
        isLoading:
          AsyncResult.isInitial(positionsResult) ||
          AsyncResult.isInitial(yieldsResult),
      };
    }

    const positions = AsyncResult.getOrElse(positionsResult, () => []);
    return {
      data: { allPositionsSum: getPositionsTotal(positions, yields) },
      isLoading: false,
    };
  }
);

export const averageApySummaryAtom = Atom.make(
  (get): SummaryQuery<BigNumber> => {
    const positionsResult = get(positionsResultAtom);
    const yieldsResult = get(summaryYieldsResultAtom);
    const yields = AsyncResult.getOrElse(yieldsResult, () => null);

    if (!yields) {
      return {
        data: undefined,
        isLoading:
          AsyncResult.isInitial(positionsResult) ||
          AsyncResult.isInitial(yieldsResult),
      };
    }

    return {
      data: getPositionsAverageApy(
        AsyncResult.getOrElse(positionsResult, () => []),
        yields
      ),
      isLoading: false,
    };
  }
);

const rewardsSummaryResultAtom = Atom.make((get) => {
  const yieldIds = get(yieldIdsAtom);

  return get(
    positiveRewardsSummaryAtom(
      new CurrentRewardsSummaryKey({
        yieldIds,
      })
    )
  );
});

const rewardsPricesResultAtom = Atom.make((get) => {
  const rewardsResult = get(rewardsSummaryResultAtom);
  const yieldsResult = get(summaryYieldsResultAtom);
  const rewards = AsyncResult.getOrElse(rewardsResult, () => null);

  return get(
    pricesAtom(
      new PricesKey({
        request:
          AsyncResult.isInitial(rewardsResult) ||
          AsyncResult.isInitial(yieldsResult)
            ? null
            : {
                currency: DEFAULT_CURRENCY,
                tokenList: Object.values(rewards ?? {}).map(
                  (summary) => summary.token
                ),
              },
      })
    )
  );
});

const toRewardsPosition = ({
  prices,
  summary,
  yieldDto,
}: {
  readonly prices: Prices;
  readonly summary: RewardsSummary;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const common = {
    baseToken: yieldDto.token,
    pricePerShare: "1",
    prices,
    token: summary.token,
  };

  return {
    lastMonth: getTokenPriceInUSD({
      ...common,
      amount: summary.rewards.last30D,
    }),
    lastWeek: getTokenPriceInUSD({
      ...common,
      amount: summary.rewards.last7D,
    }),
    total: getTokenPriceInUSD({
      ...common,
      amount: summary.rewards.total,
    }),
    yieldName: yieldDto.metadata.name,
  };
};

export const rewardsPositionsSummaryAtom = Atom.make(
  (get): SummaryQuery<RewardsPositionsSummary> => {
    const pricesResult = get(rewardsPricesResultAtom);
    const rewardsResult = get(rewardsSummaryResultAtom);
    const yieldsResult = get(summaryYieldsResultAtom);
    const prices = AsyncResult.getOrElse(pricesResult, () => null);
    const rewards = AsyncResult.getOrElse(rewardsResult, () => null);
    const yields = AsyncResult.getOrElse(yieldsResult, () => null);

    if (!prices || !rewards || !yields) {
      return {
        data: undefined,
        isLoading:
          AsyncResult.isInitial(pricesResult) ||
          AsyncResult.isInitial(rewardsResult) ||
          AsyncResult.isInitial(yieldsResult),
      };
    }

    const rewardsPositions = get(yieldIdsAtom).flatMap((yieldId) => {
      const summary = rewards[yieldId];
      const yieldDto = yields.get(yieldId);
      return summary && yieldDto
        ? [toRewardsPosition({ prices, summary, yieldDto })]
        : [];
    });

    return {
      data: {
        rewardsPositions,
        rewardsPositionsLastMonthSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.lastMonth),
          new BigNumber(0)
        ),
        rewardsPositionsLastWeekSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.lastWeek),
          new BigNumber(0)
        ),
        rewardsPositionsTotalSum: rewardsPositions.reduce(
          (sum, position) => sum.plus(position.total),
          new BigNumber(0)
        ),
      },
      isLoading: false,
    };
  }
);

const availableBalancePricesResultAtom = Atom.make((get) => {
  const tokenBalances = AsyncResult.getOrElse(
    get(tokenBalancesScanAtom).result,
    () => null
  );

  return get(
    pricesAtom(
      new PricesKey({
        request: tokenBalances
          ? {
              currency: DEFAULT_CURRENCY,
              tokenList: tokenBalances.map((balance) => balance.token),
            }
          : null,
      })
    )
  );
});

export const availableBalanceSummaryAtom = Atom.make(
  (get): SummaryQuery<BigNumber> => {
    const tokenBalancesScan = get(tokenBalancesScanAtom);
    const tokenBalances = AsyncResult.getOrElse(
      tokenBalancesScan.result,
      () => null
    );
    const pricesResult = get(availableBalancePricesResultAtom);
    const prices = AsyncResult.getOrElse(pricesResult, () => null);

    if (!prices || !tokenBalances) {
      return {
        data: undefined,
        isLoading:
          tokenBalancesScan.enabled &&
          (AsyncResult.isInitial(tokenBalancesScan.result) ||
            AsyncResult.isInitial(pricesResult)),
      };
    }

    return {
      data: tokenBalances.reduce(
        (sum, balance) =>
          sum.plus(
            getTokenPriceInUSD({
              amount: balance.amount,
              baseToken: balance.token,
              pricePerShare: "1",
              prices,
              token: balance.token,
            })
          ),
        new BigNumber(0)
      ),
      isLoading: false,
    };
  }
);
