import { Navigate, Route, Routes } from "react-router";
import { ActivityTabPage } from "../../features/activity/ui/dashboard/activity";
import { BorrowFormPage, BorrowLayout } from "../../features/borrow/ui";
import {
  BorrowCompletionRouteGuard,
  BorrowTransactionWorkflowGuard,
} from "../../features/borrow/ui/borrow-execution-route";
import { BorrowCompletePage } from "../../features/borrow/ui/complete";
import { BorrowConnectedWalletRoute } from "../../features/borrow/ui/connected-wallet";
import {
  BorrowPositionActionPage,
  BorrowPositionActionsPage,
  BorrowPositionDetailsPage,
} from "../../features/borrow/ui/position-details";
import { BorrowReviewPage } from "../../features/borrow/ui/review";
import { BorrowStepsPage } from "../../features/borrow/ui/steps";
import { useBorrowFeatureEnabled } from "../../features/borrow/ui/use-borrow-feature-enabled";
import { EarnPageModelBinding } from "../../features/earn/ui/classic/earn-page/state/earn-page-model";
import { EarnPageContent } from "../../features/earn/ui/dashboard/earn-page";
import { ManagePage } from "../../features/portfolio/ui/dashboard/manage.page";
import { PositionDetailsPage as DashboardPositionDetailsPage } from "../../features/position-details/ui/dashboard";
import { PositionDetailsActions } from "../../features/position-details/ui/dashboard/components/position-details-actions";
import { PositionDetailsStakeActions } from "../../features/position-details/ui/dashboard/components/position-details-stake-actions";
// import { RewardsTabPage } from "../../domain/types/rewards";
import {
  ActivityResumeClassicFlowRouteGuard,
  EnterClassicFlowRouteGuard,
  ExitClassicFlowRouteGuard,
  ManageClassicFlowRouteGuard,
} from "../../features/transaction-flow/react/request-route-guards";
import { ActivityDetailsPage } from "../../features/transaction-flow/ui/activity-details.page";
import { PendingCompletePage } from "../../features/transaction-flow/ui/complete/pages/pending-complete.page";
import { StakeCompletePage } from "../../features/transaction-flow/ui/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "../../features/transaction-flow/ui/complete/pages/unstake-complete.page";
import { PendingReviewPage } from "../../features/transaction-flow/ui/review/pages/pending-review.page";
import { StakeReviewPage } from "../../features/transaction-flow/ui/review/pages/stake-review.page";
import { UnstakeReviewPage } from "../../features/transaction-flow/ui/review/pages/unstake-review.page";
import { ActivityStepsPage } from "../../features/transaction-flow/ui/steps/pages/activity-steps.page";
import { PendingStepsPage } from "../../features/transaction-flow/ui/steps/pages/pending-steps.page";
import { StakeStepsPage } from "../../features/transaction-flow/ui/steps/pages/stake-steps.page";
import { UnstakeStepsPage } from "../../features/transaction-flow/ui/steps/pages/unstake-steps.page";
import { WalletScopeRouteGuard } from "../../features/wallet/react/wallet-scope-route";
import { GlobalModals } from "../../features/widget-shell/ui/global-modals";
import { useSKLocation } from "../../shared/react/location-history";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";
import { ClassicFlowTransactionWorkflowGuard } from "./guards/classic-transaction-workflow";

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
                <Route element={<EnterClassicFlowRouteGuard />}>
                  <Route path="review" element={<StakeReviewPage />} />
                  <Route element={<ClassicFlowTransactionWorkflowGuard />}>
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
                  <Route element={<EnterClassicFlowRouteGuard />}>
                    <Route path="review" element={<StakeReviewPage />} />
                    <Route element={<ClassicFlowTransactionWorkflowGuard />}>
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
                  <Route element={<ExitClassicFlowRouteGuard />}>
                    <Route path="review" element={<UnstakeReviewPage />} />
                    <Route element={<ClassicFlowTransactionWorkflowGuard />}>
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
                  <Route element={<ManageClassicFlowRouteGuard />}>
                    <Route path="review" element={<PendingReviewPage />} />
                    <Route element={<ClassicFlowTransactionWorkflowGuard />}>
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
                <Route element={<ActivityResumeClassicFlowRouteGuard />}>
                  <Route index element={<ActivityDetailsPage />} />
                  <Route element={<ClassicFlowTransactionWorkflowGuard />}>
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
