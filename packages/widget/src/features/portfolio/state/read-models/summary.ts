import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { exactZero } from "../../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../../domain/finance/price";
import type { YieldId } from "../../../../domain/identity/identifiers";
import { getPositionTotalAmount } from "../../../../domain/portfolio/positions";
import {
  PricesKey,
  pricesAtom,
} from "../../../../resources/token-prices/index";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../../yield-summary/index";
import { type PositionItem, positionsTableDataAtom } from "./positions";
import { tokenBalancesScanAtom } from "./token-balances";

const DEFAULT_CURRENCY = "USD";

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
  }, exactZero());

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

      return rewardRate.isGreaterThan(0) && value.gt(0)
        ? {
            totalValue: summary.totalValue.plus(value),
            weightedApy: summary.weightedApy.plus(
              value.times(rewardRate).times(100)
            ),
          }
        : summary;
    },
    { totalValue: exactZero(), weightedApy: exactZero() }
  );

  return weighted.totalValue.gt(0)
    ? weighted.weightedApy.div(weighted.totalValue)
    : exactZero();
};

export const allPositionsSummaryAtom = Atom.make((get) =>
  AsyncResult.all({
    positions: get(positionsResultAtom),
    yields: get(summaryYieldsResultAtom),
  }).pipe(
    AsyncResult.map(({ positions, yields }) => ({
      allPositionsSum: getPositionsTotal(positions, yields),
    }))
  )
);

export const averageApySummaryAtom = Atom.make((get) =>
  AsyncResult.all({
    positions: get(positionsResultAtom),
    yields: get(summaryYieldsResultAtom),
  }).pipe(
    AsyncResult.map(({ positions, yields }) =>
      getPositionsAverageApy(positions, yields)
    )
  )
);

const availableBalancePricesResultAtom = Atom.make((get) => {
  const tokenBalances = AsyncResult.getOrElse(
    get(tokenBalancesScanAtom).result,
    () => null
  );

  return get(
    pricesAtom.foreground(
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

export const availableBalanceSummaryAtom = Atom.make((get) => {
  const tokenBalancesScan = get(tokenBalancesScanAtom);
  if (!tokenBalancesScan.enabled) {
    return AsyncResult.success<BigNumber | undefined>(undefined);
  }

  return AsyncResult.all({
    prices: get(availableBalancePricesResultAtom),
    tokenBalances: tokenBalancesScan.result,
  }).pipe(
    AsyncResult.map(({ prices, tokenBalances }) =>
      prices
        ? tokenBalances.reduce(
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
            exactZero()
          )
        : undefined
    )
  );
});
