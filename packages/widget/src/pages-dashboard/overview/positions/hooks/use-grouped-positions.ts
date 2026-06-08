import { useQueries } from "@tanstack/react-query";
import {
  type DashboardYieldCategory,
  dashboardYieldCategories,
  getDashboardYieldCategory,
} from "../../../../domain/types/yields";
import { queryFn } from "../../../../hooks/api/use-yield-opportunity/get-yield-opportunity";
import type { usePositions } from "../../../../pages/details/positions-page/hooks/use-positions";
import { useApiClient } from "../../../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSKWallet } from "../../../../providers/sk-wallet";

type PositionItem = ReturnType<
  typeof usePositions
>["positionsData"]["data"][number];

export type PositionsListRow =
  | { kind: "chain-modal" }
  | { kind: "section"; category: DashboardYieldCategory; count: number }
  | { kind: "position"; item: PositionItem };

const staleTime = 1000 * 60 * 2;

/**
 * Groups position items by their dashboard yield category (stake / defi / rwa),
 * mirroring how the top navigation tabs are grouped. Positions whose category
 * cannot (yet) be resolved are kept ungrouped at the end so nothing is hidden.
 */
export const useGroupedPositions = (
  positions: PositionItem[]
): PositionsListRow[] => {
  const { isLedgerLive } = useSKWallet();
  const apiClient = useApiClient();
  const queryClient = useSKQueryClient();

  const integrationIds = [...new Set(positions.map((p) => p.integrationId))];

  const categoryQueries = useQueries({
    queries: integrationIds.map((yieldId) => ({
      queryKey: ["yield-opportunity", yieldId, isLedgerLive],
      enabled: !!yieldId,
      staleTime,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        queryFn({ yieldId, isLedgerLive, apiClient, queryClient, signal }),
    })),
  });

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

  for (const item of positions) {
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

  for (const category of dashboardYieldCategories) {
    const items = grouped.get(category);
    if (!items?.length) continue;

    rows.push({ kind: "section", category, count: items.length });
    for (const item of items) rows.push({ kind: "position", item });
  }

  for (const item of ungrouped) rows.push({ kind: "position", item });

  return rows;
};
