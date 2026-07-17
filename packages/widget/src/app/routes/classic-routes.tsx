import { useAtomValue } from "@effect/atom-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { ActivitySelectionRouteGuard } from "../../features/activity";
import {
  activityTransactionWorkflowKeyAtom,
  activityTransactionWorkflowLifecycleAtom,
} from "../../features/activity/state/selection";
import { AnimatedActivityPage } from "../../features/activity/ui";
import { AnimatedEarnPage } from "../../features/earn/ui";
import { initParamsAtom } from "../../features/init-params";
import { AnimatedPositionsPage } from "../../features/portfolio/ui";
import { ClassicPositionDetailsPage } from "../../features/position-details/ui";
import {
  EnterStakeRequestRouteGuard,
  ExitStakeRequestRouteGuard,
  PendingActionRequestRouteGuard,
} from "../../features/transaction-flow";
import {
  enterTransactionWorkflowKeyAtom,
  enterTransactionWorkflowLifecycleAtom,
} from "../../features/transaction-flow/state/enter-request";
import {
  exitTransactionWorkflowKeyAtom,
  exitTransactionWorkflowLifecycleAtom,
} from "../../features/transaction-flow/state/exit-request";
import {
  pendingTransactionWorkflowKeyAtom,
  pendingTransactionWorkflowLifecycleAtom,
} from "../../features/transaction-flow/state/pending-action-request";
import {
  ActionReviewPage,
  ActivityCompletePage,
  ActivityStepsPage,
  PendingCompletePage,
  PendingReviewPage,
  PendingStepsPage,
  StakeCompletePage,
  StakeReviewPage,
  StakeStepsPage,
  UnstakeCompletePage,
  UnstakeReviewPage,
  UnstakeStepsPage,
} from "../../features/transaction-flow/ui";
import { useSKWallet, WalletScopeRouteGuard } from "../../features/wallet";
import {
  AnimationLayout,
  ClassicLayout,
  container,
  Header,
  PoweredBy,
} from "../../features/widget-shell";
import {
  Details,
  GlobalModals,
  headerContainer,
  UnderMaintenance,
  useUnderMaintenance,
} from "../../features/widget-shell/screens";
import { useSKLocation } from "../../shared/react/location-history";
import { useDetailsMatch } from "../../shared/react/navigation/use-details-match";
import { usePrevious } from "../../shared/react/use-previous";
import { useSavedRef } from "../../shared/react/use-saved-ref";
import { ClassicTransactionWorkflowGuard } from "./guards/classic-transaction-workflow";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";

export const ClassicRoutes = () => {
  const underMaintenance = useUnderMaintenance();

  const { chain, address } = useSKWallet();

  const prevChain = usePrevious(chain);
  const prevAddress = usePrevious(address);

  const { current } = useSKLocation();

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

  useHandleDeepLinks();

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const key = detailsMatch ? "/" : current.key;

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
                      <Route element={<ActivitySelectionRouteGuard />}>
                        <Route path="review" element={<ActionReviewPage />} />
                        <Route
                          element={
                            <ClassicTransactionWorkflowGuard
                              workflowLifecycleAtom={
                                activityTransactionWorkflowLifecycleAtom
                              }
                              workflowKeyAtom={
                                activityTransactionWorkflowKeyAtom
                              }
                            />
                          }
                        >
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
                    <Route element={<EnterStakeRequestRouteGuard />}>
                      <Route path="review" element={<StakeReviewPage />} />
                      <Route
                        element={
                          <ClassicTransactionWorkflowGuard
                            workflowLifecycleAtom={
                              enterTransactionWorkflowLifecycleAtom
                            }
                            workflowKeyAtom={enterTransactionWorkflowKeyAtom}
                          />
                        }
                      >
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
                        <Route element={<ExitStakeRequestRouteGuard />}>
                          <Route
                            path="review"
                            element={<UnstakeReviewPage />}
                          />
                          <Route
                            element={
                              <ClassicTransactionWorkflowGuard
                                workflowLifecycleAtom={
                                  exitTransactionWorkflowLifecycleAtom
                                }
                                workflowKeyAtom={exitTransactionWorkflowKeyAtom}
                              />
                            }
                          >
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
                        <Route element={<PendingActionRequestRouteGuard />}>
                          <Route
                            path="review"
                            element={<PendingReviewPage />}
                          />
                          <Route
                            element={
                              <ClassicTransactionWorkflowGuard
                                workflowLifecycleAtom={
                                  pendingTransactionWorkflowLifecycleAtom
                                }
                                workflowKeyAtom={
                                  pendingTransactionWorkflowKeyAtom
                                }
                              />
                            }
                          >
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
