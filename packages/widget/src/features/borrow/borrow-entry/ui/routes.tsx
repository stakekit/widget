import { Navigate, Route } from "react-router";
import { createBorrowTransactionFlowRoutes } from "../../../borrow-transaction-flow/ui";
import { WalletScopeRouteGuard } from "../../../wallet/ui";
import { BorrowConnectedWalletRoute } from "../../wallet/ui/connected-wallet-route";
import { BorrowLayout } from "./layout";
import { BorrowFormPage } from "./page";

export const createBorrowEntryRoutes = () => (
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
