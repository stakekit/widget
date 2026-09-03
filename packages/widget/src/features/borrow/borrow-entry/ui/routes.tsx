import type { ComponentType, ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { BorrowLayout } from "./layout";
import { BorrowFormPage } from "./page";

type BorrowEntryRouteComposition = Readonly<{
  BorrowConnectedWalletRoute: ComponentType;
  WalletScopeRouteGuard: ComponentType<{ readonly fallbackPath: string }>;
  createBorrowTransactionFlowRoutes: (input: {
    readonly entry: "BorrowEntry";
  }) => ReactNode;
}>;

export const createBorrowEntryRoutes = ({
  BorrowConnectedWalletRoute,
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
}: BorrowEntryRouteComposition) => (
  <>
    <Route path="borrow" element={<BorrowLayout />}>
      <Route index element={<BorrowFormPage />} />
      <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
        <Route element={<BorrowConnectedWalletRoute />}>
          {createBorrowTransactionFlowRoutes({ entry: "BorrowEntry" })}
        </Route>
      </Route>
    </Route>
    <Route path="borrow/*" element={<Navigate to="/borrow" replace />} />
  </>
);
