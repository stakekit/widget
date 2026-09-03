import type { ComponentType, ReactNode } from "react";
import { createBorrowEntryRoutes as createEntryRoutes } from "./borrow-entry/composition";
import { createBorrowMarketPositionRoutes as createMarketPositionRoutes } from "./market-position/composition";
import { BorrowConnectedWalletRoute } from "./wallet/composition";

type BorrowRouteComposition = Readonly<{
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: string }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "BorrowEntry" | "MarketPosition";
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
