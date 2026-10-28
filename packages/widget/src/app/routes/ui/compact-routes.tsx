import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import {
  AnimatedActivityPage,
  createActivityActionRoutes,
} from "../../../features/activity/composition";
import { AnimatedEarnPage } from "../../../features/earn/composition";
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

const CompactDetails = () => {
  const pendingActionsCount = usePortfolioPendingActionsCount();
  return <Details pendingActionsCount={pendingActionsCount} />;
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
    if (detailsMatch) return "/";
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
                <Route element={<CompactLayout />}>
                  {/* Home + Tabs */}
                  <Route element={<CompactDetails />}>
                    <Route index element={<AnimatedEarnPage />} />
                    <Route
                      path="positions"
                      element={<AnimatedPositionsPage />}
                    />
                    <Route path="activity">
                      <Route index element={<AnimatedActivityPage />} />
                      <Route
                        element={
                          <WalletScopeRouteGuard fallbackPath="/activity" />
                        }
                      >
                        {createActivityActionRoutes("Compact")}
                      </Route>
                    </Route>
                  </Route>

                  <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
                    {/* Stake flow */}
                    {createYieldFlowRoutes({ journey: "Enter" })}

                    {/* Position details hub + flow mounts */}
                    <Route path="positions/:integrationId/:balanceId">
                      <Route index element={<CompactPositionDetailsPage />} />
                      <Route
                        path="select-validator/:pendingActionType"
                        element={<CompactPositionDetailsPage />}
                      />

                      {/* Legacy / accidental stake prefix → hub (no form) */}
                      <Route path="stake">
                        <Route index element={<Navigate replace to=".." />} />
                        <Route
                          path="*"
                          element={<Navigate replace to="../.." />}
                        />
                      </Route>

                      {/* Unstaking */}
                      <Route path="unstake">
                        <Route index element={<Navigate replace to=".." />} />
                        {createYieldFlowRoutes({ journey: "Exit" })}
                        <Route
                          path="*"
                          element={<Navigate replace to="../.." />}
                        />
                      </Route>

                      {/* Pending Actions */}
                      <Route path="pending-action">
                        <Route index element={<Navigate replace to=".." />} />
                        {createYieldFlowRoutes({ journey: "Manage" })}
                        <Route
                          path="*"
                          element={<Navigate replace to="../.." />}
                        />
                      </Route>

                      <Route
                        path="*"
                        element={<Navigate replace relative="path" to=".." />}
                      />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
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
