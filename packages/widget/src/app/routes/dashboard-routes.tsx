import { Navigate, Route, Routes, useLocation } from "react-router";
import { ActivityTabPage } from "../../features/activity/ui";
import {
  createBorrowEntryRoutes,
  createBorrowMarketPositionRoutes,
} from "../../features/borrow/ui";
// import { RewardsTabPage } from "../../domain/types/rewards";
import { createClassicFlowRoutes } from "../../features/classic-transaction-flow/ui";
import { EarnPageContent } from "../../features/earn/ui";
import { ManagePage } from "../../features/portfolio/ui";
import {
  DashboardPositionDetailsPage,
  PositionDetailsHub,
} from "../../features/position-details/ui";
import { WalletScopeRouteGuard } from "../../features/wallet/ui";
import { GlobalModals } from "../../features/widget-shell/ui";
import { BorrowFeatureRoute } from "./borrow-feature-route";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";

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
            {createBorrowEntryRoutes()}
          </Route>

          {/* Manage Tab + Position Details */}
          <Route path="positions">
            <Route index element={<ManagePage />} />
            <Route element={<BorrowFeatureRoute fallbackPath="/positions" />}>
              {createBorrowMarketPositionRoutes()}
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
            <Route element={<WalletScopeRouteGuard fallbackPath="/activity" />}>
              {createClassicFlowRoutes({
                journey: "ActivityResume",
                presentation: "Dashboard",
              })}
            </Route>
          </Route>
        </Route>
      </Routes>

      <GlobalModals />
    </>
  );
};
