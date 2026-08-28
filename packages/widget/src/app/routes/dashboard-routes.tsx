import { Navigate, Route, Routes, useLocation } from "react-router";
import {
  ActivityTabPage,
  createActivityActionRoutes,
} from "../../features/activity/composition";
import {
  createBorrowEntryRoutes,
  createBorrowMarketPositionRoutes,
} from "../../features/borrow/composition";
import { createBorrowTransactionFlowRoutes } from "../../features/borrow-transaction-flow/composition";
// import { RewardsTabPage } from "../../domain/portfolio/rewards";
import { createClassicFlowRoutes } from "../../features/classic-transaction-flow/composition";
import { EarnPageContent } from "../../features/earn/composition";
import { ManagePage } from "../../features/portfolio/composition";
import {
  DashboardPositionDetailsPage,
  PositionDetailsHub,
} from "../../features/position-details/composition";
import { WalletScopeRouteGuard } from "../../features/wallet/composition";
import { GlobalModals } from "../../features/widget-shell/composition";
import { BorrowFeatureRoute } from "./borrow-feature-route";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";

const borrowRouteComposition = {
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
};

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/";

export const DashboardRoutes = () => {
  const location = useLocation();
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    location.pathname
  );

  return (
    <>
      <Routes>
        <Route element={<DashboardShell />}>
          {/* Earn Tab */}
          <Route element={<DashboardOverview />}>
            <Route
              index
              element={
                <EarnPageContent
                  registerFooterButton={registerEarnFooterButton}
                />
              }
            />

            <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
              {createClassicFlowRoutes({ journey: "Enter" })}
            </Route>
          </Route>

          {/* Borrow Tab */}
          <Route element={<BorrowFeatureRoute fallbackPath="/" />}>
            {createBorrowEntryRoutes(borrowRouteComposition)}
          </Route>

          {/* Manage Tab + Position Details */}
          <Route path="positions">
            <Route index element={<ManagePage />} />
            <Route element={<BorrowFeatureRoute fallbackPath="/positions" />}>
              {createBorrowMarketPositionRoutes(borrowRouteComposition)}
            </Route>
            <Route
              element={<WalletScopeRouteGuard fallbackPath="/positions" />}
            >
              <Route
                path=":integrationId/:balanceId"
                element={<DashboardPositionDetailsPage />}
              >
                <Route index element={<PositionDetailsHub />} />

                <Route path="stake">
                  <Route index element={<Navigate replace to=".." />} />
                  {createClassicFlowRoutes({ journey: "Enter" })}
                  <Route path="*" element={<Navigate replace to="../.." />} />
                </Route>

                <Route
                  path="select-validator/:pendingActionType"
                  element={<DashboardPositionDetailsPage />}
                />

                <Route path="unstake">
                  <Route index element={<Navigate replace to=".." />} />
                  {createClassicFlowRoutes({ journey: "Exit" })}
                  <Route path="*" element={<Navigate replace to="../.." />} />
                </Route>

                <Route path="pending-action">
                  <Route index element={<Navigate replace to=".." />} />
                  {createClassicFlowRoutes({ journey: "Manage" })}
                  <Route path="*" element={<Navigate replace to="../.." />} />
                </Route>

                <Route
                  path="*"
                  element={<Navigate replace relative="path" to=".." />}
                />
              </Route>
            </Route>
          </Route>

          <Route path="activity" element={<ActivityTabPage />}>
            {createActivityActionRoutes("Dashboard", {
              ActionScopeGuard: WalletScopeRouteGuard,
            })}
          </Route>
        </Route>
      </Routes>

      <GlobalModals />
    </>
  );
};
