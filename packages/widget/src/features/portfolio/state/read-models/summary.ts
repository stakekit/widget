import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { EarnYieldWithProvider } from "../../../../domain/earn/yield-schema";
import { exactZero } from "../../../../domain/finance/exact";
import type { YieldId } from "../../../../domain/identity/identifiers";
import { getTokenSumsUsd } from "../../../../domain/portfolio/positions";
import {
  type Presentable,
  toPresentable,
} from "../../../../shared/effect/async-result";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../../yield-summary/index";
import type { PositionItem } from "../../model/positions";
import {
  currentPortfolioBorrowPositionsAtom,
  positionsTableDataAtom,
} from "./positions";

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

/**
 * A Manage summary value: loading, known, or unknown ("—"). Not a
 * `Presentable`: a value combined from two sources has no one failure cause
 * or refresh state to carry.
 */
export type SummaryValue =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Ready"; readonly value: BigNumber }
  | { readonly _tag: "Unavailable" };

/**
 * The Manage summary, one set of figures for every Layout and state. Total
 * value sums what the list shows: Earn positions and borrow collateral.
 * Average APY weighs the Earn positions' reward rates by their value, so a
 * borrowing cost never lowers it.
 */
type ManageSummary = {
  readonly totalValue: SummaryValue;
  /** In whole percents, such as 4.2. */
  readonly averageApy: SummaryValue;
  readonly claimableRewards: SummaryValue;
  /** With borrow positions that owe debt: it, and the total value less it. */
  readonly borrow: {
    readonly debt: SummaryValue;
    readonly netWorth: SummaryValue;
  } | null;
  /**
   * A position source failed while another loaded: the figures it feeds are
   * unavailable rather than totals of what loaded.
   */
  readonly isPartial: boolean;
  readonly excludesHidden: boolean;
};

type BorrowSummarySource = {
  readonly positions: Presentable<ReadonlyArray<unknown>, unknown>;
  readonly totals: Presentable<
    {
      readonly totalBorrowedUsd: BigNumber;
      readonly totalSuppliedUsd: BigNumber;
    },
    unknown
  >;
};

const loadingSummaryValue: SummaryValue = { _tag: "Loading" };
const unavailableSummaryValue: SummaryValue = { _tag: "Unavailable" };
const readySummaryValue = (value: BigNumber): SummaryValue => ({
  _tag: "Ready",
  value,
});

const toSummaryValue = <A>(
  presentable: Presentable<A, unknown>,
  value: (a: A) => BigNumber
): SummaryValue => {
  if (presentable._tag === "Loading") return loadingSummaryValue;
  if (presentable._tag === "Failed") return unavailableSummaryValue;
  return readySummaryValue(value(presentable.value));
};

/** Two values combined once both are known; unknown if either is. */
const combineSummaryValues = (
  a: SummaryValue,
  b: SummaryValue,
  combine: (a: BigNumber, b: BigNumber) => BigNumber
): SummaryValue => {
  if (a._tag === "Ready" && b._tag === "Ready") {
    return readySummaryValue(combine(a.value, b.value));
  }
  if (a._tag === "Unavailable" || b._tag === "Unavailable") {
    return unavailableSummaryValue;
  }
  return loadingSummaryValue;
};

/**
 * Builds the Manage summary from its sources. `borrow` is null while no
 * borrow wallet is connected.
 */
export const deriveManageSummary = ({
  averageApy,
  borrow,
  claimableRewards,
  earnPositions,
  earnValue,
}: {
  readonly averageApy: Presentable<BigNumber, unknown>;
  readonly borrow: BorrowSummarySource | null;
  readonly claimableRewards: Presentable<BigNumber, unknown>;
  readonly earnPositions: Presentable<unknown, unknown>;
  readonly earnValue: Presentable<
    { readonly allPositionsSum: BigNumber; readonly excludesHidden: boolean },
    unknown
  >;
}): ManageSummary => {
  const sources = borrow ? [earnPositions, borrow.positions] : [earnPositions];
  const isPartial =
    sources.some((source) => source._tag === "Failed") &&
    sources.some((source) => source._tag === "Ready");
  const totalValue = combineSummaryValues(
    toSummaryValue(earnValue, (value) => value.allPositionsSum),
    borrow
      ? toSummaryValue(borrow.totals, (totals) => totals.totalSuppliedUsd)
      : readySummaryValue(exactZero()),
    (earn, collateral) => earn.plus(collateral)
  );
  const debt = borrow
    ? toSummaryValue(borrow.totals, (totals) => totals.totalBorrowedUsd)
    : unavailableSummaryValue;
  // Debt and net worth show once borrow positions owe something: without
  // debt, net worth would only repeat the total value.
  const owesDebt =
    borrow?.positions._tag === "Ready" &&
    borrow.positions.value.length > 0 &&
    !(debt._tag === "Ready" && debt.value.isZero());

  return {
    averageApy: toSummaryValue(averageApy, (value) => value),
    borrow: owesDebt
      ? {
          debt,
          netWorth: combineSummaryValues(totalValue, debt, (value, owed) =>
            value.minus(owed)
          ),
        }
      : null,
    claimableRewards: toSummaryValue(claimableRewards, (value) => value),
    excludesHidden:
      earnValue._tag === "Ready" && earnValue.value.excludesHidden,
    isPartial,
    totalValue,
  };
};

/** The Manage summary every Layout shows. */
export const manageSummaryAtom = Atom.make((get) => {
  const borrow = get(currentPortfolioBorrowPositionsAtom);

  return deriveManageSummary({
    averageApy: toPresentable(get(averageApySummaryAtom)),
    borrow: borrow.connectionStatus === "connected" ? borrow : null,
    claimableRewards: toPresentable(get(claimableRewardsSummaryAtom)),
    earnPositions: toPresentable(get(positionsResultAtom)),
    earnValue: toPresentable(get(allPositionsSummaryAtom)),
  });
}).pipe(Atom.withLabel("manageSummaryAtom"));
