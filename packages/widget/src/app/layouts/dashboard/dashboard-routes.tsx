import { Option } from "effect";
import { AnimatePresence } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
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
import { useSelectEarnCategory } from "../../../features/earn/index";
import { useWidgetRouteState } from "../../../features/navigation/index";
import { ManagePage } from "../../../features/portfolio/composition";
import {
  DashboardPositionDetailsPage,
  PositionDetailsHub,
} from "../../../features/position-details/composition";
import { WalletScopeRouteGuard } from "../../../features/wallet/composition";
import { GlobalModals } from "../../../features/widget-shell/composition";
// import { RewardsTabPage } from "../../../domain/portfolio/rewards";
import { createYieldFlowRoutes } from "../../../features/yield-transaction-flow/composition";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import { BorrowFeatureRoute } from "../../routes/ui/borrow-feature-route";
import { dashboardEarnRoute } from "./dashboard-earn-route";
import {
  DashboardEarnFlowOverview,
  DashboardEarnTab,
  DashboardOverview,
} from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";
import { resolveDashboardRouteTab } from "./dashboard-tabs";

const borrowRouteComposition = {
  WalletScopeRouteGuard,
  createBorrowTransactionFlowRoutes,
};

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  Option.isSome(widgetRoutes.earn.match(pathname));

/**
 * Identity of the dashboard page a pathname renders. A change replays the page
 * transition (exit, then enter); steps inside one page, such as the Earn form
 * into its Review or a position into its unstake flow, keep the same key.
 */
const resolveDashboardPageKey = (pathname: string): string => {
  const tab = resolveDashboardRouteTab(pathname);
  if (tab !== "manage") return tab;
  // A position's pages share its key: a market position, a yield position,
  // or the positions list.
  const borrowPosition = widgetRoutes.borrowPosition.matchPrefix(pathname);
  if (Option.isSome(borrowPosition)) {
    return widgetRoutes.borrowPosition.build("Dashboard", borrowPosition.value);
  }
  const position = widgetRoutes.positionDetails.matchPrefix(pathname);
  if (Option.isSome(position)) {
    return widgetRoutes.positionDetails.build(position.value);
  }
  return widgetRoutes.positions.build();
};

/** The Dashboard Layout's route tree. */
export const createDashboardRoutes = ({
  registerEarnFooterButton,
}: {
  readonly registerEarnFooterButton: boolean;
}) => {
  const earnPath = widgetRoutes.earn.build();
  const positionsPath = widgetRoutes.positions.build();

  return (
    <>
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

        <Route element={<WalletScopeRouteGuard fallbackPath={earnPath} />}>
          {createYieldFlowRoutes({
            layout: <DashboardEarnFlowOverview />,
            mount: "Earn",
          })}
        </Route>
      </Route>

      {/* Borrow Tab */}
      <Route element={<BorrowFeatureRoute fallbackPath={earnPath} />}>
        {createBorrowEntryRoutes(borrowRouteComposition)}
      </Route>

      {/* Manage Tab + Position Details */}
      <Route path={widgetRoutes.positions.pattern}>
        <Route index element={<ManagePage />} />
        <Route element={<BorrowFeatureRoute fallbackPath={positionsPath} />}>
          {createBorrowMarketPositionRoutes(borrowRouteComposition)}
        </Route>
        <Route element={<WalletScopeRouteGuard fallbackPath={positionsPath} />}>
          <Route
            path={widgetRoutes.positionDetails.pattern}
            element={<DashboardPositionDetailsPage />}
          >
            <Route index element={<PositionDetailsHub />} />

            <Route path={widgetRoutes.positionStake.pattern}>
              <Route index element={<Navigate replace to=".." />} />
              {createYieldFlowRoutes({ mount: "PositionStake" })}
              <Route path="*" element={<Navigate replace to="../.." />} />
            </Route>

            <Route
              path={widgetRoutes.positionSelectValidator.pattern}
              element={<PositionDetailsHub />}
            />

            <Route path={widgetRoutes.positionUnstake.pattern}>
              <Route index element={<Navigate replace to=".." />} />
              {createYieldFlowRoutes({ mount: "PositionExit" })}
              <Route path="*" element={<Navigate replace to="../.." />} />
            </Route>

            <Route path={widgetRoutes.positionPendingAction.pattern}>
              <Route index element={<Navigate replace to=".." />} />
              {createYieldFlowRoutes({ mount: "PositionManage" })}
              <Route path="*" element={<Navigate replace to="../.." />} />
            </Route>

            <Route
              path="*"
              element={<Navigate replace relative="path" to=".." />}
            />
          </Route>
        </Route>
      </Route>

      <Route path={widgetRoutes.activity.pattern} element={<ActivityTabPage />}>
        {createActivityActionRoutes({
          ActionScopeGuard: WalletScopeRouteGuard,
          selectsDefaultAction: true,
          showsBackButton: false,
        })}
      </Route>
    </>
  );
};

export const DashboardRoutes = () => {
  const location = useLocation();
  const selectCategory = useSelectEarnCategory();
  const earnNavigation = useWidgetRouteState(dashboardEarnRoute);
  const isEarnPage = Option.isSome(widgetRoutes.earn.match(location.pathname));
  const acceptedCategory = isEarnPage
    ? (earnNavigation?.yieldCategory ?? null)
    : null;
  const [categoryTransition, setCategoryTransition] = useState<{
    readonly key: string | null;
    readonly category: YieldCategory | null;
  }>({ key: null, category: null });

  // A blocked navigation never changes location, so it cannot remount Steps.
  // Keep the accepted category's key through Review, Steps, and Complete.
  if (acceptedCategory !== null && categoryTransition.key !== location.key) {
    setCategoryTransition({ key: location.key, category: acceptedCategory });
  } else if (
    acceptedCategory === null &&
    categoryTransition.category !== null
  ) {
    setCategoryTransition({ ...categoryTransition, category: null });
  }

  // AnimatePresence retains the callback from when the exit began. Read the
  // latest accepted category, including another press during that exit.
  const pendingYieldCategoryRef = useRef<YieldCategory | null>(null);
  useLayoutEffect(() => {
    pendingYieldCategoryRef.current = categoryTransition.category;
  }, [categoryTransition]);

  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    location.pathname
  );
  const pageKey = resolveDashboardPageKey(location.pathname);
  const routesKey =
    pageKey === "earn" ? `earn:${categoryTransition.key}` : pageKey;

  const onExitComplete = () => {
    const category = pendingYieldCategoryRef.current;
    if (category === null) return;
    pendingYieldCategoryRef.current = null;
    selectCategory(category);
    setCategoryTransition((current) => ({ ...current, category: null }));
  };

  return (
    <>
      <DashboardShell pendingYieldCategory={categoryTransition.category}>
        <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
          {/* The exiting Routes keeps its location, so it renders the page being left. */}
          <Routes location={location} key={routesKey}>
            {createDashboardRoutes({ registerEarnFooterButton })}
          </Routes>
        </AnimatePresence>
      </DashboardShell>

      <GlobalModals />
    </>
  );
};
