import { Navigate, Route } from "react-router";
import { createBorrowTransactionFlowRoutes } from "../../../borrow-transaction-flow/ui";
import { WalletScopeRouteGuard } from "../../../wallet/ui";
import { BorrowConnectedWalletRoute } from "../../wallet/ui/connected-wallet-route";
import { BorrowPositionActionPage } from "./action.page";
import { BorrowPositionActionsPage } from "./actions.page";
import { BorrowPositionDetailsPage } from "./details.page";

export const createBorrowMarketPositionRoutes = () => (
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
