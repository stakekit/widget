import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { MarketPosition } from "../../../../domain/borrow/market-position";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import type { YieldCategory } from "../../../../domain/earn/contract";
import { getYieldCategory } from "../../../../domain/earn/yield";
import { toPositionsData } from "../../../../domain/portfolio/positions";
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
import {
  isBorrowPositionAtRisk,
  type PositionItem,
  positionNeedsAction,
  toBorrowManageOrder,
  toPositionItems,
} from "../../model/positions";
import { yieldBalancesScanAtom } from "./yield-balances";

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
      ? earnPositions.value.filter(positionNeedsAction).length
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
