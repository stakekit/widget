import type { ComponentType, ReactNode } from "react";
import { Route } from "react-router";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../services/navigation/widget-routes";
import { WidgetNavigate } from "../../../navigation/views";
import { BorrowPositionActionPage } from "./action.page.tsx";
import { BorrowPositionActionsPage } from "./actions.page.tsx";
import { BorrowPositionDetailsPage } from "./details.page.tsx";

type BorrowMarketPositionRouteComposition = Readonly<{
  BorrowConnectedWalletRoute: ComponentType;
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: WidgetPath }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "MarketPosition";
  }) => ReactNode;
}>;

export const createBorrowMarketPositionRoutes = ({
  BorrowConnectedWalletRoute,
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
}: BorrowMarketPositionRouteComposition) => {
  const positionsPath = widgetRoutes.positions.build();
  return (
    <>
      <Route element={<WalletScopeRouteGuard fallbackPath={positionsPath} />}>
        <Route element={<BorrowConnectedWalletRoute />}>
          <Route
            path={widgetRoutes.borrowPosition.pattern}
            element={<BorrowPositionDetailsPage />}
          >
            <Route index element={<BorrowPositionActionsPage />} />
            <Route
              path={widgetRoutes.borrowPositionAction.pattern}
              element={<BorrowPositionActionPage />}
            />
            {createBorrowTransactionFlowRoutes({ entry: "MarketPosition" })}
          </Route>
        </Route>
      </Route>
      <Route
        path={widgetRoutes.positionsBorrow.descendants}
        element={<WidgetNavigate replace to={positionsPath} />}
      />
    </>
  );
};
