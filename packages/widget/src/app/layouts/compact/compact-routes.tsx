import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import {
  AnimatedActivityPage,
  createActivityActionRoutes,
} from "../../../features/activity/composition";
import { AnimatedEarnPage } from "../../../features/earn/composition";
import { WidgetNavigate } from "../../../features/navigation/views";
import { AnimatedPositionsPage } from "../../../features/portfolio/composition";
import { usePortfolioPendingActionsCount } from "../../../features/portfolio/index";
import { CompactPositionDetailsPage } from "../../../features/position-details/composition";
import { WalletScopeRouteGuard } from "../../../features/wallet/composition";
import {
  AnimationLayout,
  CompactLayout,
  Details,
  GlobalModals,
  Header,
  PoweredBy,
} from "../../../features/widget-shell/composition";
import { useDetailsMatch } from "../../../features/widget-shell/index";
import {
  container,
  headerContainer,
} from "../../../features/widget-shell/views";
import { createYieldFlowRoutes } from "../../../features/yield-transaction-flow/composition";
import { getYieldFlowRouteGroup } from "../../../features/yield-transaction-flow/index";
import { widgetRoutes } from "../../../services/navigation/widget-routes";

const CompactDetails = () => {
  const pendingActionsCount = usePortfolioPendingActionsCount();
  return <Details pendingActionsCount={pendingActionsCount} />;
};

/** The Compact Layout's route tree. */
export const createCompactRoutes = () => {
  const earnPath = widgetRoutes.earn.build();

  return (
    <Route element={<CompactLayout />}>
      {/* Home + Tabs */}
      <Route element={<CompactDetails />}>
        <Route index element={<AnimatedEarnPage />} />
        <Route
          path={widgetRoutes.positions.pattern}
          element={<AnimatedPositionsPage />}
        />
        <Route path={widgetRoutes.activity.pattern}>
          <Route index element={<AnimatedActivityPage />} />
          <Route
            element={
              <WalletScopeRouteGuard
                fallbackPath={widgetRoutes.activity.build()}
              />
            }
          >
            {createActivityActionRoutes({
              selectsDefaultAction: false,
              showsBackButton: true,
            })}
          </Route>
        </Route>
      </Route>

      <Route element={<WalletScopeRouteGuard fallbackPath={earnPath} />}>
        {/* Stake flow */}
        {createYieldFlowRoutes({ mount: "Earn" })}

        {/* Position details hub + flow mounts */}
        <Route path={widgetRoutes.positionDetails.pattern}>
          <Route index element={<CompactPositionDetailsPage />} />
          <Route
            path={widgetRoutes.positionSelectValidator.pattern}
            element={<CompactPositionDetailsPage />}
          />

          {/* Legacy / accidental stake prefix → hub (no form) */}
          <Route path={widgetRoutes.positionStake.pattern}>
            <Route index element={<Navigate replace to=".." />} />
            <Route path="*" element={<Navigate replace to="../.." />} />
          </Route>

          {/* Unstaking */}
          <Route path={widgetRoutes.positionUnstake.pattern}>
            <Route index element={<Navigate replace to=".." />} />
            {createYieldFlowRoutes({ mount: "PositionExit" })}
            <Route path="*" element={<Navigate replace to="../.." />} />
          </Route>

          {/* Pending Actions */}
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

      <Route path="*" element={<WidgetNavigate replace to={earnPath} />} />
    </Route>
  );
};

export const CompactRoutes = () => {
  const location = useLocation();
  // Review, Steps, and Complete of one flow mount share a key, so the flow
  // subtree (which owns its Session) stays mounted across them.
  const yieldFlowRouteGroup = getYieldFlowRouteGroup(location.pathname);

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const resolveRouteKey = () => {
    if (yieldFlowRouteGroup !== null) {
      return `flow:${yieldFlowRouteGroup}`;
    }
    if (detailsMatch) return "tabs";
    return location.key;
  };
  const key = resolveRouteKey();

  return (
    <>
      <AnimationLayout>
        <LayoutGroup>
          <motion.div layout="position" className={headerContainer}>
            <Header />
          </motion.div>

          <motion.div layout="position" className={container}>
            <AnimatePresence>
              <Routes location={location} key={key}>
                {createCompactRoutes()}
              </Routes>
            </AnimatePresence>
          </motion.div>

          <PoweredBy />
        </LayoutGroup>
      </AnimationLayout>

      <GlobalModals />
    </>
  );
};
