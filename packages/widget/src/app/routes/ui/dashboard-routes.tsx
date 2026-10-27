import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import type { YieldCategory } from "../../../domain/earn/contract";
import {
  ActivityTabPage,
  createActivityActionRoutes,
} from "../../../features/activity/composition";
import {
  createBorrowEntryRoutes,
  createBorrowMarketPositionRoutes,
} from "../../../features/borrow/composition";
import { createBorrowTransactionFlowRoutes } from "../../../features/borrow-transaction-flow/composition";
import { EarnPageContent } from "../../../features/earn/composition";
import { useEarnYieldSelection } from "../../../features/earn/index";
import { ManagePage } from "../../../features/portfolio/composition";
import {
  DashboardPositionDetailsPage,
  PositionDetailsHub,
} from "../../../features/position-details/composition";
import { WalletScopeRouteGuard } from "../../../features/wallet/composition";
import { GlobalModals } from "../../../features/widget-shell/composition";
// import { RewardsTabPage } from "../../../domain/portfolio/rewards";
import { createYieldFlowRoutes } from "../../../features/yield-transaction-flow/composition";
import { BorrowFeatureRoute } from "./borrow-feature-route";
import {
  DashboardEarnFlowOverview,
  DashboardEarnTab,
  DashboardOverview,
} from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";

const borrowRouteComposition = {
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
};

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/";

/**
 * Identity of the dashboard page a pathname renders. A change replays the page
 * transition (exit, then enter); steps inside one page, such as the Earn form
 * into its Review or a position into its unstake flow, keep the same key.
 */
const resolveDashboardPageKey = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  const [section] = segments;

  if (section === "activity" || section === "borrow") return section;
  // `positions`, `positions/:integrationId/:balanceId`, or
  // `positions/borrow/:marketId`
  if (section === "positions") return segments.slice(0, 3).join("/");
  return "earn";
};

export const DashboardRoutes = () => {
  const location = useLocation();
  const { selectCategory } = useEarnYieldSelection();
  const [categoryPresses, setCategoryPresses] = useState(0);
  // Applied once the leaving page finished its exit, so it does not render the
  // newly selected category while fading out.
  const [pendingYieldCategory, setPendingYieldCategory] =
    useState<YieldCategory | null>(null);
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    location.pathname
  );
  const pageKey = resolveDashboardPageKey(location.pathname);
  // Category tab presses replay the Earn page transition like route tabs do.
  const routesKey = pageKey === "earn" ? `earn:${categoryPresses}` : pageKey;

  const onYieldCategorySelect = (category: YieldCategory) => {
    setPendingYieldCategory(category);
    setCategoryPresses((n) => n + 1);
  };

  const onExitComplete = () => {
    if (pendingYieldCategory === null) return;
    selectCategory(pendingYieldCategory);
    setPendingYieldCategory(null);
  };

  return (
    <>
      <DashboardShell
        onYieldCategorySelect={onYieldCategorySelect}
        pendingYieldCategory={pendingYieldCategory}
      >
        <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
          {/* The exiting Routes keeps its location, so it renders the page being left. */}
          <Routes location={location} key={routesKey}>
            {/* Earn Tab */}
            <Route element={<DashboardEarnTab />}>
              <Route element={<DashboardOverview />}>
                <Route
                  index
                  element={
                    <EarnPageContent
                      registerFooterButton={registerEarnFooterButton}
                    />
                  }
                />
              </Route>

              <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
                {createYieldFlowRoutes({
                  journey: "Enter",
                  layout: <DashboardEarnFlowOverview />,
                })}
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
                    {createYieldFlowRoutes({ journey: "Enter" })}
                    <Route path="*" element={<Navigate replace to="../.." />} />
                  </Route>

                  <Route
                    path="select-validator/:pendingActionType"
                    element={<PositionDetailsHub />}
                  />

                  <Route path="unstake">
                    <Route index element={<Navigate replace to=".." />} />
                    {createYieldFlowRoutes({ journey: "Exit" })}
                    <Route path="*" element={<Navigate replace to="../.." />} />
                  </Route>

                  <Route path="pending-action">
                    <Route index element={<Navigate replace to=".." />} />
                    {createYieldFlowRoutes({ journey: "Manage" })}
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
          </Routes>
        </AnimatePresence>
      </DashboardShell>

      <GlobalModals />
    </>
  );
};
