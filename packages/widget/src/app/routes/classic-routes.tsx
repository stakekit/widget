import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AnimatedActivityPage } from "../../features/activity/ui";
import { isActiveClassicTransactionFlowPathAtom } from "../../features/classic-transaction-flow/state";
import { createClassicFlowRoutes } from "../../features/classic-transaction-flow/ui";
import { AnimatedEarnPage } from "../../features/earn/ui";
import { AnimatedPositionsPage } from "../../features/portfolio/ui";
import { ClassicPositionDetailsPage } from "../../features/position-details/ui";
import { WalletScopeRouteGuard } from "../../features/wallet/ui";
import {
  container,
  headerContainer,
  UnderMaintenance,
} from "../../features/widget-shell/components";
import {
  useDetailsMatch,
  useUnderMaintenance,
} from "../../features/widget-shell/state";
import {
  AnimationLayout,
  ClassicLayout,
  Details,
  GlobalModals,
  Header,
  PoweredBy,
} from "../../features/widget-shell/ui";

export const ClassicRoutes = () => {
  const underMaintenance = useUnderMaintenance();

  const location = useLocation();
  const isActiveClassicFlowPath = useAtomValue(
    isActiveClassicTransactionFlowPathAtom(location.pathname)
  );

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const resolveRouteKey = () => {
    if (isActiveClassicFlowPath) {
      return "classic-flow-session";
    }
    if (detailsMatch) return "/";
    return location.key;
  };
  const key = resolveRouteKey();

  if (underMaintenance) return <UnderMaintenance />;

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
                <Route
                  element={
                    <ClassicLayout currentPathname={location.pathname} />
                  }
                >
                  {/* Home + Tabs */}
                  <Route element={<Details />}>
                    <Route index element={<AnimatedEarnPage />} />
                    <Route
                      path="positions"
                      element={<AnimatedPositionsPage />}
                    />
                    <Route path="activity" element={<AnimatedActivityPage />} />
                  </Route>

                  <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
                    {/* Activity flow */}
                    <Route path="activity">
                      {createClassicFlowRoutes({
                        journey: "ActivityResume",
                        presentation: "Classic",
                      })}
                    </Route>

                    {/* Stake flow */}
                    {createClassicFlowRoutes({ journey: "Enter" })}

                    {/* Unstake or pending actions flow */}
                    <Route path="positions/:integrationId/:balanceId">
                      <Route index element={<ClassicPositionDetailsPage />} />
                      <Route
                        path="select-validator/:pendingActionType"
                        element={<ClassicPositionDetailsPage />}
                      />

                      {/* Unstaking */}
                      <Route path="unstake">
                        {createClassicFlowRoutes({ journey: "Exit" })}
                      </Route>

                      {/* Pending Actions */}
                      <Route path="pending-action">
                        {createClassicFlowRoutes({ journey: "Manage" })}
                      </Route>
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
