import type { ComponentType, ReactElement, ReactNode } from "react";
import type { WidgetPath } from "../../services/navigation/widget-routes";
import { createBorrowEntryRoutes as createEntryRoutes } from "./borrow-entry/composition";
import { createBorrowMarketPositionRoutes as createMarketPositionRoutes } from "./market-position/composition";
import { BorrowConnectedWalletRoute } from "./wallet/composition";

type BorrowRouteComposition = Readonly<{
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: WidgetPath }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "BorrowEntry" | "MarketPosition";
    readonly layout?: ReactElement;
  }) => ReactNode;
}>;

const withBorrowOwnedRoutes = (composition: BorrowRouteComposition) => ({
  ...composition,
  BorrowConnectedWalletRoute,
});

export const createBorrowEntryRoutes = (composition: BorrowRouteComposition) =>
  createEntryRoutes(withBorrowOwnedRoutes(composition));

export const createBorrowMarketPositionRoutes = (
  composition: BorrowRouteComposition
) => createMarketPositionRoutes(withBorrowOwnedRoutes(composition));
