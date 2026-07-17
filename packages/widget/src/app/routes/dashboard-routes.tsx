import { Navigate, Route, Routes } from "react-router";
import { ActivitySelectionRouteGuard } from "../../features/activity";
import {
  activityTransactionWorkflowKeyAtom,
  activityTransactionWorkflowLifecycleAtom,
} from "../../features/activity/state/selection";
import { ActivityTabPage } from "../../features/activity/ui";
import {
  BorrowCompletePage,
  BorrowCompletionRouteGuard,
  BorrowConnectedWalletRoute,
  BorrowFormPage,
  BorrowLayout,
  BorrowPositionActionPage,
  BorrowPositionActionsPage,
  BorrowPositionDetailsPage,
  BorrowReviewPage,
  BorrowStepsPage,
  BorrowTransactionWorkflowGuard,
  useBorrowFeatureEnabled,
} from "../../features/borrow/ui-entry";
import { EarnPageContent, EarnPageModelBinding } from "../../features/earn/ui";
import { ManagePage } from "../../features/portfolio/ui";
import {
  DashboardPositionDetailsPage,
  PositionDetailsActions,
  PositionDetailsStakeActions,
} from "../../features/position-details/ui";
// import { RewardsTabPage } from "../../domain/types/rewards";
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
  ActivityDetailsPage,
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
import { WalletScopeRouteGuard } from "../../features/wallet";
import { GlobalModals } from "../../features/widget-shell/screens";
import { useSKLocation } from "../../shared/react/location-history";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";
import { ClassicTransactionWorkflowGuard } from "./guards/classic-transaction-workflow";

const positionDetailsStakeFooterPath =
  /^\/positions\/[^/]+\/[^/]+(?:\/stake)?$/;

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/" || positionDetailsStakeFooterPath.test(pathname);

export const DashboardRoutes = () => {
  const { current } = useSKLocation();
  const borrowFeatureEnabled = useBorrowFeatureEnabled();
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    current.pathname
  );
  const borrowRoutes = borrowFeatureEnabled ? (
    <>
      <Route path="borrow" element={<BorrowLayout />}>
        <Route index element={<BorrowFormPage />} />
        <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
          <Route element={<BorrowConnectedWalletRoute />}>
            <Route path="review" element={<BorrowReviewPage />} />
            <Route element={<BorrowTransactionWorkflowGuard />}>
              <Route path="steps" element={<BorrowStepsPage />} />
              <Route element={<BorrowCompletionRouteGuard />}>
                <Route path="complete" element={<BorrowCompletePage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
        <Route element={<BorrowConnectedWalletRoute />}>
          <Route
            path="positions/borrow/:marketId"
            element={<BorrowPositionDetailsPage />}
          >
            <Route index element={<BorrowPositionActionsPage />} />
            <Route
              path="action/:actionId"
              element={<BorrowPositionActionPage />}
            />
            <Route path="review" element={<BorrowReviewPage />} />
            <Route element={<BorrowTransactionWorkflowGuard />}>
              <Route path="steps" element={<BorrowStepsPage />} />
              <Route element={<BorrowCompletionRouteGuard />}>
                <Route path="complete" element={<BorrowCompletePage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
    </>
  ) : (
    <>
      <Route path="borrow/*" element={<Navigate to="/" replace />} />
      <Route
        path="positions/borrow/:marketId/*"
        element={<Navigate to="/manage" replace />}
      />
    </>
  );

  return (
    <>
      <EarnPageModelBinding registerFooterButton={registerEarnFooterButton}>
        <Routes>
          <Route element={<DashboardShell />}>
            {/* Earn Tab */}
            <Route element={<DashboardOverview />}>
              <Route index element={<EarnPageContent />} />

              <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
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
                    <Route path="complete" element={<StakeCompletePage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Manage Tab */}
            <Route path="manage" element={<ManagePage />} />

            {/* Borrow Tab */}
            {borrowRoutes}

            {/* Position Details */}
            <Route element={<WalletScopeRouteGuard fallbackPath="/manage" />}>
              <Route
                path="positions/:integrationId/:balanceId"
                element={<DashboardPositionDetailsPage />}
              >
                <Route index element={<PositionDetailsStakeActions />} />

                {/* Staking */}
                <Route path="stake">
                  <Route index element={<PositionDetailsStakeActions />} />
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
                      <Route path="complete" element={<StakeCompletePage />} />
                    </Route>
                  </Route>
                </Route>

                <Route
                  path="select-validator/:pendingActionType"
                  element={<DashboardPositionDetailsPage />}
                />

                {/* Unstaking */}
                <Route path="unstake">
                  <Route index element={<PositionDetailsActions />} />
                  <Route element={<ExitStakeRequestRouteGuard />}>
                    <Route path="review" element={<UnstakeReviewPage />} />
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
                      <Route path="steps" element={<UnstakeStepsPage />} />
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
                    <Route path="review" element={<PendingReviewPage />} />
                    <Route
                      element={
                        <ClassicTransactionWorkflowGuard
                          workflowLifecycleAtom={
                            pendingTransactionWorkflowLifecycleAtom
                          }
                          workflowKeyAtom={pendingTransactionWorkflowKeyAtom}
                        />
                      }
                    >
                      <Route path="steps" element={<PendingStepsPage />} />
                      <Route
                        path="complete"
                        element={<PendingCompletePage />}
                      />
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Rewards Tab */}
            {/* <Route path="rewards" element={<RewardsTabPage />} /> */}

            {/* Activity Tab */}
            <Route path="activity" element={<ActivityTabPage />}>
              <Route
                element={<WalletScopeRouteGuard fallbackPath="/activity" />}
              >
                <Route element={<ActivitySelectionRouteGuard />}>
                  <Route index element={<ActivityDetailsPage />} />
                  <Route
                    element={
                      <ClassicTransactionWorkflowGuard
                        workflowLifecycleAtom={
                          activityTransactionWorkflowLifecycleAtom
                        }
                        workflowKeyAtom={activityTransactionWorkflowKeyAtom}
                      />
                    }
                  >
                    <Route
                      path=":pendingActionType/steps"
                      element={<ActivityStepsPage />}
                    />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </EarnPageModelBinding>

      <GlobalModals />
    </>
  );
};
