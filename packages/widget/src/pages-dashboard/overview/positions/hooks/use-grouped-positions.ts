import { useQueries } from "@tanstack/react-query";
import type { Position as BorrowPosition } from "../../../../borrow";
import {
  type DashboardYieldCategory,
  getDashboardYieldCategory,
} from "../../../../domain/types/yields";
import { queryFn } from "../../../../hooks/api/use-yield-opportunity/get-yield-opportunity";
import type { usePositions } from "../../../../pages/details/positions-page/hooks/use-positions";
import { useApiClient } from "../../../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";

type PositionItem = ReturnType<
  typeof usePositions
>["positionsData"]["data"][number];

export type UnifiedPositionItem =
  | { readonly kind: "borrow"; readonly position: BorrowPosition }
  | { readonly kind: "earn"; readonly position: PositionItem };

type PositionsListRow =
  | { kind: "chain-modal" }
  | {
      kind: "section";
      category: DashboardYieldCategory | "borrow";
      count: number;
    }
  | { kind: "position"; item: UnifiedPositionItem };

const staleTime = 1000 * 60 * 2;

/**
 * Groups position items by their dashboard yield category (stake / defi / rwa),
 * mirroring how the top navigation tabs are grouped. Positions whose category
 * cannot (yet) be resolved are kept ungrouped at the end so nothing is hidden.
 */
export const useGroupedPositions = ({
  borrowPositions,
  earnPositions,
}: {
  readonly borrowPositions: BorrowPosition[];
  readonly earnPositions: PositionItem[];
}): PositionsListRow[] => {
  const { isLedgerLive } = useSKWallet();
  const apiClient = useApiClient();
  const queryClient = useSKQueryClient();
  const { dashboardYieldCategoryOrder, yieldGrouping } = useSettings();
  const dashboardYieldCategoryGroupingEnabled = yieldGrouping === "category";

  const integrationIds = dashboardYieldCategoryGroupingEnabled
    ? [...new Set(earnPositions.map((p) => p.integrationId))]
    : [];

  const categoryQueries = useQueries({
    queries: integrationIds.map((yieldId) => ({
      queryKey: ["yield-opportunity", yieldId, isLedgerLive],
      enabled: dashboardYieldCategoryGroupingEnabled && !!yieldId,
      staleTime,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        queryFn({ yieldId, isLedgerLive, apiClient, queryClient, signal }),
    })),
  });

  if (!dashboardYieldCategoryGroupingEnabled) {
    return [
      { kind: "chain-modal" },
      ...earnPositions.map((position) => ({
        kind: "position" as const,
        item: { kind: "earn" as const, position },
      })),
      ...borrowPositions.map((position) => ({
        kind: "position" as const,
        item: { kind: "borrow" as const, position },
      })),
    ];
  }

  const categoryByIntegrationId = new Map<
    string,
    DashboardYieldCategory | null
  >();
  integrationIds.forEach((id, index) => {
    const data = categoryQueries[index]?.data;
    if (data) categoryByIntegrationId.set(id, getDashboardYieldCategory(data));
  });

  const grouped = new Map<DashboardYieldCategory, PositionItem[]>();
  const ungrouped: PositionItem[] = [];

  for (const item of earnPositions) {
    const category = categoryByIntegrationId.get(item.integrationId);

    if (category) {
      const existing = grouped.get(category);
      if (existing) existing.push(item);
      else grouped.set(category, [item]);
    } else {
      ungrouped.push(item);
    }
  }

  const rows: PositionsListRow[] = [{ kind: "chain-modal" }];

  for (const category of dashboardYieldCategoryOrder) {
    const items = grouped.get(category);
    if (!items?.length) continue;

    rows.push({ kind: "section", category, count: items.length });
    for (const item of items) {
      rows.push({
        kind: "position",
        item: { kind: "earn", position: item },
      });
    }
  }

  for (const item of ungrouped) {
    rows.push({
      kind: "position",
      item: { kind: "earn", position: item },
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
        kind: "position",
        item: { kind: "borrow", position },
      });
    }
  }

  return rows;
};
