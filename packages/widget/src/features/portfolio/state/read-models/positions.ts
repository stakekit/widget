import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { isOptionalPendingAction } from "../../../../domain/action/pending-action";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import { isUnfinishedInstantExit } from "../../../../domain/earn/confidential";
import type { YieldCategory } from "../../../../domain/earn/contract";
import type { EarnBalance } from "../../../../domain/earn/models";
import { getYieldCategory } from "../../../../domain/earn/yield";
import { exactDecimal } from "../../../../domain/finance/exact";
import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  type BalanceDataKey,
  type PositionData,
  type PositionValidators,
  toPositionsData,
} from "../../../../domain/portfolio/positions";
import type { YieldBalanceLabel } from "../../../../domain/portfolio/token-balance";
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
  readonly token: EarnBalance["token"] | null;
  readonly yieldLabelDto: YieldBalanceLabel | null;
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
          yieldLabelDto: null,
          token:
            [...value.balances].sort(
              (a, b) => priorityOrder[a.type] - priorityOrder[b.type]
            )[0]?.token ?? null,
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

  return prioritizePendingClaims
    ? [...rows].sort((a, b) => {
        if (a.hasPendingClaimRewards) return -1;
        if (b.hasPendingClaimRewards) return 1;
        return 0;
      })
    : rows;
};

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
    borrowPositionsResourceAtom.foreground(
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
    const earnPositions = get(positionsTableDataAtom).pipe(
      AsyncResult.getOrElse(() => [])
    );
    const borrowManageEnabled = config.borrowEnabled;
    const borrowPositions = get(
      borrowPositionsResourceAtom.foreground(
        new BorrowPositionsKey({
          scope: borrowManageEnabled ? get(walletScopeAtom) : null,
        })
      )
    ).pipe(
      AsyncResult.map((positions) => positions.items),
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

const priorityOrder: Record<EarnBalance["type"], number> = {
  active: 1,
  entering: 2,
  exiting: 3,
  withdrawable: 4,
  claimable: 5,
  locked: 6,
};
