import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { exactZero } from "../../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../../domain/finance/price";
import type { YieldId } from "../../../../domain/identity/identifiers";
import { getTokenSumsUsd } from "../../../../domain/portfolio/positions";
import {
  PricesKey,
  pricesAtom,
} from "../../../../resources/token-prices/index";
import { toPresentable } from "../../../../shared/effect/async-result";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../../yield-summary/index";
import { type PositionItem, positionsTableDataAtom } from "./positions";
import { tokenBalancesScanAtom } from "./token-balances";

const DEFAULT_CURRENCY = "USD";

const positionsResultAtom = positionsTableDataAtom;

const yieldIdsAtom = Atom.make((get) =>
  AsyncResult.getOrElse(
    get(positionsResultAtom),
    (): ReadonlyArray<PositionItem> => []
  )
    .map((position) => position.integrationId)
    .filter((yieldId, index, values) => values.indexOf(yieldId) === index)
);

/** The Yields of the current positions, by id. */
export const positionYieldsResultAtom = Atom.make((get) => {
  const yieldIds = get(yieldIdsAtom);

  return get(multiYieldsByIdAtom(new MultiYieldsKey({ yieldIds })));
});

/** A position still showing an encrypted balance, whose amount is unknown. */
const isHiddenPosition = (position: PositionItem) =>
  position.balancesWithAmount.some((balance) => balance.isEncrypted);

export const hasHiddenPositions = (positions: ReadonlyArray<PositionItem>) =>
  positions.some(isHiddenPosition);

// Hidden amounts are unknown, so totals leave those positions out.
const getSummableYield = (
  position: PositionItem,
  yields: ReadonlyMap<YieldId, EarnYieldWithProvider>
) => (isHiddenPosition(position) ? null : yields.get(position.integrationId));

export const getPositionsTotal = (
  positions: ReadonlyArray<PositionItem>,
  yields: ReadonlyMap<YieldId, EarnYieldWithProvider>
) =>
  positions.reduce((sum, position) => {
    const yieldDto = getSummableYield(position, yields);
    if (!yieldDto) return sum;

    return sum.plus(getTokenSumsUsd(position.total));
  }, exactZero());

export const getPositionsAverageApy = (
  positions: ReadonlyArray<PositionItem>,
  yields: ReadonlyMap<YieldId, EarnYieldWithProvider>
) => {
  const weighted = positions.reduce(
    (summary, position) => {
      const yieldDto = getSummableYield(position, yields);
      if (!yieldDto) return summary;

      const value = getTokenSumsUsd(position.total);
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
    yields: get(positionYieldsResultAtom),
  }).pipe(
    AsyncResult.map(({ positions, yields }) => ({
      allPositionsSum: getPositionsTotal(positions, yields),
      excludesHidden: hasHiddenPositions(positions),
    }))
  )
);

export const averageApySummaryAtom = Atom.make((get) =>
  AsyncResult.all({
    positions: get(positionsResultAtom),
    yields: get(positionYieldsResultAtom),
  }).pipe(
    AsyncResult.map(({ positions, yields }) =>
      getPositionsAverageApy(positions, yields)
    )
  )
);

/**
 * What the positions' claimable rewards are worth in USD: every claimable
 * balance with a known value, points left out as they have no price.
 */
export const getClaimableRewardsUsd = (
  positions: ReadonlyArray<PositionItem>
) =>
  positions
    .flatMap((position) => position.balancesWithAmount)
    .reduce(
      (sum, balance) =>
        balance.type === "claimable" &&
        balance.isEncrypted !== true &&
        balance.token.isPoints !== true
          ? sum.plus(balance.amountUsd ?? 0)
          : sum,
      exactZero()
    );

const claimableRewardsSummaryAtom = Atom.make((get) =>
  get(positionsResultAtom).pipe(AsyncResult.map(getClaimableRewardsUsd))
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
                  pricePerShare: null,
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

/** The Manage summary as it presents: each figure with its own view state. */
export const summaryViewAtom = Atom.make((get) => ({
  allPositions: toPresentable(get(allPositionsSummaryAtom)),
  availableBalance: toPresentable(get(availableBalanceSummaryAtom)),
  averageApy: toPresentable(get(averageApySummaryAtom)),
  claimableRewards: toPresentable(get(claimableRewardsSummaryAtom)),
})).pipe(Atom.withLabel("summaryViewAtom"));
