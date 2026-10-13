import type { ComponentType, ReactElement, ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { BorrowEntryLayout, BorrowFlowLayout, BorrowShell } from "./layout";
import { BorrowFormPage } from "./page";

type BorrowEntryRouteComposition = Readonly<{
  BorrowConnectedWalletRoute: ComponentType;
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: string }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "BorrowEntry";
    readonly layout: ReactElement;
  }) => ReactNode;
}>;

export const createBorrowEntryRoutes = ({
  BorrowConnectedWalletRoute,
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
}: BorrowEntryRouteComposition) => (
  <>
    <Route path="borrow" element={<BorrowShell />}>
      <Route element={<BorrowEntryLayout />}>
        <Route index element={<BorrowFormPage />} />
      </Route>
      <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
        <Route element={<BorrowConnectedWalletRoute />}>
          {createBorrowTransactionFlowRoutes({
            entry: "BorrowEntry",
            layout: <BorrowFlowLayout />,
          })}
        </Route>
      </Route>
    </Route>
    <Route path="borrow/*" element={<Navigate to="/borrow" replace />} />
  </>
);
