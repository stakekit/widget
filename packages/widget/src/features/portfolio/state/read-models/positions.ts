import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { MarketPosition } from "../../../../domain/borrow/market-position";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import {
  classifyRiskBand,
  type RiskBand,
} from "../../../../domain/borrow/risk-band";
import type { EarnBalance } from "../../../../domain/earn/balance";
import type { YieldCategory } from "../../../../domain/earn/contract";
import { getYieldCategory } from "../../../../domain/earn/yield";
import { exactDecimal } from "../../../../domain/finance/exact";
import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  getPositionAttention,
  type PositionAttention,
} from "../../../../domain/portfolio/position-callout";
import {
  type BalanceDataKey,
  getPositionValueTotal,
  getTokenSumsUsd,
  type PositionData,
  type PositionTokenSum,
  type PositionValidators,
  toPositionsData,
} from "../../../../domain/portfolio/positions";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/borrow-positions";
import {
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../../resources/yield-directory/yield-directory";
import { widgetConfigAtom } from "../../../../runtime/widget-config";
import { toPresentable } from "../../../../shared/effect/async-result";
import { walletScopeAtom } from "../../../wallet/index";
import { yieldBalancesScanAtom } from "./yield-balances";

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

export type UnifiedPositionItem =
  | { readonly kind: "borrow"; readonly position: MarketPosition }
  | { readonly kind: "earn"; readonly position: PositionItem };

export type PositionsListRow =
  | { readonly kind: "chain-modal" }
  | {
      readonly category: YieldCategory | "borrow";
      readonly count: number;
      readonly kind: "section";
    }
  | { readonly item: UnifiedPositionItem; readonly kind: "position" };

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
const needsAction = (item: PositionItem) =>
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
      return needsAction(item) ? 1 : 2;
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
const isBorrowPositionAtRisk = (
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

const positionsDataAtom = yieldBalancesScanAtom.pipe(
  Atom.map(({ result }) =>
    result.pipe(AsyncResult.map((page) => toPositionsData(page.items)))
  ),
  Atom.withLabel("currentPositionsDataAtom")
);

export const positionsTableDataAtom = Atom.make((get) => {
  const zerionPresentation =
    get(widgetConfigAtom).hostProfile.earnPresentation.zerion;

  return get(positionsDataAtom).pipe(
    AsyncResult.map((positions) =>
      toPositionItems(positions, zerionPresentation)
    )
  );
}).pipe(Atom.withLabel("positionsTableDataAtom"));

/** Earn positions as the Manage pages present them. */
export const positionsViewAtom = positionsTableDataAtom.pipe(
  Atom.map(toPresentable),
  Atom.withLabel("positionsViewAtom")
);

export const currentPortfolioBorrowPositionsAtom = Atom.make((get) => {
  const enabled = get(widgetConfigAtom).borrowEnabled;
  const scope = get(walletScopeAtom);
  const connected = enabled && scope !== null && isBorrowNetwork(scope.network);
  const borrowPositionsResult = get(
    borrowPositionsResourceAtom.local(
      new BorrowPositionsKey({
        scope: connected ? scope : null,
      })
    )
  );

  return {
    connectionStatus: connected
      ? ("connected" as const)
      : ("inactive" as const),
    enabled,
    positions: toPresentable(
      borrowPositionsResult.pipe(
        AsyncResult.map((positions) => positions.items)
      )
    ),
    totals: toPresentable(
      borrowPositionsResult.pipe(
        AsyncResult.map((positions) => positions.totals)
      )
    ),
  };
}).pipe(Atom.withLabel("currentPortfolioBorrowPositionsAtom"));

/**
 * How many positions ask for the user's attention: Earn positions with an
 * action or rewards to claim, and borrow positions in the caution or danger
 * risk band.
 */
export const portfolioPendingActionsCountAtom = Atom.make((get) => {
  const earnPositions = get(positionsViewAtom);
  const borrowPositions = get(currentPortfolioBorrowPositionsAtom).positions;
  const earnCount =
    earnPositions._tag === "Ready"
      ? earnPositions.value.filter(needsAction).length
      : 0;
  const borrowCount =
    borrowPositions._tag === "Ready"
      ? borrowPositions.value.filter(isBorrowPositionAtRisk).length
      : 0;
  return earnCount + borrowCount;
}).pipe(Atom.withLabel("portfolioPendingActionsCountAtom"));

/**
 * The Dashboard list's rows: Earn positions, grouped by Yield category when
 * configured, then the wallet's Borrow positions in Manage order.
 */
export const currentGroupedPositionsAtom = Atom.make(
  (get): PositionsListRow[] => {
    const config = get(widgetConfigAtom);
    const earnPositions = get(positionsTableDataAtom).pipe(
      AsyncResult.getOrElse(() => [])
    );
    const borrowView = get(currentPortfolioBorrowPositionsAtom).positions;
    const borrowPositions =
      borrowView._tag === "Ready" ? toBorrowManageOrder(borrowView.value) : [];

    if (config.yieldGrouping !== "category") {
      return [
        { kind: "chain-modal" },
        ...earnPositions.map((position) => ({
          item: { kind: "earn" as const, position },
          kind: "position" as const,
        })),
        ...borrowPositions.map((position) => ({
          item: { kind: "borrow" as const, position },
          kind: "position" as const,
        })),
      ];
    }

    const yieldIds = [
      ...new Set(earnPositions.map((position) => position.integrationId)),
    ];
    const yieldsById = get(
      yieldDirectoryResourceAtom.foreground(new YieldDirectoryKey({ yieldIds }))
    ).pipe(
      AsyncResult.map(
        ({ items }) =>
          new Map(items.map((yieldModel) => [yieldModel.id, yieldModel]))
      ),
      AsyncResult.getOrElse(() => new Map())
    );
    const grouped = new Map<YieldCategory, PositionItem[]>();
    const ungrouped: PositionItem[] = [];

    for (const item of earnPositions) {
      const yieldModel = yieldsById.get(item.integrationId);
      const category = yieldModel ? getYieldCategory(yieldModel) : null;

      if (category) {
        const existing = grouped.get(category);
        if (existing) existing.push(item);
        else grouped.set(category, [item]);
      } else {
        ungrouped.push(item);
      }
    }

    const rows: PositionsListRow[] = [{ kind: "chain-modal" }];
    for (const category of config.yieldCategoryOrder) {
      const items = grouped.get(category);
      if (!items?.length) continue;

      rows.push({ category, count: items.length, kind: "section" });
      for (const item of items) {
        rows.push({
          item: { kind: "earn", position: item },
          kind: "position",
        });
      }
    }

    for (const item of ungrouped) {
      rows.push({
        item: { kind: "earn", position: item },
        kind: "position",
      });
    }

    if (borrowPositions.length > 0) {
      rows.push({
        category: "borrow",
        count: borrowPositions.length,
        kind: "section",
      });
      for (const position of borrowPositions) {
        rows.push({
          item: { kind: "borrow", position },
          kind: "position",
        });
      }
    }

    return rows;
  }
).pipe(Atom.withLabel("currentGroupedPositionsAtom"));
