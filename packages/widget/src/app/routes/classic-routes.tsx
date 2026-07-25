import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { AnimatedActivityPage } from "../../features/activity/ui/classic/activity-page/activity.page";
import { classicFlowSessionStore } from "../../features/classic-transaction-flow/facade";
import {
  ActivityResumeClassicFlowRoute,
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  EnterClassicFlowRoute,
  ExitClassicFlowRoute,
  ManageClassicFlowRoute,
} from "../../features/classic-transaction-flow/react/classic-flow-route";
import { ActivityCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/activity-complete.page";
import { PendingCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/pending-complete.page";
import { StakeCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/unstake-complete.page";
import { ActionReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/action-review.page";
import { PendingReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/pending-review.page";
import { StakeReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/stake-review.page";
import { UnstakeReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/unstake-review.page";
import { ActivityStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/activity-steps.page";
import { PendingStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/pending-steps.page";
import { StakeStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/stake-steps.page";
import { UnstakeStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/unstake-steps.page";
import { AnimatedEarnPage } from "../../features/earn/ui/classic/earn-page/earn.page";
import { initParamsAtom } from "../../features/init-params/atoms";
import { AnimatedPositionsPage } from "../../features/portfolio/ui/classic/positions-page/positions.page";
import { PositionDetailsPage as ClassicPositionDetailsPage } from "../../features/position-details/ui/classic/position-details.page";
import { useSKWallet } from "../../features/wallet/react/use-wallet";
import { WalletScopeRouteGuard } from "../../features/wallet/react/wallet-scope-route";
import { AnimationLayout } from "../../features/widget-shell/animation-layout";
import { ClassicLayout } from "../../features/widget-shell/classic-layout";
import { headerContainer } from "../../features/widget-shell/classic-layout/styles.css";
import { Details } from "../../features/widget-shell/details/details.page";
import { Header } from "../../features/widget-shell/header";
import { container } from "../../features/widget-shell/layout.css";
import { PoweredBy } from "../../features/widget-shell/powered-by";
import { useUnderMaintenance } from "../../features/widget-shell/react-use-under-maintenance";
import { GlobalModals } from "../../features/widget-shell/ui/global-modals";
import { default as UnderMaintenance } from "../../features/widget-shell/ui/under-maintenance";
import { useSKLocation } from "../../shared/react/location-history";
import { useDetailsMatch } from "../../shared/react/navigation/use-details-match";
import { usePrevious } from "../../shared/react/use-previous";
import { useSavedRef } from "../../shared/react/use-saved-ref";
import { isClassicFlowSessionPath } from "./classic-flow-session-path";

export const ClassicRoutes = () => {
  const underMaintenance = useUnderMaintenance();

  const { chain, address } = useSKWallet();

  const prevChain = usePrevious(chain);
  const prevAddress = usePrevious(address);

  const { current } = useSKLocation();
  const flowSession = useAtomValue(classicFlowSessionStore.currentSessionAtom);

  const pathnameRef = useSavedRef(current.pathname);
  const navigateRef = useSavedRef(useNavigate());

  /**
   * On chain change, navigate to home page
   */
  useEffect(() => {
    if (
      pathnameRef.current !== "/" &&
      pathnameRef.current !== "/positions" &&
      pathnameRef.current !== "/activity" &&
      ((prevChain && chain !== prevChain) ||
        (prevAddress && address !== prevAddress))
    ) {
      const url = new URL(window.location.href);
      const newUrl = new URL(window.location.origin);
      if (url.searchParams.has("embed")) {
        newUrl.searchParams.set("embed", "true");
      }

      window.history.pushState({}, window.document.title, newUrl.href);
      navigateRef.current("/", { replace: true });
    }
  }, [chain, address, pathnameRef, navigateRef, prevChain, prevAddress]);

  const initParams = useAtomValue(initParamsAtom);
  const initTab = initParams?.tab;

  useEffect(() => {
    if (!initTab) return;

    navigateRef.current(initTab === "earn" ? "/" : "/positions");
  }, [initTab, navigateRef]);

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const resolveRouteKey = () => {
    if (
      flowSession &&
      isClassicFlowSessionPath(current.pathname, flowSession.intake._tag)
    ) {
      return "classic-flow-session";
    }
    if (detailsMatch) return "/";
    return current.key;
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
              <Routes location={current} key={key}>
                <Route
                  element={<ClassicLayout currentPathname={current.pathname} />}
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
