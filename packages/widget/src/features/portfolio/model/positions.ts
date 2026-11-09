import type BigNumber from "bignumber.js";

import type { MarketPosition } from "../../../domain/borrow/market-position";
import {
  classifyRiskBand,
  type RiskBand,
} from "../../../domain/borrow/risk-band";
import type { EarnBalance } from "../../../domain/earn/balance";
import type { TokenAmount } from "../../../domain/earn/denomination";
import { exactDecimal } from "../../../domain/finance/exact";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  getPositionAttention,
  type PositionAttention,
} from "../../../domain/portfolio/position-callout";
import {
  type BalanceDataKey,
  getPositionValueTotal,
  getTokenSumsUsd,
  type PositionData,
  type PositionTokenSum,
  type PositionValidators,
} from "../../../domain/portfolio/positions";

/**
 * One balance group of an Earn position, with what it asks of the user
 * (`PositionAttention`).
 */
export type PositionItem = PositionAttention & {
  readonly integrationId: YieldId;
  readonly balancesWithAmount: EarnBalance[];
  readonly allBalances: EarnBalance[];
  readonly balanceId: BalanceDataKey;
  readonly pointsRewardTokenBalances: ReadonlyArray<EarnBalance>;
  /**
   * Every balance with an amount: one sum in the primary Value Token when all
   * are priced, else one per Value Token.
   */
  readonly total: ReadonlyArray<PositionTokenSum>;
} & (
    | { readonly type: "validators"; readonly validators: PositionValidators }
    | { readonly type: "default" }
  );

export const toPositionItems = (
  positions: ReadonlyMap<YieldId, PositionData>,
  prioritizePendingClaims: boolean
): PositionItem[] => {
  const rows = [...positions.values()].reduce<PositionItem[]>(
    (items, position) => {
      for (const [balanceId, value] of position.balanceData) {
        const balancesWithAmount = value.balances.filter((balance) => {
          const amount = exactDecimal(balance.amount);
          return (
            balance.isEncrypted === true ||
            (!amount.isZero() && !amount.isNaN())
          );
        });

        if (balancesWithAmount.length === 0) continue;

        items.push({
          ...value,
          ...getPositionAttention({
            balanceTypes: balancesWithAmount.map((balance) => balance.type),
            pendingActions: balancesWithAmount.flatMap((balance) =>
              balance.pendingActions.map(({ type }) => ({ type, balance }))
            ),
          }),
          integrationId: position.yieldId,
          balancesWithAmount,
          balanceId,
          allBalances: value.balances,
          total: getPositionValueTotal(balancesWithAmount),
          pointsRewardTokenBalances: balancesWithAmount.filter(
            (balance) => !!balance.token.isPoints
          ),
        });
      }

      return items;
    },
    []
  );

  return toManageOrder(rows, prioritizePendingClaims);
};

/** A position that asks something of the user: an action or a claim. */
export const positionNeedsAction = (item: PositionItem) =>
  item.requiredAction !== null || item.hasPendingClaimRewards;

/**
 * Sorts by rank, lowest first, then by USD value, largest first. The sort is
 * stable, so equal positions keep the API's order. Values are computed once.
 */
const sortByManageOrder = <A>(
  items: ReadonlyArray<A>,
  rank: (item: A) => number,
  valueUsd: (item: A) => BigNumber
): A[] =>
  items
    .map((item) => ({ item, rank: rank(item), valueUsd: valueUsd(item) }))
    .sort((a, b) => a.rank - b.rank || (b.valueUsd.comparedTo(a.valueUsd) ?? 0))
    .map(({ item }) => item);

/**
 * Manage order: positions that ask for action first, a Host Profile that
 * prioritizes claims putting those ahead of them, then by USD value.
 */
const toManageOrder = (
  items: ReadonlyArray<PositionItem>,
  prioritizePendingClaims: boolean
): PositionItem[] =>
  sortByManageOrder(
    items,
    (item) => {
      if (prioritizePendingClaims && item.hasPendingClaimRewards) return 0;
      return positionNeedsAction(item) ? 1 : 2;
    },
    (item) => getTokenSumsUsd(item.total)
  );

/** What Manage orders a borrow position by: its risk and supplied value. */
type BorrowManageFigures = {
  readonly metrics: Pick<MarketPosition["metrics"], "totalSuppliedUsd">;
  readonly risk: Pick<MarketPosition["risk"], "current">;
};

/** A borrow position's risk band now; null without debt or risk figures. */
export const getBorrowPositionRiskBand = ({
  risk: { current },
}: Pick<BorrowManageFigures, "risk">): RiskBand | null =>
  current.status === "available"
    ? classifyRiskBand({
        healthFactor: current.healthFactor,
        ltv: current.ltv,
        maxLtv: current.maxLtv,
      })
    : null;

/** A borrow position in the caution or danger band: it asks for action. */
export const isBorrowPositionAtRisk = (
  position: Pick<BorrowManageFigures, "risk">
) => {
  const band = getBorrowPositionRiskBand(position);
  return band === "caution" || band === "danger";
};

const borrowRiskRank = {
  danger: 0,
  caution: 1,
  safe: 2,
} as const satisfies Record<RiskBand, number>;

/**
 * Borrow positions in Manage order: danger first, then caution, then by
 * supplied USD value, largest first.
 */
export const toBorrowManageOrder = <P extends BorrowManageFigures>(
  positions: ReadonlyArray<P>
): P[] =>
  sortByManageOrder(
    positions,
    (position) => {
      const band = getBorrowPositionRiskBand(position);
      return band === null ? borrowRiskRank.safe : borrowRiskRank[band];
    },
    (position) => position.metrics.totalSuppliedUsd
  );

/** What a row shows of its total: its amount, and the USD value beside it. */
export type PositionTotalDisplay = Readonly<{
  /** The total in its token, when it is a single sum. */
  readonly amount: TokenAmount | null;
  /** The positive USD value, when priced. */
  readonly amountUsd: BigNumber | null;
}>;

/**
 * A single sum shows its amount beside its USD value; several sums in
 * different tokens show only their USD total.
 */
export const toPositionTotalDisplay = (
  total: ReadonlyArray<PositionTokenSum>
): PositionTotalDisplay => {
  const [single, ...others] = total;
  const amountUsd = getTokenSumsUsd(total);
  return {
    amount: single && others.length === 0 ? single : null,
    amountUsd: amountUsd.isGreaterThan(0) ? amountUsd : null,
  };
};
