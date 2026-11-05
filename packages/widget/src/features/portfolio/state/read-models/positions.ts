import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { isOptionalPendingAction } from "../../../../domain/action/pending-action";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import {
  classifyHealthFactor,
  classifyLtv,
} from "../../../../domain/borrow/risk/ltv-limits";
import { isUnfinishedInstantExit } from "../../../../domain/earn/confidential";
import type { YieldCategory } from "../../../../domain/earn/contract";
import type { EarnBalance } from "../../../../domain/earn/models";
import { getYieldCategory } from "../../../../domain/earn/yield";
import { exactDecimal } from "../../../../domain/finance/exact";
import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  type BalanceDataKey,
  getPositionValueTotal,
  getTokenSumsUsd,
  type PositionData,
  type PositionTokenSum,
  type PositionValidators,
  toPositionsData,
} from "../../../../domain/portfolio/positions";
import { widgetConfigAtom } from "../../../../features/widget-configuration/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/index";
import {
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../../resources/yield-directory/index";
import { toPresentable } from "../../../../shared/effect/async-result";
import { walletScopeAtom } from "../../../wallet/index";
import { yieldBalancesScanAtom } from "./yield-balances";

export type PositionItem = {
  readonly integrationId: YieldId;
  readonly balancesWithAmount: EarnBalance[];
  readonly allBalances: EarnBalance[];
  readonly balanceId: BalanceDataKey;
  readonly actionRequired: boolean;
  /**
   * Only optional cancellations are pending, or an Instant Exit is still to
   * finalize: the request is in progress.
   */
  readonly hasPendingRequest: boolean;
  readonly pointsRewardTokenBalances: ReadonlyArray<EarnBalance>;
  readonly hasPendingClaimRewards: boolean;
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
  | { readonly item: UnifiedPositionItem; readonly kind: "position" }
  | {
      /** Positions worth less than a cent, collapsed under one row. */
      readonly items: ReadonlyArray<PositionItem>;
      readonly kind: "small-balances";
    };

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

        const pendingTypes = balancesWithAmount.flatMap((balance) =>
          balance.pendingActions.map((action) => action.type)
        );
        // An Instant Exit already began; finalizing it is in progress.
        const hasUnfinishedInstantExit = balancesWithAmount.some((balance) =>
          balance.pendingActions.some(({ type }) =>
            isUnfinishedInstantExit(balance, type)
          )
        );
        // Claims have their own badge; optional actions require nothing.
        const hasRequiredPendingAction = balancesWithAmount.some((balance) =>
          balance.pendingActions.some(
            ({ type }) =>
              type !== "CLAIM_REWARDS" &&
              !isOptionalPendingAction(type) &&
              !isUnfinishedInstantExit(balance, type)
          )
        );
        const actionRequired =
          balancesWithAmount.some((balance) => balance.type === "locked") ||
          hasRequiredPendingAction;
        items.push({
          ...value,
          integrationId: position.yieldId,
          balancesWithAmount,
          balanceId,
          allBalances: value.balances,
          total: getPositionValueTotal(balancesWithAmount),
          actionRequired,
          hasPendingRequest:
            !actionRequired &&
            (pendingTypes.includes("CANCEL_PENDING") ||
              hasUnfinishedInstantExit),
          pointsRewardTokenBalances: balancesWithAmount.filter(
            (balance) => !!balance.token.isPoints
          ),
          hasPendingClaimRewards: balancesWithAmount.some((balance) =>
            balance.pendingActions.some(
              (action) => action.type === "CLAIM_REWARDS"
            )
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
  item.actionRequired || item.hasPendingClaimRewards;

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

/**
 * Borrow positions in Manage order: those whose LTV or health factor is near
 * or over its limit first, then by supplied USD value, largest first.
 */
export const toBorrowManageOrder = <P extends BorrowManageFigures>(
  positions: ReadonlyArray<P>
): P[] =>
  sortByManageOrder(
    positions,
    ({ risk: { current } }) =>
      current.status === "available" &&
      (classifyLtv({ ltv: current.ltv, maxLtv: current.maxLtv }) !== "safe" ||
        (current.healthFactor !== null &&
          classifyHealthFactor(current.healthFactor) !== "safe"))
        ? 0
        : 1,
    (position) => position.metrics.totalSuppliedUsd
  );

/** Below a cent, a position counts as a small balance. */
const smallBalanceUsd = 0.01;

/**
 * A position worth less than a cent that asks for nothing: every balance
 * priced and none hidden, so its worth is known, and no action, claim or
 * request pending.
 */
export const isSmallBalance = (item: PositionItem) =>
  !needsAction(item) &&
  !item.hasPendingRequest &&
  item.total.length > 0 &&
  item.balancesWithAmount.every(
    (balance) =>
      balance.isEncrypted !== true &&
      (balance.token.isPoints === true || balance.amountUsd != null)
  ) &&
  getTokenSumsUsd(item.total).isLessThan(smallBalanceUsd);

/**
 * The positions a list shows as rows, and the small balances it collapses
 * under one row after them; each keeps its order.
 */
export const splitSmallBalances = (items: ReadonlyArray<PositionItem>) => ({
  shown: items.filter((item) => !isSmallBalance(item)),
  small: items.filter(isSmallBalance),
});

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

export const currentGroupedPositionsAtom = Atom.make(
  (get): PositionsListRow[] => {
    const config = get(widgetConfigAtom);
    const { shown: earnPositions, small: smallBalances } = splitSmallBalances(
      get(positionsTableDataAtom).pipe(AsyncResult.getOrElse(() => []))
    );
    // Small balances close the list, collapsed under one row.
    const smallBalancesRows: PositionsListRow[] =
      smallBalances.length > 0
        ? [{ items: smallBalances, kind: "small-balances" }]
        : [];
    const borrowManageEnabled = config.borrowEnabled;
    const borrowPositions = get(
      borrowPositionsResourceAtom.local(
        new BorrowPositionsKey({
          scope: borrowManageEnabled ? get(walletScopeAtom) : null,
        })
      )
    ).pipe(
      AsyncResult.map((positions) => toBorrowManageOrder(positions.items)),
      AsyncResult.getOrElse(() => [])
    );

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
        ...smallBalancesRows,
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

    return [...rows, ...smallBalancesRows];
  }
).pipe(Atom.withLabel("currentGroupedPositionsAtom"));
