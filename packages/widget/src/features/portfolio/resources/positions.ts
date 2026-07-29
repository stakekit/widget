import BigNumber from "bignumber.js";
import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/config/settings";
import { widgetBootstrapConfigAtom } from "../../../app/config/widget-config";
import type { MarketPosition } from "../../../domain/borrow/market-position";
import type { EarnBalance } from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import {
  getPositionBalances,
  getPositionData,
  type PositionBalancesByType,
  type PositionData,
  type PositionValidators,
  toPositionBalancesByType,
  toPositionsData,
} from "../../../domain/types/positions";
import type { YieldBalanceLabelDto } from "../../../domain/types/token-balance";
import { getDashboardYieldCategory } from "../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../public-api/types";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../resources/borrow-positions/borrow-positions";
import {
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../resources/yield-directory/yield-directory";
import { yieldPositionsResourceAtom } from "../../../resources/yield-positions/yield-positions";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { defaultFormattedNumber } from "../../../shared/lib/number-format";
import { walletScopeAtom } from "../../wallet/state";
import { yieldBalancesScanAtom } from "./yield-balances";

export type PositionItem = {
  readonly integrationId: YieldId;
  readonly balancesWithAmount: EarnBalance[];
  readonly allBalances: EarnBalance[];
  readonly balanceId: string;
  readonly actionRequired: boolean;
  readonly pointsRewardTokenBalances: ReadonlyArray<
    Omit<EarnBalance, "amount"> & { readonly amount: string }
  >;
  readonly hasPendingClaimRewards: boolean;
  readonly token: EarnBalance["token"] | null;
  readonly yieldLabelDto: YieldBalanceLabelDto | null;
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
      readonly category: DashboardYieldCategory | "borrow";
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
          const amount = new BigNumber(balance.amount);
          return !amount.isZero() && !amount.isNaN();
        });

        if (balancesWithAmount.length === 0) continue;

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
          actionRequired: balancesWithAmount.some(
            (balance) =>
              balance.type === "locked" || balance.type === "claimable"
          ),
          pointsRewardTokenBalances: balancesWithAmount
            .filter((balance) => !!balance.token.isPoints)
            .map((balance) => ({
              ...balance,
              amount: defaultFormattedNumber(balance.amount),
            })),
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

const positionsDataAtomFamily = Atom.family((scope: WalletScopeKey) =>
  yieldPositionsResourceAtom.foreground(scope).pipe(
    Atom.mapResult((page) => toPositionsData(page.items)),
    Atom.withLabel("positionsDataAtom")
  )
);

const positionsDataAtom = yieldBalancesScanAtom.pipe(
  Atom.map(({ result }) =>
    result.pipe(AsyncResult.map((page) => toPositionsData(page.items)))
  ),
  Atom.withLabel("currentPositionsDataAtom")
);

export class PositionDataKey extends Data.Class<{
  readonly scope: WalletScopeKey;
  readonly yieldId: YieldId | null;
}> {}

export const positionDataAtom = Atom.family((key: PositionDataKey) =>
  positionsDataAtomFamily(key.scope).pipe(
    Atom.mapResult((positions) => getPositionData(positions, key.yieldId))
  )
);

export class PositionBalancesKey extends Data.Class<{
  readonly balanceId: string | null;
  readonly scope: WalletScopeKey;
  readonly yieldId: YieldId | null;
}> {}

export const positionBalancesAtom = Atom.family((key: PositionBalancesKey) =>
  positionDataAtom(
    new PositionDataKey({ scope: key.scope, yieldId: key.yieldId })
  ).pipe(
    Atom.mapResult((position) => getPositionBalances(position, key.balanceId))
  )
);

export const positionBalancesByTypeAtom = Atom.family(
  (key: PositionBalancesKey) =>
    positionBalancesAtom(key).pipe(
      Atom.mapResult((position): PositionBalancesByType | null =>
        position ? toPositionBalancesByType(position.balances) : null
      )
    )
);

export const positionsTableDataAtom = Atom.make((get) => {
  const variant = get(widgetBootstrapConfigAtom).wallet.variant;

  return get(positionsDataAtom).pipe(
    AsyncResult.map((positions) =>
      toPositionItems(positions, variant === "zerion")
    )
  );
}).pipe(Atom.withLabel("positionsTableDataAtom"));

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
    const grouped = new Map<DashboardYieldCategory, PositionItem[]>();
    const ungrouped: PositionItem[] = [];

    for (const item of earnPositions) {
      const yieldModel = yieldsById.get(item.integrationId);
      const category = yieldModel
        ? getDashboardYieldCategory(yieldModel)
        : null;

      if (category) {
        const existing = grouped.get(category);
        if (existing) existing.push(item);
        else grouped.set(category, [item]);
      } else {
        ungrouped.push(item);
      }
    }

    const rows: PositionsListRow[] = [{ kind: "chain-modal" }];
    for (const category of config.dashboardYieldCategoryOrder) {
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
