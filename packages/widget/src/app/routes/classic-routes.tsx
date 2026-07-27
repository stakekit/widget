import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AnimatedActivityPage } from "../../features/activity/ui";
import { classicFlowSessionStore } from "../../features/classic-transaction-flow/state";
import {
  ActionReviewPage,
  ActivityCompletePage,
  ActivityResumeClassicFlowRoute,
  ActivityStepsPage,
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  EnterClassicFlowRoute,
  ExitClassicFlowRoute,
  ManageClassicFlowRoute,
  PendingCompletePage,
  PendingReviewPage,
  PendingStepsPage,
  StakeCompletePage,
  StakeReviewPage,
  StakeStepsPage,
  UnstakeCompletePage,
  UnstakeReviewPage,
  UnstakeStepsPage,
} from "../../features/classic-transaction-flow/ui";
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
import { isClassicFlowSessionPath } from "./classic-flow-session-path";

export const ClassicRoutes = () => {
  const underMaintenance = useUnderMaintenance();

  const location = useLocation();
  const flowSession = useAtomValue(classicFlowSessionStore.currentSessionAtom);

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const resolveRouteKey = () => {
    if (
      flowSession &&
      isClassicFlowSessionPath(location.pathname, flowSession.intake._tag)
    ) {
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
                      <Route element={<ActivityResumeClassicFlowRoute />}>
                        <Route
                          path="review"
                          element={
                            <ClassicFlowReviewScope>
                              <ActionReviewPage />
                            </ClassicFlowReviewScope>
                          }
                        />
                        <Route element={<ClassicFlowExecutionScope />}>
                          <Route
                            path=":pendingActionType/steps"
                            element={<ActivityStepsPage />}
                          />
                          <Route
                            path=":pendingActionType/complete"
                            element={<ActivityCompletePage />}
                          />
                        </Route>
                      </Route>
                    </Route>

                    {/* Stake flow */}
                    <Route element={<EnterClassicFlowRoute />}>
                      <Route
                        path="review"
                        element={
                          <ClassicFlowReviewScope>
                            <StakeReviewPage />
                          </ClassicFlowReviewScope>
                        }
                      />
                      <Route element={<ClassicFlowExecutionScope />}>
                        <Route path="steps" element={<StakeStepsPage />} />
                        <Route
                          path="complete"
                          element={<StakeCompletePage />}
                        />
                      </Route>
                    </Route>

                    {/* Unstake or pending actions flow */}
                    <Route path="positions/:integrationId/:balanceId">
                      <Route index element={<ClassicPositionDetailsPage />} />
                      <Route
                        path="select-validator/:pendingActionType"
                        element={<ClassicPositionDetailsPage />}
                      />

                      {/* Unstaking */}
                      <Route path="unstake">
                        <Route element={<ExitClassicFlowRoute />}>
                          <Route
                            path="review"
                            element={
                              <ClassicFlowReviewScope>
                                <UnstakeReviewPage />
                              </ClassicFlowReviewScope>
                            }
                          />
                          <Route element={<ClassicFlowExecutionScope />}>
                            <Route
                              path="steps"
                              element={<UnstakeStepsPage />}
                            />
                            <Route
                              path="complete"
                              element={<UnstakeCompletePage />}
                            />
                          </Route>
                        </Route>
                      </Route>

                      {/* Pending Actions */}
                      <Route path="pending-action">
                        <Route element={<ManageClassicFlowRoute />}>
                          <Route
                            path="review"
                            element={
                              <ClassicFlowReviewScope>
                                <PendingReviewPage />
                              </ClassicFlowReviewScope>
                            }
                          />
                          <Route element={<ClassicFlowExecutionScope />}>
                            <Route
                              path="steps"
                              element={<PendingStepsPage />}
                            />
                            <Route
                              path="complete"
                              element={<PendingCompletePage />}
                            />
                          </Route>
                        </Route>
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
