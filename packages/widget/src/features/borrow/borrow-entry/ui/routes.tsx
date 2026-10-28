import type { ComponentType, ReactElement, ReactNode } from "react";
import { Route } from "react-router";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../services/navigation/widget-routes";
import { WidgetNavigate } from "../../../navigation/views";
import { BorrowEntryLayout, BorrowFlowLayout, BorrowShell } from "./layout";
import { BorrowFormPage } from "./page";

type BorrowEntryRouteComposition = Readonly<{
  BorrowConnectedWalletRoute: ComponentType;
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: WidgetPath }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "BorrowEntry";
    readonly layout: ReactElement;
  }) => ReactNode;
}>;

export const createBorrowEntryRoutes = ({
  BorrowConnectedWalletRoute,
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
}: BorrowEntryRouteComposition) => {
  const borrowPath = widgetRoutes.borrow.build("Dashboard");
  return (
    <>
      <Route path={widgetRoutes.borrow.pattern} element={<BorrowShell />}>
        <Route element={<BorrowEntryLayout />}>
          <Route index element={<BorrowFormPage />} />
        </Route>
        <Route element={<WalletScopeRouteGuard fallbackPath={borrowPath} />}>
          <Route element={<BorrowConnectedWalletRoute />}>
            {createBorrowTransactionFlowRoutes({
              entry: "BorrowEntry",
              layout: <BorrowFlowLayout />,
            })}
          </Route>
        </Route>
      </Route>
      <Route
        path={widgetRoutes.borrow.descendants}
        element={<WidgetNavigate replace to={borrowPath} />}
      />
    </>
  );
};
