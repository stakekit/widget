import type { ComponentType, ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { BorrowPositionActionPage } from "./action.page.tsx";
import { BorrowPositionActionsPage } from "./actions.page.tsx";
import { BorrowPositionDetailsPage } from "./details.page.tsx";

type BorrowMarketPositionRouteComposition = Readonly<{
  BorrowConnectedWalletRoute: ComponentType;
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: string }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "MarketPosition";
  }) => ReactNode;
}>;

export const createBorrowMarketPositionRoutes = ({
  BorrowConnectedWalletRoute,
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
}: BorrowMarketPositionRouteComposition) => (
  <>
    <Route element={<WalletScopeRouteGuard fallbackPath="/positions" />}>
      <Route element={<BorrowConnectedWalletRoute />}>
        <Route path="borrow/:marketId" element={<BorrowPositionDetailsPage />}>
          <Route index element={<BorrowPositionActionsPage />} />
          <Route
            path="action/:actionId"
            element={<BorrowPositionActionPage />}
          />
          {createBorrowTransactionFlowRoutes({ entry: "MarketPosition" })}
        </Route>
      </Route>
    </Route>
    <Route path="borrow/*" element={<Navigate to="/positions" replace />} />
  </>
);
